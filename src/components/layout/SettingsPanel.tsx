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
import { useT } from '../../react/localeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import {
  ChartStyleControl,
  CompoundingControl,
  InflationAmountsControl,
  TimeAxisControls,
  TimelineControls,
  TimingControl,
  WithdrawalRuleControl,
} from '../ModelSettings'
import { MarketPanel } from '../MarketPanel'
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

  const t = useT()
  const [query, setQuery] = useState('')
  // Aus dem Store, nicht aus lokalem State: das Bottom-Sheet montiert dieses
  // Panel bei jedem Öffnen neu und hätte den Zustand sonst jedes Mal vergessen.
  const zu = useSelector((s) => s.collapsedCategories)

  const index = useMemo(() => buildSettingsIndex(), [])
  const matches = useMemo(() => matchSettings(index, query), [index, query])
  const sichtbareKategorien = useMemo(
    () => matchingCategories(index, matches),
    [index, matches],
  )

  const setModel = (next: typeof model) => dispatch(actions.setModel(next))

  const regler = (category: SettingsCategoryId) => (
    <ParameterPanel
      category={category}
      params={activeScenario.params}
      activeParamIds={activeParamIds}
      matches={matches}
      onChange={(id, value) => dispatch(actions.setParam(activeScenario.id, id, value))}
    />
  )

  const inhalte: Record<SettingsCategoryId, ReactNode> = {
    szenarien:
      matches === null || matches.has('scenarios') ? (
        <ScenarioList scenarios={scenarios} activeScenarioId={activeScenarioId} />
      ) : null,
    generell: (
      <div className="space-y-5">
        {regler('generell')}
        <CompoundingControl value={model} onChange={setModel} matches={matches} />
        <InflationAmountsControl value={model} onChange={setModel} matches={matches} />
        <TimeAxisControls value={model} onChange={setModel} matches={matches} />
      </div>
    ),
    einzahlung: (
      <div className="space-y-5">
        {regler('einzahlung')}
        <TimelineControls
          category="einzahlung"
          value={model}
          onChange={setModel}
          matches={matches}
        />
        <TimingControl value={model} onChange={setModel} matches={matches} />
      </div>
    ),
    auszahlung: (
      <div className="space-y-5">
        {/* Die Regel steht über den Beträgen: sie entscheidet, welcher der
            beiden Regler überhaupt zählt. */}
        {matches === null || matches.has('model:withdrawalRule') ? (
          <WithdrawalRuleControl value={model} onChange={setModel} />
        ) : null}
        {regler('auszahlung')}
        <TimelineControls
          category="auszahlung"
          value={model}
          onChange={setModel}
          matches={matches}
        />
      </div>
    ),
    kurven: (
      <div className="space-y-5">
        <SeriesPanel
          enabledSeriesIds={enabledSeriesIds}
          onToggle={(id) => dispatch(actions.toggleSeries(id))}
          capacity={capacity}
          matches={matches}
        />
        <MarketPanel matches={matches} />
        <ChartStyleControl
          value={chartStyleId}
          onChange={(id) => dispatch(actions.setChartStyle(id))}
          matches={matches}
        />
      </div>
    ),
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
          placeholder={t('settings.search', 'Einstellung suchen …')}
          aria-label={t('settings.search', 'Einstellung suchen …')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] py-2 pl-8 pr-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--chart-1)] focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('settings.clearSearch', 'Suche leeren')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={13} aria-hidden />
          </button>
        ) : null}
      </div>

      {leer ? (
        <p className="px-1 py-6 text-center text-xs text-[var(--text-muted)]">
          {t('settings.empty', `Nichts gefunden für „${query}“.`, { query })}
        </p>
      ) : null}

      {SETTINGS_CATEGORIES.map((kategorie) => {
        if (!sichtbareKategorien.has(kategorie.id)) return null
        const inhalt = inhalte[kategorie.id]
        if (!inhalt) return null
        // Bei aktiver Suche immer offen - sonst müsste man den Treffer erst aufklappen.
        const offen = matches !== null || !zu.includes(kategorie.id)

        return (
          <Card key={kategorie.id} padded={false}>
            <button
              type="button"
              onClick={() => dispatch(actions.toggleSettingsCategory(kategorie.id))}
              aria-expanded={offen}
              disabled={matches !== null}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left disabled:cursor-default"
            >
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {t(`category.${kategorie.id}.label`, kategorie.label)}
                </span>
                {!offen ? (
                  <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                    {t(`category.${kategorie.id}.hint`, kategorie.hint)}
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
