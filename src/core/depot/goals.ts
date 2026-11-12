/**
 * Ziele: wie das Depot aufgeteilt sein soll - und was fehlt, um dahin zu kommen.
 *
 * Der Anleger legt Bandbreiten fest ("Schwellenländer 10–15 %", "kein Land
 * über 50 %"). Verglichen wird mit der Durchschau, und für jede Abweichung
 * steht da, wie viel fehlt oder zu viel ist. Die Vorschläge rechnen nur nach,
 * welcher breite Baustein (Schwellenländer-ETF, Europa-ETF, Anleihen …) die
 * eigenen Ziele mit dem kleinsten Zukauf erreicht - ohne zu verkaufen.
 *
 * Bewusst keine Produktempfehlung: Bausteine sind Indizes, keine Fonds, und die
 * Ziele setzt der Anleger selbst. Was "richtig" ist, sagt dieser Teil nicht.
 *
 * Bezugsgröße ist das Engagement, wie in der Durchschau (Hebel zählt mit).
 * Regionen, Länder, Branchen und Größen beziehen sich auf den Aktienteil,
 * Anlageklassen auf alles. Was unbekannt ist, fällt aus dem Nenner heraus und
 * senkt die Abdeckung - die Oberfläche sagt dann, wie belastbar das Ergebnis ist.
 */
import { NON_EQUITY_KEYS, computeLookThrough, type LookThrough, type Share } from './lookthrough.ts'
import type { DepotHolding } from './types.ts'

export type GoalDim = 'asset' | 'market' | 'continent' | 'country' | 'sector' | 'size'
export const GOAL_DIMS: readonly GoalDim[] = ['asset', 'market', 'continent', 'country', 'sector', 'size']

/** Jeder einzelne Schlüssel einer Dimension - für Obergrenzen wie "kein Land über 50 %". */
export const EACH_KEY = '*'
export const MAX_GOALS = 40

export interface GoalTarget {
  readonly dim: GoalDim
  /** Schlüssel wie in der Durchschau ("emerging", "europe", "US", "it") oder "*". */
  readonly key: string
  /** Untergrenze als Anteil (0.1 = 10 %), null = keine. */
  readonly min: number | null
  /** Obergrenze als Anteil, null = keine. */
  readonly max: number | null
}

/** Feste Schlüssel je Dimension; Länder kommen aus der Länderliste. */
export const GOAL_KEYS: Readonly<Record<Exclude<GoalDim, 'country'>, readonly string[]>> = {
  asset: ['equity', 'bond', 'commodity', 'cash'],
  market: ['developed', 'emerging'],
  continent: ['northAmerica', 'europe', 'asia', 'oceania', 'southAmerica', 'africa'],
  sector: [
    'it',
    'financials',
    'industrials',
    'healthCare',
    'consumerDiscretionary',
    'communication',
    'consumerStaples',
    'energy',
    'materials',
    'utilities',
    'realEstate',
  ],
  size: ['mega', 'large', 'mid', 'small'],
}

/* ------------------------------------------------------------------ Stand */

type Values = ReadonlyMap<string, number>
/** Engagement je Schlüssel und Dimension, in Anteilen des heutigen Depotwerts. */
export type GoalState = Readonly<Record<GoalDim, Values>>

const toMap = (list: readonly Share[]) => new Map(list.map((s) => [s.key, s.value]))

export function goalState(look: LookThrough): GoalState {
  return {
    asset: toMap(look.assets),
    market: toMap(look.markets),
    continent: toMap(look.continents),
    country: toMap(look.countries),
    sector: toMap(look.sectors),
    size: toMap(look.sizes),
  }
}

export interface DimView {
  /** Anteil je Schlüssel am Bekannten der Dimension. */
  readonly shares: ReadonlyMap<string, number>
  /** Bekanntes Engagement der Dimension. */
  readonly known: number
  /** Bekanntes geteilt durch alles, was dazugehören könnte. */
  readonly coverage: number
}

export function dimView(state: GoalState, dim: GoalDim): DimView {
  const asset = state.asset
  const eigene = state[dim]
  const zaehlt = (key: string) =>
    dim === 'asset' ? key !== 'unknown' && key !== 'financing' : !NON_EQUITY_KEYS.has(key)
  let known = 0
  for (const [key, v] of eigene) if (zaehlt(key) && v > 0) known += v
  // Unbekannte Positionen könnten Aktien sein - sie gehören zum Nenner der Abdeckung.
  const basis =
    dim === 'asset'
      ? [...asset].reduce((s, [k, v]) => (k === 'financing' || v <= 0 ? s : s + v), 0)
      : (asset.get('equity') ?? 0) + (asset.get('unknown') ?? 0)
  const shares = new Map<string, number>()
  if (known > 0) for (const [key, v] of eigene) if (zaehlt(key) && v > 0) shares.set(key, v / known)
  return { shares, known, coverage: basis > 0 ? Math.min(1, known / basis) : 0 }
}

