import { resolveChartStyle } from './chart-style'
import { SERIES } from './domain/series'
import type { ParamId } from './domain/parameters'
import { resolveWithdrawalStrategy } from './domain/withdrawal'
import { buildProjection, type Projection } from './projection'
import { createSelectorFactory } from './selectors'
import type { AppState } from './state'

const createSelector = createSelectorFactory<AppState>()

/**
 * Die abgeleiteten Sichten auf den State.
 *
 * Alle memoisiert - bei unverändertem State kommt dieselbe Referenz zurück,
 * was `useSyncExternalStore` zwingend voraussetzt.
 */

export const selectVisibleScenarios = createSelector(
  [(s: AppState) => s.scenarios],
  (scenarios) => scenarios.filter((scenario) => scenario.visible),
)

export const selectProjection = createSelector(
  [
    selectVisibleScenarios,
    (s: AppState) => s.enabledSeriesIds,
    (s: AppState) => s.model,
    (s: AppState) => s.encoding,
    (s: AppState) => s.markets,
  ],
  (scenarios, seriesIds, model, encoding, markets): Projection =>
    buildProjection({
      scenarios: scenarios.map((s) => ({
        id: s.id,
        label: s.label,
        params: s.params,
        colorSlot: s.colorSlot,
      })),
      seriesIds,
      model,
      encoding,
      markets,
    }),
)

/**
 * Welche Parameter gerade überhaupt etwas bewirken.
 *
 * Entscheidet, ob ein Regler gezeigt wird, nicht nur wie er aussieht: das
 * ParameterPanel blendet alles aus, was hier fehlt. Ein Regler, der nichts
 * ändert, ist irreführender als ein fehlender - man dreht daran und wartet
 * vergeblich auf eine Wirkung.
 *
 * Wird eine Karte dadurch leer, erklärt die Karte das (siehe `emptyHint`),
 * statt spurlos zu verschwinden.
 */
export const selectActiveParamIds = createSelector(
  [(s: AppState) => s.enabledSeriesIds, (s: AppState) => s.model],
  (enabledSeriesIds, model) =>
    new Set<ParamId>([
      ...SERIES.filter((s) => enabledSeriesIds.includes(s.id)).flatMap((s) => s.requiredParams),
      // Die aktive Entnahmeregel bestimmt mit, welcher Entnahme-Regler zählt.
      ...(model.withdrawalYears > 0
        ? resolveWithdrawalStrategy(model.withdrawalStrategyId).requiredParams
        : []),
    ]),
)

export const selectChartStyle = createSelector(
  [(s: AppState) => s.chartStyleId],
  resolveChartStyle,
)

export const selectActiveScenario = createSelector(
  [(s: AppState) => s.scenarios, (s: AppState) => s.activeScenarioId],
  (scenarios, activeId) => scenarios.find((s) => s.id === activeId) ?? scenarios[0],
)
