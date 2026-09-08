import { Search, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { selectActiveParamIds, selectActiveScenario, selectProjection } from '../../core/derive'
import {
  SETTINGS_CATEGORIES,
  buildSettingsIndex,
  matchSettings,
  matchingCategories,
  type SettingsCategoryId,
} from '../../core/settings'
import { actions } from '../../core/state'
import { cn } from '../../lib/cn'
import { useDispatch, useSelector } from '../../react/useSelector'
import {
  CalculationControls,
  ChartStyleControl,
  TimelineControls,
  WithdrawalRuleControl,
} from '../ModelSettings'
import { ParameterPanel } from '../ParameterPanel'
import { ScenarioList } from '../ScenarioList'
import { SeriesPanel } from '../SeriesPanel'
import { Card } from '../ui/Card'

/**
 * Der komplette Einstellungsbereich - genau einmal definiert.
 *
 * Wird je nach Viewport in einen anderen Container gehängt (Seitenspalte auf
 * dem Desktop, Bottom-Sheet auf Mobil). Der Inhalt weiß davon nichts.
 *
 * Gegliedert in Kategorien mit Suche darüber. Der Suchindex kommt aus den
 * Registries (siehe core/settings), nicht aus einer Handpflege - eine neue
 * Serie oder ein neuer Parameter ist damit sofort auffindbar.
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

  const [query, setQuery] = useState('')
  const [zu, setZu] = useState<ReadonlySet<SettingsCategoryId>>(new Set())

  const index = useMemo(() => buildSettingsIndex(), [])
  const matches = useMemo(() => matchSettings(index, query), [index, query])
  const sichtbareKategorien = useMemo(
    () => matchingCategories(index, matches),
    [index, matches],
  )

  const setModel = (next: typeof model) => dispatch(actions.setModel(next))

  const inhalte: Record<SettingsCategoryId, ReactNode> = {
    szenarien:
      matches === null || matches.has('scenarios') ? (
        <ScenarioList scenarios={scenarios} activeScenarioId={activeScenarioId} />
      ) : null,
    werte: (
      <ParameterPanel
        params={activeScenario.params}
        activeParamIds={activeParamIds}
        matches={matches}
        onChange={(id, value) => dispatch(actions.setParam(activeScenario.id, id, value))}
        groupExtras={{
          entnahme: <WithdrawalRuleControl value={model} onChange={setModel} />,
        }}
      />
    ),
    zeitraum: <TimelineControls value={model} onChange={setModel} matches={matches} />,
    kurven: (
      <div className="space-y-5">
        <SeriesPanel
          enabledSeriesIds={enabledSeriesIds}
          onToggle={(id) => dispatch(actions.toggleSeries(id))}
          capacity={capacity}
          matches={matches}
        />
        <ChartStyleControl
          value={chartStyleId}
          onChange={(id) => dispatch(actions.setChartStyle(id))}
          matches={matches}
        />
      </div>
    ),
    berechnung: <CalculationControls value={model} onChange={setModel} matches={matches} />,
  }

  const leer = sichtbareKategorien.size === 0

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Einstellung suchen …"
          aria-label="Einstellungen durchsuchen"
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] py-2 pl-8 pr-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--chart-1)] focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Suche leeren"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={13} aria-hidden />
          </button>
        ) : null}
      </div>

      {leer ? (
        <p className="px-1 py-6 text-center text-xs text-[var(--text-muted)]">
          Nichts gefunden für „{query}“.
        </p>
      ) : null}

      {SETTINGS_CATEGORIES.map((kategorie) => {
        if (!sichtbareKategorien.has(kategorie.id)) return null
        const inhalt = inhalte[kategorie.id]
        if (!inhalt) return null
        // Bei aktiver Suche immer offen - sonst müsste man den Treffer erst aufklappen.
        const offen = matches !== null || !zu.has(kategorie.id)

        return (
          <Card key={kategorie.id} className="p-0">
            <button
              type="button"
              onClick={() =>
                setZu((prev) => {
                  const next = new Set(prev)
                  if (next.has(kategorie.id)) next.delete(kategorie.id)
                  else next.add(kategorie.id)
                  return next
                })
              }
              aria-expanded={offen}
              disabled={matches !== null}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left disabled:cursor-default"
            >
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {kategorie.label}
                </span>
                {!offen ? (
                  <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                    {kategorie.hint}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden
                className={cn(
                  'shrink-0 text-[var(--text-muted)] transition-transform',
                  offen ? 'rotate-90' : '',
                )}
              >
                ›
              </span>
            </button>
            {offen ? <div className="px-4 pb-4">{inhalt}</div> : null}
          </Card>
        )
      })}
    </div>
  )
}
