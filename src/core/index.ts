/**
 * Öffentliche API des Kerns.
 *
 * Alles hier läuft ohne React, ohne DOM und ohne Chart-Bibliothek - geprüft
 * vom Wächtertest in `no-react.test.ts`. Damit ist dieselbe Logik aus einem
 * Node-Skript, einem Test oder einem späteren MCP-Server nutzbar.
 *
 * Andere Projekte laden diese Datei als `wealthcurve` (siehe `exports` in
 * package.json) - mit reinem Node, ohne tsx und ohne Build. Deshalb trägt jeder
 * relative Import hier die Endung `.ts`; `node-import.test.ts` wacht darüber.
 *
 * Zwei Einstiege:
 *
 *   buildProjection(input)   einmalige Rechnung, reines JSON rein und raus
 *   createStore(...)         beobachtbarer Zustand für interaktive Oberflächen
 */

// Rechnen
export { buildProjection } from './projection.ts'
export type {
  Projection,
  ProjectionInput,
  ProjectionLine,
  ProjectionRow,
  ProjectionScenario,
  ProjectionSummary,
} from './projection.ts'
export { projectionToCsv } from './csv.ts'

// Domäne
export { DEFAULT_MODEL, MONTHS_PER_YEAR, buildPhases, simulate, toMonthlyRate } from './domain/math.ts'
export type {
  Compounding,
  ContributionTiming,
  MarketSeries,
  ModelSettings,
  Phase,
  PhaseKind,
  SeriesContext,
  SeriesDefinition,
  SimulationConfig,
  SimulationResult,
  YearSnapshot,
} from './domain/types.ts'
export { defineSeries } from './domain/types.ts'

// Kursreihen - Abruf und Datei-Import enden beide hier
export {
  MIN_MONATE,
  marketFromPrices,
  normalizeSymbol,
  parseMarketFile,
  toMonthlyReturns,
} from './market.ts'
export type { MarketMeta, PreisPunkt } from './market.ts'
export { marketMonthOffset } from './timeAxis.ts'

// Registries - hier hängt man Erweiterungen ein
export { DEFAULT_ENABLED_SERIES, SERIES, SERIES_BY_ID } from './domain/series/index.ts'
export {
  DEFAULT_WITHDRAWAL_STRATEGY_ID,
  WITHDRAWAL_STRATEGIES,
  defineWithdrawal,
  resolveWithdrawalStrategy,
} from './domain/withdrawal/index.ts'
export type { WithdrawalStrategy } from './domain/withdrawal/index.ts'
export { AUTO_ENCODING, ENCODINGS, defineEncoding, resolveEncoding } from './encoding/index.ts'
export {
  CHART_STYLES,
  DEFAULT_CHART_STYLE_ID,
  defineChartStyle,
  resolveChartStyle,
} from './chart-style/index.ts'
export type { ChartStyle } from './chart-style/index.ts'
export type { CapacityReport, EncodingStrategy, LineIdentity, LineStyle } from './encoding/index.ts'

// Animation
export {
  DEFAULT_FORMAT_ID,
  DEFAULT_SCENES,
  DEFAULT_SPEC,
  VIDEO_FORMATS,
  easeInOutCubic,
  frameAt,
  frameCount,
  resolveFormat,
  sceneFrames,
  totalSeconds,
} from './animation/index.ts'
export type { AnimationSpec, FrameState, Scene, SceneKind, VideoFormat } from './animation/index.ts'

// Parameter
export {
  DEFAULT_PARAMS,
  PARAMETERS,
  PARAM_IDS,
  TIMELINE_FIELDS,
  TIMELINE_FIELD_IDS,
  sanitizeParam,
  sanitizeTimelineField,
} from './domain/parameters.ts'
export type {
  ParamDefinition,
  ParamGroup,
  ParamId,
  ParamUnit,
  SimulationParams,
  TimelineFieldId,
} from './domain/parameters.ts'

// Zustand
export {
  MAX_SCENARIOS,
  actions,
  createInitialState,
  createScenario,
  deserialize,
  reducer,
  serialize,
} from './state.ts'
export type { Action, AppState, EncodingPreference, Scenario } from './state.ts'
export { createStore } from './store.ts'
export type { Reducer, Store } from './store.ts'
export { createSelectorFactory } from './selectors.ts'
export {
  selectActiveParamIds,
  selectActiveScenario,
  selectChartStyle,
  selectProjection,
  selectVisibleScenarios,
} from './derive.ts'

// Farben
export { SLOT_COUNT, allocateSlot, slotVar } from './palette.ts'
export type { ColorSlot } from './palette.ts'
