/**
 * Depot-Kennzahlen aus Monatsrenditen: Rendite p. a., Schwankung p. a.,
 * größter Rückgang und der Risikoanteil jeder Position.
 *
 * Gerechnet wird in Euro und mit den Anteilen von heute, monatlich auf diese
 * Anteile zurückgesetzt. Das ist die Geschichte der heutigen Mischung, nicht
 * die eines echten Kontos - und Vergangenheit ist keine Vorhersage.
 */
import type { MarketSeries } from '../domain/types.ts'
import type { DepotHolding } from './types.ts'

export const WINDOW_YEARS: readonly number[] = [5, 3, 1]

export interface WindowStats {
  readonly years: number
  /** Erster und letzter Monat, "JJJJ-MM". */
  readonly from: string
  readonly to: string
  readonly returnPa: number
  readonly volPa: number
  readonly maxDrawdown: number
  /** Rendite je Einheit Schwankung; null ohne Schwankung. */
  readonly ratio: number | null
}

export interface WindowGap {
  readonly years: number
  /** Positionen, deren Kurse das Fenster nicht abdecken. */
  readonly missing: readonly string[]
}

export interface HoldingStats {
  readonly id: string
  readonly weight: number
  readonly ter: number
  readonly returnPa: number
  readonly volPa: number
  /** Anteil an der Schwankung (Varianz) des Depots. */
  readonly riskShare: number
  /** Anteil an den laufenden Kosten des Depots. */
  readonly costShare: number
}

export interface DepotStats {
  readonly windows: readonly (WindowStats | WindowGap)[]
  /** Positionszahlen im längsten vollständigen Fenster; leer, wenn keines vollständig ist. */
  readonly holdings: readonly HoldingStats[]
  readonly holdingsYears: number | null
  /** Laufende Kosten, nach Anteil gewichtet. Steckt bereits in den Fondskursen. */
  readonly ter: number
  /** Marktengagement inklusive Hebel, 1.13 = 113 % des Depotwerts. */
  readonly exposure: number
  /** Positionen ohne nutzbare Kurse - kein Symbol, Abruf gescheitert, Währung fehlt. */
  readonly missing: readonly string[]
}

export const isWindowStats = (w: WindowStats | WindowGap): w is WindowStats => 'returnPa' in w