/* ------------------------------------------------------------- Bewertung */

export type GoalStatus = 'ok' | 'below' | 'above' | 'noData'

export interface GoalCheck {
  readonly target: GoalTarget
  /** Der geprüfte Schlüssel - bei "*" der jeweils betroffene. */
  readonly key: string
  /** Anteil heute; null ohne Daten. */
  readonly current: number | null
  readonly status: GoalStatus
  /** Abstand zum Zielband in Anteilspunkten (0.05 = 5 Prozentpunkte). */
  readonly gap: number
  /**
   * Zukauf ohne Verkauf, in Anteilen des heutigen Depotwerts: bei "below" von
   * genau diesem Schlüssel, bei "above" von allem anderen dieser Dimension.
   */
  readonly buy: number
  /** Umschichten statt zukaufen, in Anteilen des Depotwerts. */
  readonly shift: number
  readonly coverage: number
}

function check(target: GoalTarget, key: string, view: DimView): GoalCheck {
  const current = view.known > 0 ? (view.shares.get(key) ?? 0) : null
  const basis = { target, key, current, coverage: view.coverage }
  if (current === null) return { ...basis, status: 'noData', gap: 0, buy: 0, shift: 0 }
  const K = view.known
  if (target.min !== null && current < target.min - 1e-9) {
    const m = target.min
    return {
      ...basis,
      status: 'below',
      gap: m - current,
      buy: m >= 1 ? Number.POSITIVE_INFINITY : (K * (m - current)) / (1 - m),
      shift: K * (m - current),
    }
  }
  if (target.max !== null && current > target.max + 1e-9) {
    const M = target.max
    return {
      ...basis,
      status: 'above',
      gap: current - M,
      buy: M <= 0 ? Number.POSITIVE_INFINITY : (K * (current - M)) / M,
      shift: K * (current - M),
    }
  }
  return { ...basis, status: 'ok', gap: 0, buy: 0, shift: 0 }
}

/** Alle Ziele gegen einen Stand; "*" ergibt eine Prüfung je verletztem Schlüssel. */
export function evaluateGoalState(state: GoalState, targets: readonly GoalTarget[]): GoalCheck[] {
  const views = new Map<GoalDim, DimView>()
  const view = (dim: GoalDim) => {
    let v = views.get(dim)
    if (!v) {
      v = dimView(state, dim)
      views.set(dim, v)
    }
    return v
  }
  return targets.flatMap((target) => {
    const v = view(target.dim)
    if (target.key !== EACH_KEY) return [check(target, target.key, v)]
    const alle = [...v.shares.keys()].map((key) => check(target, key, v))
    if (alle.length === 0) return [check(target, EACH_KEY, v)]
    const verletzt = alle.filter((c) => c.status !== 'ok').sort((a, b) => b.gap - a.gap)
    if (verletzt.length > 0) return verletzt
    // Alles im Rahmen: der größte Schlüssel steht stellvertretend da.
    return [alle.reduce((a, b) => ((a.current ?? 0) >= (b.current ?? 0) ? a : b))]
  })
}

export function evaluateGoals(look: LookThrough, targets: readonly GoalTarget[]): GoalCheck[] {
  return evaluateGoalState(goalState(look), targets)
}

/** Summe aller Abstände - je kleiner, desto näher am Ziel. */
export function violation(checks: readonly GoalCheck[]): number {
  return checks.reduce((s, c) => s + c.gap, 0)
}

/* -------------------------------------------------------------- Vorlagen */

export type GoalPresetId = 'marketWeight' | 'em30' | 'gdp' | 'caps' | 'equityBond' | 'smallCaps'

const ziel = (dim: GoalDim, key: string, min: number | null, max: number | null): GoalTarget => ({
  dim,
  key,
  min,
  max,
})

/**
 * Verbreitete Aufteilungen als Startpunkt - gerundet, mit Spielraum. Keine
 * davon ist "die richtige"; sie ersparen nur das Eintippen.
 */
