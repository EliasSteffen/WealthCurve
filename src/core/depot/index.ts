/**
 * Depot-Analyse: Kennzahlen, Durchschau, Risiko-Hinweise, Was-wäre-wenn.
 *
 * Reiner Kern wie der Rest von `src/core`: Kurse und Fondsbestände kommen von
 * außen herein (Server oder Datei), gerechnet wird hier.
 */
export { EMPTY_DEPOT, HOLDING_KINDS, MAX_HOLDINGS } from './types.ts'
export type { DepotHolding, DepotState, FundHoldings, FundPosition, HoldingKind } from './types.ts'
export { parseDepotText, parseNumber, productId, serializeDepot, withResolvedSymbols } from './parse.ts'
export type { ParseIssue, ParseResult } from './parse.ts'
export {
  WINDOW_YEARS,
  computeDepotStats,
  fxSymbol,
  isWindowStats,
  normalizeCurrency,
  scenarioRate,
  withWeights,
} from './metrics.ts'
export type { DepotStats, HoldingStats, WindowGap, WindowStats } from './metrics.ts'
export {
  COUNTRIES,
  SECTORS,
  SIZE_LIMITS_USD,
  computeLookThrough,
  filterCountries,
  issuerName,
} from './lookthrough.ts'
export type {
  CompanyExposure,
  Continent,
  CountryInfo,
  LookThrough,
  Market,
  Share,
  SizeId,
} from './lookthrough.ts'
export { FLAG_LIMITS, depotFlags } from './flags.ts'
export type { DepotFlag, FlagId } from './flags.ts'
export { sanitizeDepot } from './sanitize.ts'
export { readXlsxRows, rowsToText } from './xlsx.ts'
