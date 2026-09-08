import { AUTO_ENCODING, resolveEncoding, type CapacityReport } from './encoding'
import { simulate } from './domain/math'
import type { SimulationParams } from './domain/parameters'
import { SERIES } from './domain/series'
import type {
  MarketSeries,
  ModelSettings,
  SeriesContext,
  SimulationResult,
  YearSnapshot,
} from './domain/types'

/**
 * Die reine Rechenschicht zwischen Domäne und UI.
 *
 * Kennt weder React noch Recharts: `buildProjection` ist eine Funktion von
 * Eingabe auf Ausgabe und damit auch aus Node, einem Test oder später einem
 * MCP-Server heraus aufrufbar.
 */

export interface ProjectionScenario {
  readonly id: string
  readonly label: string
  readonly params: SimulationParams
  /** Fester Palette-Slot; bestimmt die Farbe, wenn nach Szenario kodiert wird. */
  readonly colorSlot: number
}

export interface ProjectionInput {
  readonly scenarios: readonly ProjectionScenario[]
  readonly seriesIds: readonly string[]
  readonly model: ModelSettings
  /** Kodierung; 'auto' wählt nach Anzahl der Szenarien. */
  readonly encoding?: string
  /** Geladener Kursverlauf; ohne ihn zeichnet die Kursserie nichts. */
  readonly market?: MarketSeries | null
}

/** Eine Linie im Chart: Serie × Szenario. */
export interface ProjectionLine {
  readonly key: string
  readonly scenarioId: string
  readonly seriesId: string
  readonly label: string
  readonly colorVar: string
  /** SVG stroke-dasharray; undefined = durchgezogen. */
  readonly dash?: string
  readonly opacity: number
}

export type ProjectionRow = { year: number } & Record<string, number | null>

export interface ProjectionSummary {
  readonly scenarioId: string
  readonly label: string
  readonly final: YearSnapshot
  /** Depotwert am Ende der Ansparphase. */
  readonly capitalAtRetirement: number
  /** Basisbetrag - bei inflationsbereinigter Eingabe in heutiger Kaufkraft. */
  readonly monthlyWithdrawal: number
  /**
   * Nominal ausgezahlter Betrag im ersten Entnahmejahr.
   *
   * Weicht nur bei inflationsbereinigter Eingabe vom Basisbetrag ab - dann aber
   * deutlich (2 % über 30 Jahre sind rund +81 %), weshalb er ausgewiesen wird.
   */
  readonly monthlyWithdrawalAtStart: number
  /** Erstes Jahr mit leerem Depot, sonst null. */
  readonly depletedAtYear: number | null
}

export interface Projection {
  readonly lines: readonly ProjectionLine[]
  readonly rows: readonly ProjectionRow[]
  readonly summaries: readonly ProjectionSummary[]
  /** Jahr des Phasenwechsels - der Chart markiert es. */
  readonly retirementYear: number
  /** Was Farbe und Strich bedeuten - Text für die Legende. */
  readonly encodingDescription: string
  readonly capacity: CapacityReport
}

const runSimulation = (params: SimulationParams, model: ModelSettings): SimulationResult =>
  simulate({
    annualRatePercent: params.annualRate,
    monthlyContribution: params.monthlyContribution,
    initialCapital: params.initialCapital,
    params,
    model,
  })

export function buildProjection(input: ProjectionInput): Projection {
  const { scenarios, seriesIds, model } = input

  // Registry-Reihenfolge beibehalten - sie hält die Farbzuordnung stabil.
  const activeSeries = SERIES.filter((s) => seriesIds.includes(s.id))
  const comparing = scenarios.length > 1

  const encodingInput = { scenarioCount: scenarios.length, seriesCount: activeSeries.length }
  const encoding = resolveEncoding(input.encoding ?? AUTO_ENCODING, encodingInput)

  const simulations = new Map<string, SimulationResult>(
    scenarios.map((scenario) => [scenario.id, runSimulation(scenario.params, model)]),
  )

  const lines: ProjectionLine[] = []
  const columns = new Map<string, readonly (number | null)[]>()

  for (const scenario of scenarios) {
    const ctx: SeriesContext = {
      base: simulations.get(scenario.id)!,
      params: scenario.params,
      model,
      market: input.market ?? null,
    }
    for (const [seriesIndex, series] of activeSeries.entries()) {
      const key = `${scenario.id}:${series.id}`
      const style = encoding.style(
        {
          scenarioId: scenario.id,
          scenarioColorSlot: scenario.colorSlot,
          seriesId: series.id,
          seriesIndex,
          seriesColorVar: series.colorVar,
        },
        encodingInput,
      )
      lines.push({
        key,
        scenarioId: scenario.id,
        seriesId: series.id,
        label: comparing ? `${series.label} · ${scenario.label}` : series.label,
        colorVar: style.colorVar,
        dash: style.dash,
        opacity: style.opacity,
      })
      columns.set(key, series.compute(ctx))
    }
  }

  // Alle Szenarien teilen die Zeitachse (sie steckt im Modell, nicht in den
  // Szenario-Parametern). Deshalb sind alle Spalten gleich lang und es braucht
  // keine null-Auffüllung - Vergleiche liegen zwangsläufig auf derselben Achse.
  const length = Math.max(1, ...[...columns.values()].map((v) => v.length))

  const rows = Array.from({ length }, (_, index) => {
    const row = { year: index } as ProjectionRow
    for (const [key, values] of columns) {
      row[key] = values[index] ?? null
    }
    return row
  })

  const summaries = scenarios.map((scenario) => {
    const result = simulations.get(scenario.id)!
    return {
      scenarioId: scenario.id,
      label: scenario.label,
      final: result.years.at(-1)!,
      capitalAtRetirement: result.capitalAtRetirement,
      monthlyWithdrawal: result.monthlyWithdrawal,
      monthlyWithdrawalAtStart:
        result.monthlyWithdrawal *
        (model.amountsInflationAdjusted
          ? Math.pow(1 + scenario.params.inflationRate / 100, model.accumulationYears)
          : 1),
      depletedAtYear: result.depletedAtYear,
    }
  })

  return {
    lines,
    rows,
    summaries,
    retirementYear: model.accumulationYears,
    encodingDescription: encoding.describe(encodingInput),
    capacity: encoding.capacity(encodingInput),
  }
}
