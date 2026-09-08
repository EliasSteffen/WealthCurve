import { selectActiveParamIds, selectActiveScenario, selectProjection } from '../../core/derive'
import { actions } from '../../core/state'
import { useDispatch, useSelector } from '../../react/useSelector'
import { ChartStyleControl, ModelSettings, WithdrawalRuleControl } from '../ModelSettings'
import { ParameterPanel } from '../ParameterPanel'
import { ScenarioList } from '../ScenarioList'
import { SeriesPanel } from '../SeriesPanel'

/**
 * Der komplette Einstellungsbereich - genau einmal definiert.
 *
 * Wird je nach Viewport in einen anderen Container gehängt (Sidebar auf dem
 * Desktop, Bottom-Sheet auf Mobil). Der Inhalt weiß davon nichts, deshalb gibt
 * es ihn nicht zweimal zu pflegen.
 */
export function SettingsPanel() {
  const dispatch = useDispatch()
  const scenarios = useSelector((s) => s.scenarios)
  const activeScenarioId = useSelector((s) => s.activeScenarioId)
  const enabledSeriesIds = useSelector((s) => s.enabledSeriesIds)
  const model = useSelector((s) => s.model)
  const chartStyleId = useSelector((s) => s.chartStyleId)
  const activeScenario = useSelector(selectActiveScenario)
  const activeParamIds = useSelector(selectActiveParamIds)
  const capacity = useSelector(selectProjection).capacity

  return (
    <div className="space-y-4">
      <ScenarioList scenarios={scenarios} activeScenarioId={activeScenarioId} />

      <ParameterPanel
        params={activeScenario.params}
        activeParamIds={activeParamIds}
        onChange={(id, value) => dispatch(actions.setParam(activeScenario.id, id, value))}
        groupExtras={{
          entnahme: (
            <WithdrawalRuleControl
              value={model}
              onChange={(next) => dispatch(actions.setModel(next))}
            />
          ),
        }}
      />

      <SeriesPanel
        enabledSeriesIds={enabledSeriesIds}
        onToggle={(id) => dispatch(actions.toggleSeries(id))}
        capacity={capacity}
      />

      <ChartStyleControl
        value={chartStyleId}
        onChange={(id) => dispatch(actions.setChartStyle(id))}
      />

      <ModelSettings value={model} onChange={(next) => dispatch(actions.setModel(next))} />
    </div>
  )
}
