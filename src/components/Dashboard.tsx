import { selectProjection } from '../core/derive'
import { actions } from '../core/state'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTheme } from '../hooks/useTheme'
import { useDispatch, useSelector } from '../react/useSelector'
import { ChartLegend } from './chart/ChartLegend'
import { GrowthChart } from './chart/GrowthChart'
import { DataTable } from './DataTable'
import { SettingsSheet } from './layout/SettingsSheet'
import { Sidebar } from './layout/Sidebar'
import { SummaryStats } from './SummaryStats'
import { ThemeToggle } from './ThemeToggle'
import { Card } from './ui/Card'

/** Ab hier steht genug Platz für eine dauerhaft sichtbare Seitenspalte. */
const DESKTOP = '(min-width: 1024px)'

export function Dashboard() {
  const { theme, setTheme } = useTheme()
  const dispatch = useDispatch()
  const isDesktop = useMediaQuery(DESKTOP)

  const activeScenarioId = useSelector((s) => s.activeScenarioId)
  const enabledSeriesIds = useSelector((s) => s.enabledSeriesIds)
  const model = useSelector((s) => s.model)
  const collapsed = useSelector((s) => s.sidebarCollapsed)
  const scenarios = useSelector((s) => s.scenarios)
  const projection = useSelector(selectProjection)

  const visibleCount = scenarios.filter((s) => s.visible).length

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Zinseszins</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Wie sich Sparrate, Rendite und Zeit auf das Vermögen auswirken.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch(actions.reset())}
            className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]"
          >
            Zurücksetzen
          </button>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>

      {/* Zwei Spalten mit eigenem Scroll: das Grid gibt keine gemeinsame Höhe
          vor, die Sidebar wird per sticky selbst zur Scrollfläche. */}
      <div
        className={
          isDesktop
            ? collapsed
              ? 'grid gap-4 grid-cols-[28px_minmax(0,1fr)]'
              : 'grid gap-5 grid-cols-[320px_minmax(0,1fr)]'
            : 'block'
        }
      >
        {isDesktop ? <Sidebar /> : null}

        <main className="min-w-0 space-y-5 pb-24 lg:py-6">
          <Card>
            <SummaryStats
              summaries={projection.summaries}
              activeScenarioId={activeScenarioId}
              hasWithdrawalPhase={model.withdrawalYears > 0}
            />
          </Card>

          <Card>
            {projection.lines.length > 0 ? (
              <figure className="m-0">
                <GrowthChart
                  rows={projection.rows}
                  series={projection.lines}
                  primaryKey={projection.lines[0]?.key}
                  retirementYear={projection.retirementYear}
                />
                <figcaption>
                  <ChartLegend
                    series={projection.lines}
                    rows={projection.rows}
                    encodingDescription={projection.encodingDescription}
                    showEncodingHint={visibleCount > 1 || enabledSeriesIds.length > 1}
                  />
                </figcaption>
              </figure>
            ) : (
              <p className="py-20 text-center text-sm text-[var(--text-muted)]">
                {visibleCount === 0
                  ? 'Kein Szenario sichtbar – blende links mindestens eines ein.'
                  : 'Keine Serie aktiv – wähle links mindestens eine aus.'}
              </p>
            )}
          </Card>

          <DataTable rows={projection.rows} series={projection.lines} />
        </main>
      </div>

      {isDesktop ? null : <SettingsSheet />}
    </div>
  )
}
