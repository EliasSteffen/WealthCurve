/**
 * Kennzahlen und Zeitachsen für die Pro-Ansicht.
 *
 * Rein rechnend, wie der Rest des Kerns: keine Chart-Bibliothek, kein DOM. Die
 * Pro-Ansicht zeichnet mit TradingViews `lightweight-charts`, aber was sie
 * zeigt - Kalenderdaten, Kursindex, größter Rückgang, Verdopplungszeit - steht
 * hier und ist damit auch aus Node, einem Test oder dem MCP-Server erreichbar.
 */
import type { MarketSeries, ModelSettings } from './domain/types.ts'
import type { ProjectionSummary } from './projection.ts'
import { sanitizeStartMonth } from './timeAxis.ts'

/** Sekunden seit 1970, UTC - das Zeitformat, das Zeitreihen-Charts erwarten. */
export type UtcSeconds = number

/** Der Kalendermonat, an dem Jahr 0 der Projektion hängt. */
export interface TimeAnchor {
  readonly year: number
  /** 1-12 */
  readonly month: number
}

/**
 * Wo die Projektion im Kalender beginnt.
 *
 * Mit Startjahr dort. Ohne eines ab heute: eine Zeitachse in echten Daten
 * braucht einen Anker, und „wenn ich jetzt anfange" ist die Frage, die jemand
 * ohne Startjahr stellt. Die Rechnung bleibt davon unberührt - sie kennt nur
 * Jahres-Indizes.
 */