export const GOAL_PRESETS: Readonly<Record<GoalPresetId, readonly GoalTarget[]>> = {
  marketWeight: [
    ziel('market', 'developed', 0.85, 0.92),
    ziel('market', 'emerging', 0.08, 0.15),
    ziel('continent', 'northAmerica', 0.6, 0.72),
    ziel('continent', 'europe', 0.12, 0.2),
    ziel('continent', 'asia', 0.1, 0.2),
  ],
  em30: [ziel('market', 'developed', 0.65, 0.75), ziel('market', 'emerging', 0.25, 0.35)],
  gdp: [
    ziel('market', 'developed', 0.55, 0.65),
    ziel('market', 'emerging', 0.35, 0.45),
    ziel('continent', 'northAmerica', 0.25, 0.4),
    ziel('continent', 'europe', 0.2, 0.3),
    ziel('continent', 'asia', 0.3, 0.45),
  ],
  caps: [ziel('country', EACH_KEY, null, 0.5), ziel('sector', EACH_KEY, null, 0.3)],
  equityBond: [ziel('asset', 'equity', 0.75, 0.85), ziel('asset', 'bond', 0.15, 0.25)],
  smallCaps: [ziel('size', 'small', 0.08, 0.15)],
}
export const GOAL_PRESET_IDS = Object.keys(GOAL_PRESETS) as GoalPresetId[]

/** Eine Vorlage ersetzt die Ziele der Dimensionen, die sie selbst festlegt. */
export function applyPreset(targets: readonly GoalTarget[], preset: GoalPresetId): GoalTarget[] {
  const neu = GOAL_PRESETS[preset]
  const dims = new Set(neu.map((t) => t.dim))
  return [...targets.filter((t) => !dims.has(t.dim)), ...neu].slice(0, MAX_GOALS)
}

/* ------------------------------------------------------------ Bausteine */

export type BlockId =
  | 'world'
  | 'em'
  | 'europe'
  | 'usa'
  | 'japan'
  | 'pacific'
  | 'smallCaps'
  | 'bonds'
  | 'gold'
  | 'cash'
  | `sector:${string}`
  | `country:${string}`

export interface BuildingBlock {
  readonly id: BlockId
  /** Index, nach dem der Baustein benannt ist - die Durchschau zerlegt ihn wie einen Fonds. */
  readonly index: string
  readonly state: GoalState
}

/** Breite Bausteine; Branchen- und Länderbausteine kommen nur bei passenden Zielen dazu. */
const GRUND: readonly { readonly id: BlockId; readonly index: string; readonly kind?: 'etc' }[] = [
  { id: 'world', index: 'MSCI World' },
  { id: 'em', index: 'MSCI Emerging Markets' },
  { id: 'europe', index: 'MSCI Europe' },
  { id: 'usa', index: 'S&P 500' },
  { id: 'japan', index: 'MSCI Japan' },
  { id: 'pacific', index: 'MSCI Pacific ex Japan' },
  { id: 'smallCaps', index: 'MSCI World Small Cap' },
  { id: 'bonds', index: 'Euro Government Bond' },
  { id: 'gold', index: 'Physical Gold ETC', kind: 'etc' },
  { id: 'cash', index: 'Euro Money Market' },
]

/** Branchen-ID -> Wort, an dem `matchIndex` die Branche erkennt. */
const BRANCHEN_INDEX: Readonly<Record<string, string>> = {
  it: 'Information Technology',
  financials: 'Financials',
  industrials: 'Industrials',
  healthCare: 'Health Care',
  consumerDiscretionary: 'Consumer Discretionary',
  communication: 'Communication Services',
  consumerStaples: 'Consumer Staples',
  energy: 'Energy',
  materials: 'Materials',
  utilities: 'Utilities',
  realEstate: 'Real Estate',
}

/** Länder, für die ein eigener Länder-Index bekannt ist. */
const LAENDER_INDEX: Readonly<Record<string, string>> = {
  US: 'MSCI USA',
  JP: 'MSCI Japan',
  DE: 'DAX',
  GB: 'FTSE 100',
  CH: 'SMI',
  FR: 'CAC 40',
  CN: 'MSCI China',
  IN: 'MSCI India',
  KR: 'MSCI Korea',
  TW: 'MSCI Taiwan',
  BR: 'MSCI Brazil',
  CA: 'MSCI Canada',
  AU: 'MSCI Australia',
}

function block(id: BlockId, index: string, kind: 'etf' | 'etc' = 'etf'): BuildingBlock {
  const h: DepotHolding = {
    id: '__baustein',
    name: index,
    symbol: '',
    weight: 1,
    ter: 0,
    leverage: 1,
    kind,
    lookThrough: '',
  }
  return { id, index, state: goalState(computeLookThrough([h], new Map())) }
}

