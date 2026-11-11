import { sanitizeStartAge, sanitizeStartMonth, sanitizeStartYear } from '../timeAxis.ts'
import { DEFAULT_MODEL } from './math.ts'
import { sanitizeTimelineField, type TimelineFieldId } from './parameters.ts'
import type { Compounding, ContributionTiming, ModelSettings, TimeAxisMode } from './types.ts'
import { WITHDRAWAL_STRATEGIES } from './withdrawal/index.ts'

/** Die erlaubten Beschriftungen der Zeitachse - fuer die Pruefung beim Einlesen. */
export const TIME_AXIS_MODES: readonly TimeAxisMode[] = ['relative', 'age', 'calendar']

const COMPOUNDINGS: readonly Compounding[] = ['monthly-effective', 'monthly-nominal', 'annual']
const TIMINGS: readonly ContributionTiming[] = ['start', 'end']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const oneOf = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/** Zahl oder null; alles andere (String, NaN, Objekt) gilt als "kein Anker". */
const numberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null)

/**
 * Macht aus beliebigem Input gueltige Modell-Einstellungen.
 *
 * Eine einzige Stelle fuer Einlesen (localStorage, geteilte URL, MCP) und
 * Reducer: ein unbekannter `timing`-Wert zaehlte Einzahlungen, ohne sie je zu
 * investieren, und 1e7 Jahre froren den Tab in 1,2e8 Rechenschritten ein.
 * Jedes Feld faellt einzeln auf den Standard zurueck - ein kaputtes Feld
 * verwirft nicht die uebrigen.
 */
export function sanitizeModel(raw: unknown): ModelSettings {
  const m = isRecord(raw) ? raw : {}
  const years = (id: TimelineFieldId): number => {
    const value = m[id]
    return typeof value === 'number' ? sanitizeTimelineField(id, value) : DEFAULT_MODEL[id]
  }
  const strategyId = WITHDRAWAL_STRATEGIES.find((s) => s.id === m.withdrawalStrategyId)?.id

  return {
    compounding: oneOf(COMPOUNDINGS, m.compounding, DEFAULT_MODEL.compounding),
    timing: oneOf(TIMINGS, m.timing, DEFAULT_MODEL.timing),
    accumulationYears: years('accumulationYears'),
    withdrawalYears: years('withdrawalYears'),
    withdrawalStrategyId: strategyId ?? DEFAULT_MODEL.withdrawalStrategyId,
    amountsInflationAdjusted:
      typeof m.amountsInflationAdjusted === 'boolean'
        ? m.amountsInflationAdjusted
        : DEFAULT_MODEL.amountsInflationAdjusted,
    timeAxis: oneOf(TIME_AXIS_MODES, m.timeAxis, DEFAULT_MODEL.timeAxis),
    // Ein geleertes Zahlenfeld liefert NaN: daraus wird null, also "kein Anker".
    // Auch jenseits der Grenzen bleibt nichts stehen - ein Startjahr von 1e9
    // machte jede Achsenbeschriftung unlesbar.
    startAge: sanitizeStartAge(numberOrNull(m.startAge)),
    startYear: sanitizeStartYear(numberOrNull(m.startYear)),
    // Zustaende von vor diesem Feld kennen keinen Monat: Januar.
    startMonth: sanitizeStartMonth(numberOrNull(m.startMonth)),
  }
}
