import { selectChartStyle, selectProjection } from '../core/derive'
import { effectiveMode } from '../core/timeAxis'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTheme } from '../hooks/useTheme'
import { useT } from '../react/localeContext'
import { useSelector } from '../react/useSelector'
import { ChartLegend } from './chart/ChartLegend'
import { GrowthChart } from './chart/GrowthChart'
import { DataTable } from './DataTable'
import { SettingsDialog } from './layout/SettingsDialog'
import { SettingsSheet } from './layout/SettingsSheet'
import { Sidebar } from './layout/Sidebar'
import { SummaryStats } from './SummaryStats'
import { Card } from './ui/Card'
import { Logo } from './ui/Logo'

/** Ab hier ist Platz für eine dauerhaft sichtbare Seitenspalte. */
const DESKTOP = '(min-width: 1024px)'

/**
 * Layout mobile first: die Basis ist eine Spalte mit Bottom-Sheet, ab `lg`
 * kommt die Seitenspalte dazu. Die Höhe ist auf das Fenster begrenzt, gescrollt
 * wird nur innerhalb der Spalten.
 *
 * Die Entscheidung Sidebar/Sheet läuft bewusst über JavaScript und nicht über
 * `hidden lg:block`: sonst wäre das komplette Einstellungspanel auf Mobil zwar
 * unsichtbar, würde aber bei jeder Reglerbewegung mitgerendert.
 */
export function Dashboard() {
  const { theme, setTheme } = useTheme()
  const isDesktop = useMediaQuery(DESKTOP)
  const t = useT()

  const activeScenarioId = useSelector((s) => s.activeScenarioId)
  const enabledSeriesIds = useSelector((s) => s.enabledSeriesIds)
  const model = useSelector((s) => s.model)
  const scenarios = useSelector((s) => s.scenarios)
  const projection = useSelector(selectProjection)
  const chartStyle = useSelector(selectChartStyle)

  const visibleCount = scenarios.filter((s) => s.visible).length

  /*
   * Überschrift der Zeitachse.
   *
   * Folgt dem WIRKSAMEN Modus, nicht dem gewählten: stünde „Alter" an der
   * Achse, ohne dass ein Alter gesetzt ist, beschriftete man sie mit einer
   * Unwahrheit - die Zahlen wären weiterhin die rohen Indizes.
   */
  const achsenTitel = {
    relative: t('chart.years', 'Jahre'),
    age: t('chart.age', 'Alter'),
    calendar: t('chart.calendar', 'Jahr'),
  }[effectiveMode(model)]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Die Marke steht neben dem Namen, nicht darüber: die Kopfzeile ist
              auf kleinen Geräten nur eine Zeile hoch. */}
          <Logo size={26} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-[var(--text-primary)] lg:text-lg">
              {t('app.title', 'Zinseszins')}
            </h1>
            <p className="hidden text-xs text-[var(--text-secondary)] sm:block">
              {t('app.subtitle', 'Wie sich Sparrate, Rendite und Zeit auf das Vermögen auswirken.')}
            </p>
          </div>
        </div>
        {/* Zwei Knöpfe statt vier Bedienelementen: Sprache, Farbschema und das
            Zurücksetzen wohnen jetzt im Reiter „Allgemein". Die Kopfzeile ist
            kein Ablageort für alles, was sonst nirgends passte. */}
        <div className="flex shrink-0 items-center gap-2">
          <SettingsDialog theme={theme} onThemeChange={setTheme} />
        </div>
      </header>

      {/* min-h-0 ist der Trick, der die Kinder scrollen lässt statt den Flex-
          Container über das Fenster hinauswachsen zu lassen. */}
      <div className="flex min-h-0 flex-1">
        {isDesktop ? <Sidebar /> : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 lg:gap-5 lg:p-6">
          <Card className="shrink-0">
            <SummaryStats
              summaries={projection.summaries}
              activeScenarioId={activeScenarioId}
              hasWithdrawalPhase={model.withdrawalYears > 0}
            />
          </Card>

          {/* Auf kleinen Schirmen feste Diagrammhöhe, ab lg füllt es den Rest. */}
          <Card className="flex h-[400px] shrink-0 flex-col sm:h-[460px] lg:h-auto lg:min-h-0 lg:flex-1">
            {projection.lines.length > 0 ? (
              <figure className="m-0 flex min-h-0 flex-1 flex-col">
                <GrowthChart
                  rows={projection.rows}
                  series={projection.lines}
                  style={chartStyle}
                  primaryKey={projection.lines[0]?.key}
                  retirementYear={projection.retirementYear}
                  yearLabels={projection.yearLabels}
                  axisTitle={achsenTitel}
                />
                <figcaption className="shrink-0">
                  <ChartLegend
                    series={projection.lines}
                    rows={projection.rows}
                    encodingDescription={projection.encodingDescription}
                    showEncodingHint={visibleCount > 1 || enabledSeriesIds.length > 1}
                  />
                </figcaption>
              </figure>
            ) : (
              <p className="m-auto text-center text-sm text-[var(--text-muted)]">
                {visibleCount === 0
                  ? t('chart.noScenario', 'Kein Szenario sichtbar – blende mindestens eines ein.')
                  : t('chart.noSeries', 'Keine Serie aktiv – wähle mindestens eine aus.')}
              </p>
            )}
          </Card>

          <div className="shrink-0">
            <DataTable
              rows={projection.rows}
              series={projection.lines}
              yearLabels={projection.yearLabels}
              yearHeading={achsenTitel}
            />
          </div>
        </main>
      </div>

      {isDesktop ? null : <SettingsSheet />}
    </div>
  )
}
