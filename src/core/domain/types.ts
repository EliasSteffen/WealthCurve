import type { ParamId, SimulationParams } from './parameters.ts'

/** Wie der Jahreszins auf die Perioden verteilt wird. */
export type Compounding = 'monthly-effective' | 'monthly-nominal' | 'annual'
/** Sparrate am Perioden-Anfang (vorschüssig) oder -Ende (nachschüssig). */
export type ContributionTiming = 'start' | 'end'

/** Ansparen oder entnehmen - das Vorzeichen des Zahlungsstroms. */
export type PhaseKind = 'accumulate' | 'withdraw'

/**
 * Wie die Zeitachse beschriftet wird.
 *
 * Reine Anzeige: `year` bleibt in jeder Serie ein Index ab 0, die Rechnung
 * kennt weder Alter noch Kalender. Sonst müsste jede Serie davon wissen, und
 * ein Umschalten der Beschriftung änderte plötzlich Zahlen.
 *
 * Eine Ausnahme gibt es: der Kursverlauf braucht den Kalender wirklich, weil
 * echte Renditen an echten Monaten hängen - siehe `startYear`.
 */
export type TimeAxisMode = 'relative' | 'age' | 'calendar'

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
  /**
   * Gelten die eingetragenen Spar- und Auszahlbeträge als heutige Kaufkraft?
   * Wenn ja, wachsen sie nominal jährlich mit der Inflationsrate mit.
   */
  readonly amountsInflationAdjusted: boolean
  /** Beschriftung der Zeitachse - ändert keine Zahl. */
  readonly timeAxis: TimeAxisMode
  /**
   * Alter zu Beginn der Ansparphase; null = keine Altersangabe.
   *
   * Macht aus „Jahr 35" ein „mit 65" und damit den Rentenbeginn greifbar.
   */
  readonly startAge: number | null
  /**
   * Kalenderjahr, in dem die Ansparphase beginnt; null = kein Kalenderbezug.
   *
   * Für den Kursverlauf mehr als Kosmetik: echte Monatsrenditen hängen an
   * echten Monaten. Ohne Anker hieße „Apple als Vergleich" stillschweigend
   * „ab dem Tag, an dem Yahoos Historie zufällig beginnt" - und niemand kann
   * vorwärts wissen, wie sich ein Kurs entwickelt. Ohne Startjahr zeichnet die
   * Kursserie deshalb nichts.
   */
  readonly startYear: number | null
  /**
   * Monat (1-12), in dem die Ansparphase im Startjahr beginnt; 1 = Januar.
   *
   * Zählt nur für den Kursverlauf: „vor genau zehn Jahren" heißt selten
   * Januar. Die Achse bleibt in ganzen Jahren ab diesem Monat.
   */
  readonly startMonth: number
}

export interface SimulationConfig {
  /** Prozentpunkte, z. B. 7 für 7 % p. a. */
  readonly annualRatePercent: number
  readonly monthlyContribution: number
  readonly initialCapital: number
  /** Die Entnahmestrategie liest ihre Parameter hieraus. */
  readonly params: SimulationParams
  readonly model: ModelSettings
  /**
   * Erzwingt einen Entnahmebetrag, statt ihn aus der Strategie abzuleiten.
   * Nötig für Vergleichsserien, die denselben Auszahlplan abbilden sollen.
   */
  readonly monthlyWithdrawalOverride?: number
  /**
   * Rendite je Periode, wenn sie nicht konstant ist - für echte Kursverläufe.
   * Der Index zählt Perioden ab Simulationsbeginn. Fehlt die Funktion, gilt
   * der feste Zins aus `annualRatePercent`.
   */
  readonly rateAt?: (periodIndex: number) => number
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
/** Ein echter Kursverlauf, auf Monatsrenditen normalisiert. */
export interface MarketSeries {
  readonly symbol: string
  readonly name: string
  readonly currency: string
  readonly start: string
  /** 0.012 bedeutet +1,2 % in diesem Monat. */
  readonly monthlyReturns: readonly number[]
}

export interface SeriesContext {
  readonly base: SimulationResult
  readonly params: SimulationParams
  readonly model: ModelSettings
  /** Geladener Kursverlauf, falls einer gewählt wurde. */
  readonly market?: MarketSeries | null
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
  /**
   * Eine Linie je geladenem Wertpapier statt einer einzigen.
   *
   * Die Registry bleibt dadurch statisch - `buildProjection` ruft `compute`
   * einmal pro Kurs auf und setzt jeweils `ctx.market`. Ohne das müsste für
   * jedes Wertpapier eine eigene Serie erfunden werden, und die feste
   * Farbzuordnung der Registry ginge verloren.
   */
  readonly fanOut?: 'markets'
  /**
   * Muss exakt `base.years.length` Werte liefern, index-aligned.
   *
   * `null` heisst "fuer dieses Jahr gibt es keinen Wert" - etwa wenn ein
   * Kursverlauf frueher endet als die Simulation. Das ist etwas anderes als
   * der Wert 0 und wird im Chart als Luecke gezeichnet, nicht als Absturz
   * auf die Nulllinie.
   */
  readonly compute: (ctx: SeriesContext) => readonly (number | null)[]
}

/** Bewahrt die String-Literale, ohne dass jede Serien-Datei `as const` braucht. */
export const defineSeries = <const T extends SeriesDefinition>(series: T): T => series
