/**
 * Depot-Analyse: Kennzahlen, Durchschau, Risiko-Hinweise, Was-wäre-wenn.
 *
 * Reiner Kern wie der Rest von `src/core`: Kurse und Fondsbestände kommen von
 * außen herein (Server oder Datei), gerechnet wird hier.
 */
export { EMPTY_DEPOT, HOLDING_KINDS, MAX_HOLDINGS } from './types.ts'
export type { DepotHolding, DepotState, FundHoldings, FundPosition, HoldingKind, StockProfile } from './types.ts'
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
  INDEX_PREFIX,
  NON_EQUITY_KEYS,
  NO_LOOKTHROUGH,
  SECTORS,
  SIZE_LIMITS_USD,
  computeLookThrough,
  filterCountries,
  indexMatchFor,
  issuerKey,
  issuerName,
  lookThroughIsins,
} from './lookthrough.ts'
export type {
  CompanyExposure,
  Continent,
  CountryInfo,
  LookSource,
  LookThrough,
  Market,
  Share,
  SizeId,
} from './lookthrough.ts'
export { INDEX_TEMPLATES, WORLD_PROXY, indexTemplate, matchIndex } from './indices.ts'
export type { IndexId, IndexMatch, IndexTemplate } from './indices.ts'
export { commodityFromName, holdingFixes, inferredPatch, kindFromName, leverageFromName } from './classify.ts'
export { FLAG_LIMITS, depotFlags } from './flags.ts'
export type { DepotFlag, FlagId } from './flags.ts'
export { sanitizeDepot } from './sanitize.ts'
export { readXlsxRows, rowsToText } from './xlsx.ts'