const monthIndex = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null
}
const monthLabel = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`

/**
 * Monatsrenditen nach dem Monat, in dem sie enden.
 *
 * Mit `months` exakt: eine Rendite über eine Kurslücke hinweg landet im Monat
 * danach, die übersprungenen Monate zählen 0 % - so bleibt die Gesamtrendite
 * richtig und kein Fenster bricht an einer fehlenden Notierung ab. Ohne
 * `months` (gespeicherte Reihen) bleibt nur das Abzählen ab `start`.
 */
function byMonth(series: MarketSeries): Map<number, number> | null {
  const map = new Map<number, number>()
  const months = series.months?.length === series.monthlyReturns.length ? series.months : null
  if (months) {
    let vorher: number | null = null
    for (let k = 0; k < months.length; k++) {
      const m = monthIndex(months[k])
      if (m === null || (vorher !== null && m <= vorher)) return null
      if (vorher !== null) for (let luecke = vorher + 1; luecke < m; luecke++) map.set(luecke, 0)
      map.set(m, series.monthlyReturns[k])
      vorher = m
    }
    return map
  }
  const start = monthIndex(series.start)
  if (start === null) return null
  series.monthlyReturns.forEach((r, k) => map.set(start + k + 1, r))
  return map
}

/** "GBp" (Pence) rechnet wie Pfund - am Verhältnis ändert die Einheit nichts. */
export function normalizeCurrency(currency: string): string {
  const c = currency.trim()
  return c === 'GBp' || c.toUpperCase() === 'GBX' ? 'GBP' : c.toUpperCase()
}

/** Yahoo-Symbol des Devisenkurses "Fremdwährung je Euro"; null für Euro selbst. */
export function fxSymbol(currency: string): string | null {
  const c = normalizeCurrency(currency)
  return c === 'EUR' || !/^[A-Z]{3}$/.test(c) ? null : `EUR${c}=X`
}

/** Fremdwährungsrenditen in Euro: Kurs in Euro = Kurs / (Fremdwährung je Euro). */
function inEuro(series: MarketSeries, fx: ReadonlyMap<string, MarketSeries>): Map<number, number> | null {
  const own = byMonth(series)
  if (!own) return null
  if (normalizeCurrency(series.currency) === 'EUR') return own
  const symbol = fxSymbol(series.currency)
  const fxSeries = symbol ? fx.get(symbol) : undefined
  const fxMap = fxSeries ? byMonth(fxSeries) : null
  if (!fxMap) return null
  const out = new Map<number, number>()
  for (const [month, r] of own) {
    const f = fxMap.get(month)
    if (f !== undefined) out.set(month, (1 + r) / (1 + f) - 1)
  }
  return out
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

function covariance(a: readonly number[], b: readonly number[]): number {
  if (a.length < 2) return 0
  const ma = mean(a)
  const mb = mean(b)
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb)
  return s / (a.length - 1)
}

const annualized = (rs: readonly number[]) =>
  rs.reduce((p, r) => p * (1 + r), 1) ** (12 / rs.length) - 1

function maxDrawdown(rs: readonly number[]): number {
  let nav = 1
  let peak = 1
  let worst = 0
  for (const r of rs) {
    nav *= 1 + r
    peak = Math.max(peak, nav)
    worst = Math.min(worst, nav / peak - 1)
  }
  return worst
}

export function computeDepotStats(
  holdings: readonly DepotHolding[],
  series: ReadonlyMap<string, MarketSeries>,
  fx: ReadonlyMap<string, MarketSeries>,
): DepotStats {
  const total = holdings.reduce((s, h) => s + Math.max(0, h.weight), 0)
  const w = holdings.map((h) => (total > 0 ? Math.max(0, h.weight) / total : 0))
  const ter = holdings.reduce((s, h, i) => s + w[i] * h.ter, 0)
  const exposure = holdings.reduce((s, h, i) => s + w[i] * h.leverage, 0)

  const returns = holdings.map((h) => {
    const s = h.symbol ? series.get(h.symbol) : undefined
    const m = s ? inEuro(s, fx) : null
    return m && m.size > 0 ? m : null
  })
  const missing = holdings.filter((_, i) => returns[i] === null).map((h) => h.id)
  if (holdings.length === 0 || missing.length > 0) {
    return {
      windows: WINDOW_YEARS.map((years) => ({ years, missing })),
      holdings: [],
      holdingsYears: null,
      ter,
      exposure,
      missing,
    }
  }

  const maps = returns as Map<number, number>[]
  // Gemeinsames Ende: der letzte Monat, den alle Positionen haben.
  const end = Math.min(...maps.map((m) => Math.max(...m.keys())))

  let holdingStats: HoldingStats[] = []
  let holdingsYears: number | null = null
  const windows = WINDOW_YEARS.map((years): WindowStats | WindowGap => {
    const months = Array.from({ length: years * 12 }, (_, k) => end - years * 12 + 1 + k)
    const gaps = holdings.filter((_, i) => months.some((m) => !maps[i].has(m))).map((h) => h.id)
    if (gaps.length > 0) return { years, missing: gaps }

    const matrix = maps.map((m) => months.map((month) => m.get(month) as number))
    const portfolio = months.map((_, t) => matrix.reduce((s, rs, i) => s + w[i] * rs[t], 0))
    const returnPa = annualized(portfolio)
    const volPa = Math.sqrt(covariance(portfolio, portfolio) * 12)

    if (holdingsYears === null) {
      holdingsYears = years
      const cov = matrix.map((a) => matrix.map((b) => covariance(a, b)))
      const covW = cov.map((row) => row.reduce((s, c, j) => s + c * w[j], 0))
      const variance = covW.reduce((s, c, i) => s + w[i] * c, 0)
      holdingStats = holdings.map((h, i) => ({
        id: h.id,
        weight: w[i],
        ter: h.ter,
        returnPa: annualized(matrix[i]),
        volPa: Math.sqrt(cov[i][i] * 12),
        riskShare: variance > 0 ? (w[i] * covW[i]) / variance : 0,
        costShare: ter > 0 ? (w[i] * h.ter) / ter : 0,
      }))
    }

    return {
      years,
      from: monthLabel(months[0]),
      to: monthLabel(months[months.length - 1]),
      returnPa,
      volPa,
      maxDrawdown: maxDrawdown(portfolio),
      ratio: volPa > 0 ? returnPa / volPa : null,
    }
  })

  return { windows, holdings: holdingStats, holdingsYears, ter, exposure, missing }
}

/** Unter einem Jahr Verlauf zeigt ein Chart nur Rauschen. */
const MIN_VERLAUF = 12

/**
 * Der Verlauf der heutigen Mischung als eine Kursreihe - für den Depot-Chart.
 *
 * Dieselbe Rechnung wie die Kennzahlen: Euro, monatlich auf die heutigen
 * Anteile zurückgesetzt. Die Spanne ist die längste, in der jede Position
 * Kurse hat, endend am letzten gemeinsamen Monat - früher fehlte ein Teil des
 * Depots, und die Kurve zeigte etwas anderes als das, was man hält.
 *
 * null, wenn einer Position die Kurse fehlen oder weniger als ein Jahr bleibt.
 */
export function depotHistory(
  holdings: readonly DepotHolding[],
  series: ReadonlyMap<string, MarketSeries>,
  fx: ReadonlyMap<string, MarketSeries>,
  name = 'Depot',
): MarketSeries | null {
  const total = holdings.reduce((s, h) => s + Math.max(0, h.weight), 0)
  if (holdings.length === 0 || total <= 0) return null
  const w = holdings.map((h) => Math.max(0, h.weight) / total)
  const maps: Map<number, number>[] = []
  for (const h of holdings) {
    const s = h.symbol ? series.get(h.symbol) : undefined
    const m = s ? inEuro(s, fx) : null
    if (!m || m.size === 0) return null
    maps.push(m)
  }
  const end = Math.min(...maps.map((m) => Math.max(...m.keys())))
  let start = end
  while (maps.every((m) => m.has(start - 1))) start -= 1
  if (!maps.every((m) => m.has(end)) || end - start + 1 < MIN_VERLAUF) return null

  const months = Array.from({ length: end - start + 1 }, (_, k) => start + k)
  return {
    symbol: name,
    name,
    currency: 'EUR',
    // Der Monat VOR der ersten Rendite: dort steht der Index noch auf 100.
    start: `${monthLabel(start - 1)}-01`,
    monthlyReturns: months.map((month) => maps.reduce((sum, m, i) => sum + w[i] * (m.get(month) as number), 0)),
    months: months.map(monthLabel),
  }
}

/** Positionen mit anderen Anteilen - für den Was-wäre-wenn-Vergleich. */
export function withWeights(
  holdings: readonly DepotHolding[],
  weights: Readonly<Record<string, number>> | null,
): DepotHolding[] {
  if (!weights) return [...holdings]
  return holdings.map((h) => ({ ...h, weight: Math.max(0, weights[h.id] ?? h.weight) }))
}

/** Rendite p. a. des längsten vollständigen Fensters in Prozentpunkten, für ein Szenario. */
export function scenarioRate(stats: DepotStats): number | null {
  const first = stats.windows.find(isWindowStats)
  return first ? Math.round(first.returnPa * 1000) / 10 : null
}
