import type { ParamId, SimulationParams } from './parameters'

/** Wie der Jahreszins auf die Perioden verteilt wird. */
export type Compounding = 'monthly-effective' | 'monthly-nominal' | 'annual'
/** Sparrate am Perioden-Anfang (vorschüssig) oder -Ende (nachschüssig). */
export type ContributionTiming = 'start' | 'end'

/** Ansparen oder entnehmen - das Vorzeichen des Zahlungsstroms. */
export type PhaseKind = 'accumulate' | 'withdraw'

export interface Phase {
  readonly kind: PhaseKind
  readonly months: number
  /** Immer positiv; die Richtung ergibt sich aus `kind`. */
  readonly monthlyAmount: number
}

/**
 * Global geltende Einstellungen.
 *
 * Die Zeitachse gehört bewusst hierher und nicht zu den Szenario-Parametern:
 * alle Szenarien teilen denselben Zeitraum, sonst vergleicht man Kurven auf
 * unterschiedlichen X-Achsen.
 */
export interface ModelSettings {
  readonly compounding: Compounding
  readonly timing: ContributionTiming
  readonly accumulationYears: number
  readonly withdrawalYears: number
  readonly withdrawalStrategyId: string
}

export interface SimulationConfig {
  /** Prozentpunkte, z. B. 7 für 7 % p. a. */
  readonly annualRatePercent: number
  readonly monthlyContribution: number
  readonly initialCapital: number
  /** Die Entnahmestrategie liest ihre Parameter hieraus. */
  readonly params: SimulationParams
  readonly model: ModelSettings
}

export interface YearSnapshot {
  readonly year: number
  /** Depotwert am Jahresende. */
  readonly balance: number
  /** Kumuliert eingezahlt, inklusive Startkapital. */
  readonly contributions: number
  /** Kumuliert entnommen. */
  readonly withdrawals: number
  /** balance - contributions + withdrawals. */
  readonly interest: number
  readonly phase: PhaseKind
}

export interface SimulationResult {
  readonly years: readonly YearSnapshot[]
  /** Depotwert am Ende der Ansparphase - Bezugsgröße der Prozentregel. */
  readonly capitalAtRetirement: number
  /** Tatsächlich entnommener Monatsbetrag, aus der Strategie ermittelt. */
  readonly monthlyWithdrawal: number
  /** Erstes Jahr mit leerem Depot, sonst null. */
  readonly depletedAtYear: number | null
}

/**
 * Was eine Serie zum Rechnen bekommt.
 *
 * `base` ist EINE Simulation, die sich alle Serien teilen. Serien sehen einander
 * nicht - dadurch sind Abhängigkeiten zwischen Serien strukturell unmöglich
 * und es kann keine Zyklen geben.
 */
export interface SeriesContext {
  readonly base: SimulationResult
  readonly params: SimulationParams
  readonly model: ModelSettings
}

export interface SeriesDefinition {
  readonly id: string
  readonly label: string
  readonly description: string
  /** Fester Palette-Slot pro Serie, inkl. Fallback: "var(--chart-1, #2a78d6)". */
  readonly colorVar: string
  /**
   * Einheit der Werte. Alle Serien im selben Chart müssen dieselbe Einheit
   * haben - eine zweite Y-Achse ist bewusst nicht vorgesehen, weil zwei Skalen
   * auf einem Plot eine Korrelation suggerieren, die in den Daten nicht steht.
   */
  readonly unit: 'currency'
  readonly defaultEnabled: boolean
  /** Steuert, welche Regler als aktiv hervorgehoben werden. */
  readonly requiredParams: readonly ParamId[]
  /** Muss exakt `base.years.length` Werte liefern, index-aligned. */
  readonly compute: (ctx: SeriesContext) => readonly number[]
}

/** Bewahrt die String-Literale, ohne dass jede Serien-Datei `as const` braucht. */
export const defineSeries = <const T extends SeriesDefinition>(series: T): T => series