const GRUND_BAUSTEINE: readonly BuildingBlock[] = GRUND.map((b) => block(b.id, b.index, b.kind))

/** Die Bausteine, die für diese Ziele in Frage kommen. */
export function buildingBlocks(targets: readonly GoalTarget[]): BuildingBlock[] {
  const extra = targets.flatMap((t) => {
    if (t.min === null || t.key === EACH_KEY) return []
    if (t.dim === 'sector' && BRANCHEN_INDEX[t.key]) {
      return [block(`sector:${t.key}`, `MSCI World ${BRANCHEN_INDEX[t.key]}`)]
    }
    if (t.dim === 'country' && LAENDER_INDEX[t.key]) return [block(`country:${t.key}`, LAENDER_INDEX[t.key])]
    return []
  })
  const seen = new Set<string>()
  return [...GRUND_BAUSTEINE, ...extra].filter((b) => !seen.has(b.id) && seen.add(b.id))
}

/* ----------------------------------------------------------- Vorschläge */

function plus(state: GoalState, add: GoalState, amount: number): GoalState {
  const mische = (a: Values, b: Values) => {
    const out = new Map(a)
    for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + amount * v)
    return out
  }
  return {
    asset: mische(state.asset, add.asset),
    market: mische(state.market, add.market),
    continent: mische(state.continent, add.continent),
    country: mische(state.country, add.country),
    sector: mische(state.sector, add.sector),
    size: mische(state.size, add.size),
  }
}

/** Zukaufmengen in Anteilen des Depotwerts: fein bei kleinen, grob bei großen Beträgen. */
const STUFEN: readonly number[] = [
  ...Array.from({ length: 40 }, (_, i) => (i + 1) * 0.005),
  ...Array.from({ length: 30 }, (_, i) => 0.21 + i * 0.01),
  ...Array.from({ length: 20 }, (_, i) => 0.525 + i * 0.025),
].map((x) => Math.round(x * 1000) / 1000)

/**
 * Was ein Zukauf kosten darf: jeder Prozentpunkt des Depotwerts, der zugekauft
 * wird, muss den Zielabstand um mindestens 0,1 Prozentpunkte senken. Sonst
 * gewänne, wer am meisten kauft - "100 % Welt-ETF dazu" ist kein Vorschlag.
 */
export const AUFWAND = 0.1
/** Ein Schritt im Plan muss je 25 % Zukauf mindestens einen Prozentpunkt bringen. */
const MINDEST_NUTZEN = 0.04

export interface Suggestion {
  readonly block: BlockId
  readonly index: string
  /** Zukauf in Anteilen des heutigen Depotwerts. */
  readonly amount: number
  /** Ziele, die vorher verletzt waren und danach passen. */
  readonly fixes: number
  /** Ziele, die vorher passten und danach verletzt sind. */
  readonly breaks: number
  /** Summe der Abstände vorher und nachher, in Anteilspunkten. */
  readonly before: number
  readonly after: number
}

export interface GoalPlan {
  readonly steps: readonly { readonly block: BlockId; readonly index: string; readonly amount: number }[]
  readonly total: number
  readonly before: number
  readonly after: number
  /** Ziele, die nach dem Plan noch nicht passen. */
  readonly open: number
}

export interface GoalAdvice {
  readonly checks: readonly GoalCheck[]
  /** Einzelne Bausteine, bestes zuerst. */
  readonly suggestions: readonly Suggestion[]
  /** Bis zu drei Bausteine nacheinander, falls einer allein nicht reicht. */
  readonly plan: GoalPlan | null
}

const offen = (checks: readonly GoalCheck[]) => checks.filter((c) => c.status === 'below' || c.status === 'above')
const schluessel = (c: GoalCheck) => `${c.target.dim}|${c.target.key}|${c.key}`

function bestAmount(state: GoalState, b: BuildingBlock, targets: readonly GoalTarget[]) {
  let best = { amount: 0, v: violation(evaluateGoalState(state, targets)) }
  let bestF = best.v
  for (const amount of STUFEN) {
    const v = violation(evaluateGoalState(plus(state, b.state, amount), targets))
    const f = v + AUFWAND * amount
    // Nur echte Verbesserungen: bei Gleichstand bleibt der kleinere Betrag.
    if (f < bestF - 1e-4) {
      best = { amount, v }
      bestF = f
    }
  }
  return best
}

