import { AUTO_ENCODING, resolveEncoding, type CapacityReport } from './encoding'
import { simulate } from './domain/math'
import type { SimulationParams } from './domain/parameters'
import { SERIES } from './domain/series'
import type {
  MarketSeries,
  ModelSettings,
  SeriesContext,
  SeriesDefinition,
  SimulationResult,
  YearSnapshot,
} from './domain/types'
import { allocateSlot, slotVar } from './palette'
import { yearLabels } from './timeAxis'

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
  /**
   * Geladene Kursverläufe; ohne sie zeichnet die Kursserie nichts.
   *
   * Mehrere ergeben mehrere Linien - siehe `fanOut` in der Serien-Definition.
   */
  readonly markets?: readonly MarketSeries[]
}

/** Eine Linie im Chart: Serie × Szenario. */
export interface ProjectionLine {
  readonly key: string
  readonly scenarioId: string
  readonly seriesId: string
  /**
   * Fertige deutsche Beschriftung.
   *
   * Zum Übersetzen setzen Anzeige-Komponenten sie aus `seriesId` und
   * `scenarioLabel` neu zusammen - der Kern kennt keine Sprachen und soll
   * auch keine kennen.
   */
  readonly label: string
  readonly scenarioLabel: string | null
  /**
   * Was diese Linie von den anderen derselben Serie unterscheidet - beim
   * Kursverlauf das Tickersymbol. Anzeige-Komponenten hängen es an den
   * übersetzten Seriennamen, damit die Sprache am Kern vorbeigeht.
   */
  readonly variantLabel?: string
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
  /**
   * Beschriftung je Jahres-Index - „12", „mit 42" oder „2007".
   *
   * Einmal berechnet, damit Chart, Tabelle, CSV und Videobild dieselbe Achse
   * beschriften. Ohne das müsste jede Anzeige das Modell selbst auswerten, und
   * die vier liefen früher oder später auseinander.
   */
  readonly yearLabels: readonly string[]
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

/**
 * Eine Serie kann mehrere Linien ergeben.
 *
 * Beim Kursverlauf eine je geladenem Wertpapier. Für alles Weitere - Farbe,
 * Strich, Kapazitätswarnung - zählt jede Variante wie eine eigene Serie; damit
 * braucht keine der nachgelagerten Schichten einen Sonderfall.
 */
interface Linienbauplan {
  readonly series: SeriesDefinition
  readonly market: MarketSeries | null
  readonly variantLabel?: string
  readonly keySuffix: string
  readonly colorVar: string
}

/**
 * Welchen Palette-Slot eine Serie belegt.
 *
 * Serien halten ihre Farbe als fertige CSS-Variable ("var(--chart-2, #eb6834)"),
 * weil sie so direkt als SVG-stroke taugt. Für die Vergabe an Wertpapiere muss
 * die Nummer aber wieder heraus - sonst bekäme ein Kurs dasselbe Orange wie
 * "Ohne Rendite".
 */
function slotAusColorVar(colorVar: string): number | null {
  const treffer = /--chart-(\d+)/.exec(colorVar)
  return treffer ? Number(treffer[1]) : null
}

function expandiere(
  activeSeries: readonly SeriesDefinition[],
  markets: readonly MarketSeries[],
  belegteSlots: readonly number[],
): Linienbauplan[] {
  const vergeben = [...belegteSlots]
  for (const series of activeSeries) {
    if (series.fanOut === 'markets') continue
    const slot = slotAusColorVar(series.colorVar)
    if (slot !== null) vergeben.push(slot)
  }
  return activeSeries.flatMap((series): Linienbauplan[] => {
    const ohneAufteilung: Linienbauplan[] = [
      { series, market: null, keySuffix: '', colorVar: series.colorVar },
    ]
    if (series.fanOut !== 'markets') return ohneAufteilung
    // Ohne geladenen Kurs bleibt es bei einer Linie, die nichts zeichnet -
    // die Serie verschwindet dadurch nicht aus der Legende.
    if (markets.length === 0) return ohneAufteilung

    return markets.map((market) => {
      // Eigene Farbe je Wertpapier, aber nie die eines Szenarios: die Palette
      // hat acht Slots, und eine Wiederholung führte in die Irre.
      const slot = allocateSlot(vergeben)
      if (slot !== null) vergeben.push(slot)
      return {
        series,
        market,
        variantLabel: market.symbol,
        keySuffix: `:${market.symbol}`,
        colorVar: slot === null ? series.colorVar : slotVar(slot),
      }
    })
  })
}

export function buildProjection(input: ProjectionInput): Projection {
  const { scenarios, seriesIds, model } = input
  const markets = input.markets ?? []

  // Registry-Reihenfolge beibehalten - sie hält die Farbzuordnung stabil.
  const activeSeries = SERIES.filter((s) => seriesIds.includes(s.id))
  const comparing = scenarios.length > 1
  const baeume = expandiere(
    activeSeries,
    markets,
    scenarios.map((s) => s.colorSlot),
  )

  // Jede aufgefächerte Linie zählt einzeln: sonst meldete die Kapazität "ok",
  // während zwölf Kurven im Chart stünden.
  const encodingInput = { scenarioCount: scenarios.length, seriesCount: baeume.length }
  const encoding = resolveEncoding(input.encoding ?? AUTO_ENCODING, encodingInput)

  const simulations = new Map<string, SimulationResult>(
    scenarios.map((scenario) => [scenario.id, runSimulation(scenario.params, model)]),
  )

  const lines: ProjectionLine[] = []
  const columns = new Map<string, readonly (number | null)[]>()

  for (const scenario of scenarios) {
    for (const [seriesIndex, bauplan] of baeume.entries()) {
      const { series } = bauplan
      const ctx: SeriesContext = {
        base: simulations.get(scenario.id)!,
        params: scenario.params,
        model,
        market: bauplan.market,
      }
      const key = `${scenario.id}:${series.id}${bauplan.keySuffix}`
      const style = encoding.style(
        {
          scenarioId: scenario.id,
          scenarioColorSlot: scenario.colorSlot,
          seriesId: series.id,
          seriesIndex,
          seriesColorVar: bauplan.colorVar,
        },
        encodingInput,
      )
      const name = bauplan.variantLabel ? `${series.label} ${bauplan.variantLabel}` : series.label
      lines.push({
        key,
        scenarioId: scenario.id,
        seriesId: series.id,
        label: comparing ? `${name} · ${scenario.label}` : name,
        scenarioLabel: comparing ? scenario.label : null,
        variantLabel: bauplan.variantLabel,
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
    yearLabels: yearLabels(rows.length, model),
    summaries,
    retirementYear: model.accumulationYears,
    encodingDescription: encoding.describe(encodingInput),
    capacity: encoding.capacity(encodingInput),
  }
}
