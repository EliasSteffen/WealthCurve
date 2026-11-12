import { ChevronDown } from 'lucide-react'
import { lazy, Suspense, type ReactNode } from 'react'
import { selectActiveParamIds, selectActiveScenario, selectChartStyle, selectProjection } from '../../core/derive'
import { PARAMETERS } from '../../core/domain/parameters'
import type { SettingsCategoryId } from '../../core/settings/categories'
import { actions } from '../../core/state'
import { effectiveMode } from '../../core/timeAxis'
import { cn } from '../../lib/cn'
import { formatPercent } from '../../lib/format'
import { useT } from '../../react/localeContext'
import { seriesCountOf } from '../../react/projectionText'
import { useDispatch, useSelector } from '../../react/useSelector'
import { ChartLegend } from '../chart/ChartLegend'
import { DataTable } from '../DataTable'
import { useDepotRate } from '../depot/useDepotRate'
import { MarketPanel } from '../MarketPanel'
import {
  ChartStyleControl,
  CompoundingControl,
  InflationAmountsControl,
  TimeAxisControls,
  TimelineControls,
  TimingControl,
  WithdrawalPhaseToggle,
  WithdrawalRuleControl,
} from '../ModelSettings'
import { ParameterPanel } from '../ParameterPanel'
import { ScenarioList } from '../ScenarioList'
import { SeriesPanel } from '../SeriesPanel'
import { SummaryStats } from '../SummaryStats'
import { Card } from '../ui/Card'

/*
 * Recharts ist der größte Brocken des Bündels. Der Chart lädt als eigener
 * Chunk nach; die Karte hat feste Höhe, es springt also nichts, wenn er kommt.
 */
const GrowthChart = lazy(() => import('../chart/GrowthChart').then((m) => ({ default: m.GrowthChart })))

/** Der Abschnitt „Zeitachse" - MarketPanel springt dorthin, wenn das Startjahr fehlt (gleiche ID dort). */
const ABSCHNITT_ZEITACHSE = 'plan-zeitachse'
/** Der Abschnitt „Echte Kursverläufe" - die Pro-Ansicht öffnet ihn über ihr Plus. */
export const ABSCHNITT_WERTPAPIERE = 'plan-wertpapiere'

/**
 * Ein aufklappbarer Abschnitt für alles, was nicht jeder braucht.
 *
 * Natives <details>: Tastatur, Screenreader und „Suchen auf der Seite" können
 * es von Haus aus. Zu sind die Abschnitte, bis man sie öffnet - der erste Blick
 * gehört dem Plan, nicht den Annahmen.
 */
function Abschnitt({
  id,
  title,
  hint,
  children,
}: {
  readonly id?: string
  readonly title: string
  readonly hint: string
  readonly children: ReactNode
}) {
  return (
    <details id={id} className="group rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-[var(--grid)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--text-primary)]">{title}</span>
          <span className="block text-xs text-[var(--text-secondary)]">{hint}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="space-y-5 border-t border-[var(--hairline)] px-4 py-4">{children}</div>
    </details>
  )
}

const VORGABEN = [3, 5, 7]