/**
 * Welcher Zukauf die eigenen Ziele am besten erreicht - je Baustein der
 * kleinste Betrag mit dem geringsten Restabstand, dazu ein Plan aus bis zu
 * drei Bausteinen nacheinander.
 */
export function goalAdvice(look: LookThrough, targets: readonly GoalTarget[]): GoalAdvice {
  const state = goalState(look)
  const checks = evaluateGoalState(state, targets)
  const vorher = violation(checks)
  if (offen(checks).length === 0) return { checks, suggestions: [], plan: null }

  const bausteine = buildingBlocks(targets)
  const verletzt = new Set(offen(checks).map(schluessel))
  const suggestions = bausteine
    .flatMap((b): Suggestion[] => {
      const { amount, v } = bestAmount(state, b, targets)
      if (amount === 0 || vorher - v < 0.002) return []
      const danach = evaluateGoalState(plus(state, b.state, amount), targets)
      const nochOffen = new Set(offen(danach).map(schluessel))
      const fixes = [...verletzt].filter((k) => !nochOffen.has(k)).length
      const breaks = [...nochOffen].filter((k) => !verletzt.has(k)).length
      // Ein Baustein, der nichts erfüllt und dafür etwas anderes verletzt, ist kein Vorschlag.
      if (fixes === 0 && breaks > 0) return []
      return [{ block: b.id, index: b.index, amount, fixes, breaks, before: vorher, after: v }]
    })
    // Was mehr Ziele erfüllt, zuerst; sonst der beste Kompromiss aus Restabstand und Zukauf.
    .sort(
      (a, b) =>
        b.fixes - a.fixes ||
        a.after + AUFWAND * a.amount - (b.after + AUFWAND * b.amount) ||
        a.amount - b.amount,
    )
    .slice(0, 3)

  // Plan: der jeweils beste Baustein auf den Stand nach dem vorigen.
  const steps: { b: BuildingBlock; amount: number }[] = []
  let stand = state
  let rest = vorher
  for (let i = 0; i < 3 && rest > 1e-4; i++) {
    let bester: { b: BuildingBlock; amount: number; v: number } | null = null
    for (const b of bausteine) {
      const { amount, v } = bestAmount(stand, b, targets)
      const nutzen = rest - v
      const f = v + AUFWAND * amount
      if (
        amount > 0 &&
        nutzen >= 0.002 &&
        nutzen >= MINDEST_NUTZEN * amount &&
        (!bester || f < bester.v + AUFWAND * bester.amount - 1e-9)
      ) {
        bester = { b, amount, v }
      }
    }
    if (!bester) break
    stand = plus(stand, bester.b.state, bester.amount)
    rest = bester.v
    const gleich = steps.find((s) => s.b.id === bester.b.id)
    if (gleich) gleich.amount += bester.amount
    else steps.push({ b: bester.b, amount: bester.amount })
  }

  /*
   * Nachschärfen: Schritt für Schritt gewählt bleibt oft ein Rest von Zehntel-
   * Prozentpunkten - der nächste Baustein drückt einen schon erreichten Anteil
   * wieder unter die Grenze. Kleine Zuschläge auf die gewählten Bausteine
   * schließen diesen Rest, solange er klein ist.
   */
  const standMit = (liste: readonly { b: BuildingBlock; amount: number }[]) =>
    liste.reduce((st, x) => plus(st, x.b.state, x.amount), state)
  for (let i = 0; i < 20 && rest > 1e-4 && rest < 0.02 && steps.length > 0; i++) {
    let bester: { index: number; v: number } | null = null
    steps.forEach((_, index) => {
      const probe = steps.map((y, j) => (j === index ? { ...y, amount: y.amount + 0.005 } : y))
      const v = violation(evaluateGoalState(standMit(probe), targets))
      if (v < rest - 1e-6 && (!bester || v < bester.v)) bester = { index, v }
    })
    if (!bester) break
    const { index, v } = bester
    steps[index] = { ...steps[index], amount: steps[index].amount + 0.005 }
    rest = v
  }
  stand = standMit(steps)

  const plan: GoalPlan | null =
    steps.length > 1
      ? {
          steps: steps.map((x) => ({ block: x.b.id, index: x.b.index, amount: Math.round(x.amount * 1000) / 1000 })),
          total: Math.round(steps.reduce((sum, x) => sum + x.amount, 0) * 1000) / 1000,
          before: vorher,
          after: rest,
          open: offen(evaluateGoalState(stand, targets)).length,
        }
      : null
  return { checks, suggestions, plan }
}
