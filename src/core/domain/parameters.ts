/**
 * Das Parameter-Registry.
 *
 * Konvention: Prozentwerte werden als PROZENTPUNKTE gespeichert.
 * `annualRate: 7` bedeutet 7 % p. a. - nicht 0.07. Die Umrechnung in einen
 * Dezimalzins passiert ausschließlich in `toMonthlyRate()`.
 *
 * Ein neuer Parameter hier genuegt: Regler, Label und Formatierung ziehen
 * automatisch nach, weil das ParameterPanel über dieses Objekt iteriert.
 */

export type ParamUnit = 'currency' | 'percent' | 'years'
/** Basis = immer relevant. Annahmen = modellabhängig, nur für manche Serien. */
export type ParamGroup = 'basis' | 'entnahme' | 'annahmen'

export interface ParamDefinition {
  readonly label: string
  readonly hint?: string
  readonly unit: ParamUnit
  readonly min: number
  readonly max: number
  readonly step: number
  readonly defaultValue: number
  readonly group: ParamGroup
}

export const PARAMETERS = {
  monthlyContribution: {
    label: 'Monatliche Sparrate',
    unit: 'currency',
    min: 0,
    max: 2_000,
    step: 25,
    defaultValue: 500,
    group: 'basis',
  },
  annualRate: {
    label: 'Rendite p. a.',
    hint: 'Effektive Jahresrendite nach Kosten.',
    unit: 'percent',
    min: -5,
    max: 15,
    step: 0.1,
    defaultValue: 7,
    group: 'basis',
  },
  initialCapital: {
    label: 'Startkapital',
    unit: 'currency',
    min: 0,
    max: 250_000,
    step: 500,
    defaultValue: 0,
    group: 'basis',
  },
  inflationRate: {
    label: 'Inflation p. a.',
    hint: 'Zinst den Depotwert auf heutige Kaufkraft ab.',
    unit: 'percent',
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 2,
    group: 'annahmen',
  },
  monthlyWithdrawal: {
    label: 'Monatliche Entnahme',
    hint: 'Fester Betrag, der in der Entnahmephase abfließt.',
    unit: 'currency',
    min: 0,
    max: 10_000,
    step: 100,
    defaultValue: 2_000,
    group: 'entnahme',
  },
  withdrawalRate: {
    label: 'Entnahmerate p. a.',
    hint: 'Anteil des Depotwerts bei Rentenbeginn, auf Monate verteilt.',
    unit: 'percent',
    min: 0,
    max: 12,
    step: 0.1,
    defaultValue: 4,
    group: 'entnahme',
  },
  savingsRate: {
    label: 'Tagesgeldzins p. a.',
    hint: 'Vergleichszins für das Tagesgeldkonto.',
    unit: 'percent',
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: 2,
    group: 'annahmen',
  },
} as const satisfies Record<string, ParamDefinition>

/** Aus dem Registry abgeleitet - ein Tippfehler in `requiredParams` bricht den Build. */
export type ParamId = keyof typeof PARAMETERS
export type SimulationParams = Readonly<Record<ParamId, number>>

export const PARAM_IDS = Object.keys(PARAMETERS) as ParamId[]

export const DEFAULT_PARAMS: SimulationParams = Object.fromEntries(
  PARAM_IDS.map((id) => [id, PARAMETERS[id].defaultValue]),
) as SimulationParams

/**
 * Jeder Schreibzugriff laeuft hier durch.
 *
 * Ein geleertes <input type="number"> liefert NaN. Ohne diesen Filter wandert das
 * NaN durch die Simulation und der Chart wird leer - ohne Fehlermeldung.
 */
export function sanitizeParam(id: ParamId, value: number): number {
  const { min, max, defaultValue } = PARAMETERS[id]
  if (!Number.isFinite(value)) return defaultValue
  return Math.min(max, Math.max(min, value))
}

/**
 * Die Zeitachse ist global, nicht Teil eines Szenarios - deshalb steht sie
 * neben PARAMETERS und nicht darin. Sie nutzt dieselbe Definition, damit im UI
 * derselbe Regler greift.
 */
export const TIMELINE_FIELDS = {
  accumulationYears: {
    label: 'Ansparphase',
    hint: 'Bis hierhin wird eingezahlt.',
    unit: 'years',
    min: 0,
    max: 60,
    step: 1,
    defaultValue: 30,
    group: 'basis',
  },
  withdrawalYears: {
    label: 'Entnahmephase',
    hint: 'Danach wird entnommen, der Rest arbeitet weiter.',
    unit: 'years',
    min: 0,
    max: 50,
    step: 1,
    defaultValue: 25,
    group: 'basis',
  },
} as const satisfies Record<string, ParamDefinition>

export type TimelineFieldId = keyof typeof TIMELINE_FIELDS
export const TIMELINE_FIELD_IDS = Object.keys(TIMELINE_FIELDS) as TimelineFieldId[]

/** Clamping für die Zeitachse - gleiche Schutzlogik wie sanitizeParam. */
export function sanitizeTimelineField(id: TimelineFieldId, value: number): number {
  const { min, max, defaultValue } = TIMELINE_FIELDS[id]
  if (!Number.isFinite(value)) return defaultValue
  return Math.round(Math.min(max, Math.max(min, value)))
}