/** Schnellwahl für die Rendite - runde Werte zum Vergleichen, dazu die eigene Depot-Historie. */
function RenditeVorgaben({ value, onPick }: { readonly value: number; readonly onPick: (v: number) => void }) {
  const t = useT()
  const depot = useDepotRate()
  const { min, max } = PARAMETERS.annualRate
  const begrenzt = depot === null ? null : Math.min(max, Math.max(min, depot))
  const chip = (aktiv: boolean) =>
    cn(
      'rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors',
      aktiv
        ? 'border-[var(--chart-1)] bg-[var(--grid)] text-[var(--text-primary)]'
        : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:bg-[var(--grid)]',
    )
  return (
    <div role="group" aria-label={t('plan.ratePresets', 'Rendite-Vorgaben')} className="flex flex-wrap items-center gap-1.5">
      {/* Steht hinter dem Startkapital (beide Regler teilen eine Gruppe) - die Beschriftung sagt, wozu. */}
      <span aria-hidden className="mr-1 text-xs text-[var(--text-secondary)]">
        {t('plan.ratePresetsLabel', 'Rendite schnell setzen:')}
      </span>
      {VORGABEN.map((v) => (
        <button key={v} type="button" aria-pressed={value === v} className={chip(value === v)} onClick={() => onPick(v)}>
          {formatPercent(v)}
        </button>
      ))}
      {depot !== null && begrenzt !== null ? (
        <button
          type="button"
          aria-pressed={value === begrenzt}
          className={chip(value === begrenzt)}
          onClick={() => onPick(begrenzt)}
          title={t('plan.rateDepotHint', 'Historische Rendite deines Depots – keine Prognose.')}
        >
          {t('plan.rateDepot', 'Wie mein Depot: {rate}', { rate: formatPercent(depot) })}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Der Plan: oben, was jeder einstellt, darunter, was nur manche brauchen.
 *
 * Die Werte des Szenarios und die gemeinsamen stehen in derselben Karte - der
 * Satz darüber sagt, was wofür gilt. Früher trennten zwei Bereiche das sauber,
 * und niemand fand die Laufzeit.
 */
export function PlanPanel() {
  const t = useT()
  const dispatch = useDispatch()
  const scenarios = useSelector((s) => s.scenarios)
  const activeScenarioId = useSelector((s) => s.activeScenarioId)
  const enabledSeriesIds = useSelector((s) => s.enabledSeriesIds)
  const model = useSelector((s) => s.model)
  const chartStyleId = useSelector((s) => s.chartStyleId)
  const activeScenario = useSelector(selectActiveScenario)
  const activeParamIds = useSelector(selectActiveParamIds)
  const capacity = useSelector(selectProjection).capacity

  const setModel = (next: typeof model) => dispatch(actions.setModel(next))
  const regler = (category: SettingsCategoryId, emptyHint?: string) => (
    <ParameterPanel
      category={category}
      params={activeScenario.params}
      activeParamIds={activeParamIds}
      matches={null}
      emptyHint={emptyHint}
      onChange={(id, value) => dispatch(actions.setParam(activeScenario.id, id, value))}
    />
  )
  const mitEntnahme = model.withdrawalYears > 0

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t('plan.scenarios', 'Szenarien')}</h2>
        <ScenarioList scenarios={scenarios} activeScenarioId={activeScenarioId} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('plan.title', 'Dein Plan')}</h2>
        <p className="mb-4 mt-0.5 text-xs text-[var(--text-secondary)]">
          {t('plan.hint', 'Rendite, Startkapital und Sparrate gelten für „{name}“, die Laufzeit für alle Szenarien.', {
            name: activeScenario.label,
          })}
        </p>
        <div className="space-y-5">
          {regler('kapital')}
          <RenditeVorgaben
            value={activeScenario.params.annualRate}
            onPick={(v) => dispatch(actions.setParam(activeScenario.id, 'annualRate', v))}
          />
          {regler('einzahlung')}
          <TimelineControls category="einzahlung" value={model} onChange={setModel} />
        </div>
      </Card>

      <Abschnitt
        title={t('plan.section.payout', 'Auszahlung')}
        hint={t('plan.section.payoutHint', 'Nach dem Sparen regelmäßig entnehmen')}
      >
        <WithdrawalPhaseToggle value={model} onChange={setModel} />
        {mitEntnahme ? (
          <>
            <WithdrawalRuleControl value={model} onChange={setModel} />
            <TimelineControls category="auszahlung" value={model} onChange={setModel} />
          </>
        ) : null}
        {regler(
          'auszahlung',
          mitEntnahme
            ? t('plan.empty.payoutRule', 'Die gewählte Entnahmeregel liest den anderen Wert – oben umschalten.')
            : t('plan.empty.payout', 'Erst mit Entnahmephase gibt es hier etwas einzustellen.'),
        )}
      </Abschnitt>

      <Abschnitt
        title={t('plan.section.assumptions', 'Annahmen')}
        hint={t('plan.section.assumptionsHint', 'Inflation, Tagesgeld, Zinsmodus, Zeitpunkt der Sparrate')}
      >
        {regler(
          'annahmen',
          t(
            'plan.empty.assumptions',
            'Diese Werte liest gerade keine eingeschaltete Kurve – unter „Kurven & Darstellung“ etwa Kaufkraft oder Tagesgeld dazunehmen.',
          ),
        )}
        <InflationAmountsControl value={model} onChange={setModel} />
        <CompoundingControl value={model} onChange={setModel} />
        <TimingControl value={model} onChange={setModel} />
      </Abschnitt>

      <Abschnitt
        title={t('plan.section.curves', 'Kurven & Darstellung')}
        hint={t('plan.section.curvesHint', 'Welche Linien, welcher Stil')}
      >
        <SeriesPanel
          enabledSeriesIds={enabledSeriesIds}
          onToggle={(id) => dispatch(actions.toggleSeries(id))}
          capacity={capacity}
        />
        <ChartStyleControl value={chartStyleId} onChange={(id) => dispatch(actions.setChartStyle(id))} />
      </Abschnitt>

      <Abschnitt
        id={ABSCHNITT_WERTPAPIERE}
        title={t('plan.section.markets', 'Echte Kursverläufe')}
        hint={t('plan.section.marketsHint', 'Bis zu vier Wertpapiere zum Vergleich')}
      >
        <MarketPanel />
      </Abschnitt>

      <Abschnitt
        id={ABSCHNITT_ZEITACHSE}
        title={t('plan.section.time', 'Zeitachse')}
        hint={t('plan.section.timeHint', 'Alter, Startjahr und -monat')}
      >
        <TimeAxisControls value={model} onChange={setModel} />
      </Abschnitt>
    </div>
  )
}

/**
 * Sparplan: links der Plan, rechts das Ergebnis. Auf schmalen Schirmen steht
 * das Ergebnis oben - wer die App öffnet, will zuerst die Kurve sehen.
 */
export function SparplanPage() {
  const t = useT()
  const activeScenarioId = useSelector((s) => s.activeScenarioId)
  const enabledSeriesIds = useSelector((s) => s.enabledSeriesIds)
  const model = useSelector((s) => s.model)
  const scenarios = useSelector((s) => s.scenarios)
  const projection = useSelector(selectProjection)
  const chartStyle = useSelector(selectChartStyle)

  const visibleCount = scenarios.filter((s) => s.visible).length
  // Folgt dem WIRKSAMEN Modus: ohne gesetztes Alter stünde sonst „Alter" über rohen Jahren.
  const achsenTitel = {
    relative: t('chart.years', 'Jahre'),
    age: t('chart.age', 'Alter'),
    calendar: t('chart.calendar', 'Jahr'),
  }[effectiveMode(model)]

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:p-6">
      <div className="order-2 lg:sticky lg:top-6 lg:order-1 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
        <PlanPanel />
      </div>

      <div className="order-1 min-w-0 space-y-4 lg:order-2">
        <Card>
          <SummaryStats
            summaries={projection.summaries}
            activeScenarioId={activeScenarioId}
            hasWithdrawalPhase={model.withdrawalYears > 0}
          />
        </Card>

        <Card className="flex h-[400px] flex-col sm:h-[460px] lg:h-[520px]">
          {projection.lines.length > 0 ? (
            <figure className="m-0 flex min-h-0 flex-1 flex-col">
              <Suspense fallback={<div className="min-h-0 flex-1" />}>
                <GrowthChart
                  rows={projection.rows}
                  series={projection.lines}
                  style={chartStyle}
                  primaryKey={projection.lines[0]?.key}
                  retirementYear={projection.retirementYear}
                  yearLabels={projection.yearLabels}
                  axisTitle={achsenTitel}
                />
              </Suspense>
              <figcaption className="shrink-0">
                <ChartLegend
                  series={projection.lines}
                  rows={projection.rows}
                  encodingId={projection.encodingId}
                  encodingDescription={projection.encodingDescription}
                  seriesCount={seriesCountOf(projection.lines)}
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

        <DataTable
          rows={projection.rows}
          series={projection.lines}
          yearLabels={projection.yearLabels}
          yearHeading={achsenTitel}
        />
      </div>
    </div>
  )
}
