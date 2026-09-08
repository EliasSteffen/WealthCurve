/**
 * Öffentliche API des Kerns.
 *
 * Alles hier läuft ohne React, ohne DOM und ohne Chart-Bibliothek - geprüft
 * vom Wächtertest in `no-react.test.ts`. Damit ist dieselbe Logik aus einem
 * Node-Skript, einem Test oder einem späteren MCP-Server nutzbar.
 *
 * Zwei Einstiege:
 *
 *   buildProjection(input)   einmalige Rechnung, reines JSON rein und raus
 *   createStore(...)         beobachtbarer Zustand für interaktive Oberflächen
 */

// Rechnen
export { buildProjection } from './projection'
export type {
  Projection,
  ProjectionInput,
  ProjectionLine,
  ProjectionRow,
  ProjectionScenario,
  ProjectionSummary,
} from './projection'
export { projectionToCsv } from './csv'

// Domäne
export { DEFAULT_MODEL, MONTHS_PER_YEAR, buildPhases, simulate, toMonthlyRate } from './domain/math'
export type {
  Compounding,
  ContributionTiming,
  ModelSettings,
  Phase,
  PhaseKind,
  SeriesContext,
  SeriesDefinition,
  SimulationConfig,
  SimulationResult,
  YearSnapshot,
} from './domain/types'
export { defineSeries } from './domain/types'

// Registries - hier hängt man Erweiterungen ein
export { DEFAULT_ENABLED_SERIES, SERIES, SERIES_BY_ID } from './domain/series'
export {
  DEFAULT_WITHDRAWAL_STRATEGY_ID,
  WITHDRAWAL_STRATEGIES,
  defineWithdrawal,
  resolveWithdrawalStrategy,
} from './domain/withdrawal'
export type { WithdrawalStrategy } from './domain/withdrawal'
export { AUTO_ENCODING, ENCODINGS, defineEncoding, resolveEncoding } from './encoding'
export type { CapacityReport, EncodingStrategy, LineIdentity, LineStyle } from './encoding'

// Parameter
export {
  DEFAULT_PARAMS,
  PARAMETERS,
  PARAM_IDS,
  TIMELINE_FIELDS,
  TIMELINE_FIELD_IDS,
  sanitizeParam,
  sanitizeTimelineField,
} from './domain/parameters'
export type {
  ParamDefinition,
  ParamGroup,
  ParamId,
  ParamUnit,
  SimulationParams,
  TimelineFieldId,
} from './domain/parameters'

// Zustand
export {
  MAX_SCENARIOS,
  actions,
  createInitialState,
  createScenario,
  deserialize,
  reducer,
  serialize,
} from './state'
export type { Action, AppState, EncodingPreference, Scenario } from './state'
export { createStore } from './store'
export type { Reducer, Store } from './store'
export { createSelectorFactory } from './selectors'
export {
  selectActiveParamIds,
  selectActiveScenario,
  selectProjection,
  selectVisibleScenarios,
} from './derive'

// Farben
export { SLOT_COUNT, allocateSlot, slotVar } from './palette'
export type { ColorSlot } from './palette'