export function timeAnchor(
  model: Pick<ModelSettings, 'startYear' | 'startMonth'>,
  now: Date = new Date(),
): TimeAnchor {
  if (model.startYear !== null) return { year: model.startYear, month: sanitizeStartMonth(model.startMonth) }
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/** Erster Tag des Monats, 00:00 UTC. */
export const monthToUtc = (year: number, month: number): UtcSeconds => Date.UTC(year, month - 1, 1) / 1000

/** Zeitpunkt der Projektionszeile `index` - ganze Jahre ab dem Anker. */
export const yearIndexTime = (anchor: TimeAnchor, index: number): UtcSeconds =>
  monthToUtc(anchor.year + index, anchor.month)

const MONATSSCHLUESSEL = /^(\d{4})-(\d{2})/

/** "2020-03" oder "2020-03-01" auf den Monatsersten; null, wenn kein Monat lesbar ist. */
export function monthKeyToUtc(key: string): UtcSeconds | null {
  const treffer = MONATSSCHLUESSEL.exec(key)
  if (!treffer) return null
  const jahr = Number(treffer[1])
  const monat = Number(treffer[2])
  if (monat < 1 || monat > 12) return null
  return monthToUtc(jahr, monat)
}

/** Monatsnummer seit Jahr 0 - für Abstände zwischen zwei Zeitpunkten. */
const monatsNummer = (zeit: UtcSeconds): number => {
  const d = new Date(zeit * 1000)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

/** Ganze Kalendermonate zwischen zwei Monatsersten. */
export const monthsBetween = (von: UtcSeconds, bis: UtcSeconds): number => monatsNummer(bis) - monatsNummer(von)

/* ------------------------------------------------------------- Kursindex */

/**
 * Ein Monat im Kursindex - eine Kerze von Schluss zu Schluss.
 *
 * Die Kursreihen tragen nur Monatsrenditen, keine Tageshochs und -tiefs. Die
 * Kerze öffnet deshalb beim Schluss des Vormonats und schließt beim eigenen;
 * Dochte gäbe es nur mit erfundenen Daten.
 */
export interface IndexBar {
  readonly time: UtcSeconds
  readonly open: number
  readonly close: number
  /** Monatsrendite: 0.012 heißt +1,2 %. */
  readonly change: number
  /** Abstand zum bisherigen Höchststand, 0 oder negativ: -0.3 heißt 30 % darunter. */
  readonly drawdown: number
}

export interface PriceIndex {
  readonly symbol: string
  /** Monat des ersten Kurses - dort steht der Index auf `base`. */
  readonly startTime: UtcSeconds
  readonly base: number
  readonly bars: readonly IndexBar[]
}

/**
 * Die Zeitpunkte der Renditen: aus `months`, wenn sie taugen, sonst abgezählt ab `start`.
 *
 * Streng aufsteigend oder gar nicht - ein Chart, der zweimal denselben Monat
 * bekommt, wirft, und ein falsch einsortierter Monat wäre schlimmer als keiner.
 */
function renditeZeiten(market: MarketSeries, startTime: UtcSeconds): UtcSeconds[] | null {
  const n = market.monthlyReturns.length
  if (market.months?.length === n) {
    const zeiten = market.months.map(monthKeyToUtc)
    let vorher = startTime
    let brauchbar = true
    for (const zeit of zeiten) {
      if (zeit === null || zeit <= vorher) {
        brauchbar = false
        break
      }
      vorher = zeit
    }
    if (brauchbar) return zeiten as UtcSeconds[]
  }
  const start = new Date(startTime * 1000)
  return Array.from({ length: n }, (_, i) => monthToUtc(start.getUTCFullYear(), start.getUTCMonth() + 2 + i))
}

/**
 * Kursverlauf als Index: der erste Kurs ist `base`, jeder Monat verkettet seine Rendite.
 *
 * Absolute Kurse kennt die App nicht - geladen werden Renditen, bereinigt um
 * Splits und Dividenden. Ein Index sagt deshalb ehrlich, was die Daten tragen:
 * aus 100 wurden 840.
 */
export function marketPriceIndex(market: MarketSeries, base = 100): PriceIndex | null {
  const startTime = monthKeyToUtc(market.start)
  if (startTime === null || market.monthlyReturns.length === 0) return null
  const zeiten = renditeZeiten(market, startTime)
  if (!zeiten) return null

  const bars: IndexBar[] = []
  let kurs = base
  let hoch = base
  for (let i = 0; i < market.monthlyReturns.length; i += 1) {
    const change = market.monthlyReturns[i]
    if (!Number.isFinite(change) || change <= -1) return null
    const open = kurs
    kurs = open * (1 + change)
    hoch = Math.max(hoch, kurs)
    bars.push({ time: zeiten[i], open, close: kurs, change, drawdown: kurs / hoch - 1 })
  }
  return { symbol: market.symbol, startTime, base, bars }
}

/* ------------------------------------------------------- Kurs-Kennzahlen */

export interface MarketStats {
  /** Monate mit Rendite. */
  readonly months: number
  readonly from: UtcSeconds
  readonly to: UtcSeconds
  /** Gesamtrendite: 1.5 heißt +150 %. */
  readonly totalReturn: number
  /** Rendite pro Jahr, geometrisch über die Kalenderspanne. */
  readonly cagr: number
  /** Schwankung pro Jahr: Standardabweichung der Monatsrenditen mal √12. */
  readonly volatility: number
  /** Größter Rückgang vom Hoch, 0 oder negativ. */
  readonly maxDrawdown: number
  readonly drawdownPeak: UtcSeconds
  readonly drawdownTrough: UtcSeconds
  /** Erster Monat zurück auf dem alten Hoch; null, wenn das bis heute nicht geschah. */
  readonly recoveredAt: UtcSeconds | null
  readonly bestMonth: { readonly time: UtcSeconds; readonly change: number }
  readonly worstMonth: { readonly time: UtcSeconds; readonly change: number }
  /** Anteil der Monate mit Gewinn, 0 bis 1. */
  readonly positiveShare: number
}

export function marketStats(index: PriceIndex): MarketStats | null {
  const { bars, base, startTime } = index
  if (bars.length === 0) return null
  const letzte = bars[bars.length - 1]
  const spanne = Math.max(1, monthsBetween(startTime, letzte.time))
  const totalReturn = letzte.close / base - 1

  const renditen = bars.map((b) => b.change)
  const mittel = renditen.reduce((s, r) => s + r, 0) / renditen.length
  const varianz =
    renditen.length > 1 ? renditen.reduce((s, r) => s + (r - mittel) ** 2, 0) / (renditen.length - 1) : 0

  // Tiefster Punkt unter Wasser, dazu das Hoch davor und die Erholung danach.
  let tief = 0
  for (let i = 1; i < bars.length; i += 1) if (bars[i].drawdown < bars[tief].drawdown) tief = i
  const maxDrawdown = Math.min(0, bars[tief].drawdown)
  let hochZeit = startTime
  let erholt: UtcSeconds | null = null
  if (maxDrawdown < 0) {
    for (let i = tief - 1; i >= 0; i -= 1) {
      if (bars[i].drawdown === 0) {
        hochZeit = bars[i].time
        break
      }
    }
    erholt = bars.slice(tief + 1).find((b) => b.drawdown === 0)?.time ?? null
  } else {
    hochZeit = letzte.time
  }

  let beste = bars[0]
  let schlechteste = bars[0]
  for (const b of bars) {
    if (b.change > beste.change) beste = b
    if (b.change < schlechteste.change) schlechteste = b
  }

  return {
    months: bars.length,
    from: startTime,
    to: letzte.time,
    totalReturn,
    cagr: (letzte.close / base) ** (12 / spanne) - 1,
    volatility: Math.sqrt(varianz) * Math.sqrt(12),
    maxDrawdown,
    drawdownPeak: hochZeit,
    drawdownTrough: maxDrawdown < 0 ? bars[tief].time : hochZeit,
    recoveredAt: erholt,
    bestMonth: { time: beste.time, change: beste.change },
    worstMonth: { time: schlechteste.time, change: schlechteste.change },
    positiveShare: bars.filter((b) => b.change > 0).length / bars.length,
  }
}

/* ---------------------------------------------------- Szenario-Kennzahlen */

export interface ScenarioFigures {
  readonly finalValue: number
  readonly contributions: number
  readonly withdrawals: number
  /** Ertrag: Endwert plus Entnahmen minus Einzahlungen. */
  readonly gain: number
  /** Ertrag je eingezahltem Euro; null ohne Einzahlung. */
  readonly gainRatio: number | null
  /** Aus jedem eingezahlten Euro wurden so viele - samt bereits entnommener. */
  readonly multiple: number | null
  /** Jahre bis zur Verdopplung beim festen Zins; null ohne Wachstum. */
  readonly doublingYears: number | null
  /** Endwert in der Kaufkraft von Jahr 0. */
  readonly realFinalValue: number
  readonly years: number
}

/**
 * Was ein Profi zu einem Szenario wissen will, über die Kennzahlenzeile hinaus.
 *
 * `years` ist die Länge der Projektion (Zeilen minus eins), nicht die
 * Ansparphase: die Kaufkraft verliert über die ganze Zeit.
 */
export function scenarioFigures(summary: ProjectionSummary, years: number): ScenarioFigures {
  const { balance, contributions, withdrawals, interest } = summary.final
  const rate = summary.params.annualRate / 100
  const inflation = summary.params.inflationRate / 100
  return {
    finalValue: balance,
    contributions,
    withdrawals,
    gain: interest,
    gainRatio: contributions > 0 ? interest / contributions : null,
    multiple: contributions > 0 ? (balance + withdrawals) / contributions : null,
    doublingYears: rate > 0 ? Math.LN2 / Math.log1p(rate) : null,
    realFinalValue: inflation > -1 ? balance / (1 + inflation) ** Math.max(0, years) : balance,
    years: Math.max(0, years),
  }
}

/**
 * Veränderung zum Vorjahr - die Balken unter der Vermögenskurve.
 *
 * Enthält Einzahlungen und Entnahmen: es ist, was sich im Depot getan hat,
 * nicht die Rendite. Rot heißt dann „es wurde weniger", aus welchem Grund auch
 * immer - in der Entnahmephase genau das, was man sehen will.
 */
export function yearOverYear(values: readonly (number | null)[]): (number | null)[] {
  return values.map((wert, i) => {
    const vorher = i > 0 ? values[i - 1] : null
    return typeof wert === 'number' && typeof vorher === 'number' ? wert - vorher : null
  })
}
