import {
  Camera,
  ChartArea,
  ChartCandlestick,
  ChartColumn,
  ChevronDown,
  ChevronUp,
  Download,
  Maximize2,
  Minimize2,
  ScanSearch,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { marketPriceIndex, marketStats, monthToUtc, scenarioFigures, timeAnchor } from '../../core/analytics'
import { projectionToCsv } from '../../core/csv'
import { selectProjection } from '../../core/derive'
import { slotVar } from '../../core/palette'
import { actions } from '../../core/state'
import { effectiveMode } from '../../core/timeAxis'
import { cn } from '../../lib/cn'
import { downloadBlob, downloadCsv } from '../../lib/download'
import { formatEur, formatPercent, formatYears } from '../../lib/format'
import { formatDecimal, signedEur, signedPercent } from '../../lib/numbers'
import { revealSetting } from '../../lib/reveal'
import { useStoredState } from '../../lib/useStoredState'
import { useT } from '../../react/localeContext'
import { useStore } from '../../react/storeContext'
import { encodingText, seriesCountOf } from '../../react/projectionText'
import { useSeriesLabel } from '../../react/useSeriesLabel'
import { useDispatch, useSelector } from '../../react/useSelector'
import type { ChartHandle, ScaleMode } from '../charts/types'
import { HeadStat, Panel, PanelHeader } from '../ui/Panel'
import { ToolButton, ToolDivider, ToolSegment } from '../ui/Toolbar'
import { CompareTable } from './CompareTable'
import { ABSCHNITT_WERTPAPIERE, InputsPanel } from './InputsPanel'
import { MarketsTable, type MarketEntry } from './MarketsTable'
import { ScenarioTabs } from './ScenarioTabs'
import { YearTable } from './YearTable'

/*
 * Die Charts samt TradingView-Bibliothek laden als eigener Chunk nach. Kopf,
 * Eingaben und Tabellen stehen sofort; die Chartfläche hat feste Maße, es
 * springt also nichts, wenn er kommt.
 */
const WealthChart = lazy(() => import('../charts/WealthChart').then((m) => ({ default: m.WealthChart })))
const MarketChart = lazy(() => import('../charts/MarketChart').then((m) => ({ default: m.MarketChart })))

const WEALTH = 'wealth'
type BottomTab = 'years' | 'compare' | 'markets'

const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isScale = (v: unknown): v is ScaleMode => v === 'linear' || v === 'log' || v === 'percent'
const isBottom = (v: unknown): v is BottomTab => v === 'years' || v === 'compare' || v === 'markets'

function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [aktiv, setAktiv] = useState(false)
  useEffect(() => {
    const onChange = () => setAktiv(document.fullscreenElement !== null && document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [ref])
  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else void el.requestFullscreen?.().catch(() => {})
  }
  return { aktiv, toggle, verfuegbar: typeof document !== 'undefined' && document.fullscreenEnabled === true }
}

/**
 * Der Sparplan als Arbeitsplatz.
 *
 * Oben die Szenarien als Reiter und, was das gewählte am Ende bringt. In der
 * Mitte der Chart, darunter Jahreswerte, Vergleich und Wertpapiere. Rechts alle
 * Eingaben - immer sichtbar, damit jede Änderung sofort im Chart steht.
 */
export function PlanPage() {
  const t = useT()
  const store = useStore()
  const dispatch = useDispatch()
  const labelOf = useSeriesLabel()
  const projection = useSelector(selectProjection)
  const model = useSelector((s) => s.model)
  const scenarios = useSelector((s) => s.scenarios)
  const activeId = useSelector((s) => s.activeScenarioId)
  const markets = useSelector((s) => s.markets)

  const [chartTab, setChartTab] = useState<string>(WEALTH)
  const [rangeYears, setRangeYears] = useState<number | null>(null)
  const [focusOverride, setFocusOverride] = useState<string | null>(null)
  const [scaleMode, setScaleMode] = useStoredState<ScaleMode>('plan.scale', 'linear', isScale)
  const [showDelta, setShowDelta] = useStoredState('plan.delta', true, isBool)
  const [bottomOpen, setBottomOpen] = useStoredState('plan.bottomOpen', true, isBool)
  const [bottomTab, setBottomTab] = useStoredState<BottomTab>('plan.bottomTab', 'years', isBottom)

  const chartRef = useRef<ChartHandle>(null)
  const flaecheRef = useRef<HTMLDivElement>(null)
  const vollbild = useFullscreen(flaecheRef)

  // Jahr 0 hängt an einem Kalendermonat; ohne Startjahr ist das heute - einmal je Sitzung bestimmt.
  // Nur die Ankerfelder als Abhängigkeit: sonst entstünde bei jedem Reglerschritt ein neuer Anker.
  const [heute] = useState(() => new Date())
  const { startYear, startMonth } = model
  const anchor = useMemo(() => timeAnchor({ startYear, startMonth }, heute), [startYear, startMonth, heute])

  const marketEntries = useMemo<MarketEntry[]>(
    () =>
      markets.flatMap((m) => {
        const index = marketPriceIndex(m)
        return index ? [{ symbol: m.symbol, name: m.name, index, stats: marketStats(index) }] : []
      }),
    [markets],
  )
  const markt = marketEntries.find((m) => m.symbol === chartTab)
  const tab = markt ? markt.symbol : WEALTH
  const zeigeVermoegen = tab === WEALTH

  // Hauptkurve: gewählt, sonst die Zinseszins-Kurve des aktiven Szenarios, sonst die erste.
  const lines = projection.lines
  const focusKey =
    (focusOverride && lines.some((l) => l.key === focusOverride) ? focusOverride : null) ??
    lines.find((l) => l.scenarioId === activeId && l.seriesId === 'compound')?.key ??
    lines.find((l) => l.scenarioId === activeId)?.key ??
    lines[0]?.key ??
    null

  const aktiv = scenarios.find((s) => s.id === activeId)
  const summary = projection.summaries.find((s) => s.scenarioId === activeId) ?? null
  const jahre = projection.rows.length - 1
  const zahlen = summary ? scenarioFigures(summary, jahre) : null
  const modus = effectiveMode(model)
  const mitEntnahme = projection.retirementYear > 0 && projection.retirementYear < jahre
  const achsenTitel = {
    relative: t('chart.years', 'Jahre'),
    age: t('chart.age', 'Alter'),
    calendar: t('chart.calendar', 'Jahr'),
  }[modus]

  const chartText = useMemo(
    () => ({
      saving: t('pro.phase.saving', 'Ansparen'),
      payout: t('pro.phase.payout', 'Entnahme'),
      retirement: t('chart.retirement', 'Rentenbeginn'),
      depleted: t('pro.depleted', 'Aufgebraucht'),
      delta: t('pro.deltaPane', 'Veränderung zum Vorjahr'),
      year: (n: string) => t('pro.yearN', 'Jahr {n}', { n }),
      age: (n: string) => t('pro.ageN', 'Alter {n}', { n }),
      more: (n: number) => t('pro.moreLines', '+ {n} weitere Kurven', { n }),
      focus: t('pro.focusHint', 'Als Hauptkurve zeigen: Fläche, Marken und Balken'),
    }),
    [t],
  )
  const marktText = useMemo(
    () => ({
      returns: t('pro.pane.returns', 'Monatsrendite'),
      drawdown: t('pro.pane.drawdown', 'Abstand zum Hoch'),
      entry: t('pro.entry', 'Einstieg'),
      plan: t('pro.planWindow', 'Dein Sparplan'),
      interval: t('pro.interval', '1M'),
      base: t('pro.indexBase', 'Index, Start = 100'),
      open: t('pro.open', 'E'),
      close: t('pro.close', 'S'),
    }),
    [t],
  )

  const screenshot = () => {
    const canvas = chartRef.current?.screenshot()
    if (!canvas) return
    const name = zeigeVermoegen ? 'vermoegen' : tab.replace(/[^\w-]+/g, '')
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `wealthcurve-${name}-${new Date().toISOString().slice(0, 10)}.png`)
    }, 'image/png')
  }
  const csv = () => downloadCsv(projectionToCsv(selectProjection(store.getSnapshot())))
  const wertpapierLaden = () => revealSetting(ABSCHNITT_WERTPAPIERE)

  const zeitraeume = [
    { value: 10, label: t('pro.range.10', '10J') },
    { value: 20, label: t('pro.range.20', '20J') },
    { value: 30, label: t('pro.range.30', '30J') },
    { value: null, label: t('pro.range.all', 'Alle') },
  ] as const
  const skalen = [
    { value: 'linear' as const, label: t('pro.scale.linear', 'Lin'), title: t('pro.scale.linearHint', 'Lineare Skala') },
    {
      value: 'log' as const,
      label: t('pro.scale.log', 'Log'),
      title: t('pro.scale.logHint', 'Logarithmisch: gleiches Wachstum, gleiche Steigung'),
    },
    ...(zeigeVermoegen
      ? []
      : [{ value: 'percent' as const, label: '%', title: t('pro.scale.percentHint', 'Prozent zum ersten sichtbaren Kurs') }]),
  ]
  // Prozent gibt es nur bei Kursen: ab einem Startwert 0 € wäre jede Veränderung unendlich.
  const skala: ScaleMode = zeigeVermoegen && scaleMode === 'percent' ? 'linear' : scaleMode
  const keinChart = lines.length === 0
  const sichtbar = scenarios.filter((s) => s.visible).length

  const bottomTabs: readonly { id: BottomTab; label: string }[] = [
    { id: 'years', label: t('pro.yearly', 'Jahreswerte') },
    { id: 'compare', label: t('compare.tab', 'Vergleich') },
    {
      id: 'markets',
      label:
        marketEntries.length > 0
          ? t('pro.securitiesCount', 'Wertpapiere ({n})', { n: marketEntries.length })
          : t('pro.securities', 'Wertpapiere'),
    },
  ]

  return (
    <div className="flex flex-col gap-px bg-[var(--grid)] lg:h-full lg:min-h-0">
      {/* Kopf: Szenarien als Reiter, darunter das gewählte wie ein Kurs. */}
      <Panel className="shrink-0" label={t('plan.scenarios', 'Szenarien')}>
        <div className="border-b border-[var(--grid)]">
          <ScenarioTabs projection={projection} />
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2 px-4 py-2.5">
          {zahlen && summary ? (
            <>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  {t('plan.finalAfter', 'Endwert · {years}', { years: formatYears(jahre) })}
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[26px] font-semibold leading-none tracking-tight text-[var(--text-primary)]">
                    {formatEur(zahlen.finalValue)}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: zahlen.gain >= 0 ? 'var(--up)' : 'var(--down)' }}
                    title={t('pro.vsContributions', 'Ertrag auf Einzahlungen')}
                  >
                    {signedEur(zahlen.gain)}
                    {zahlen.gainRatio !== null ? ` (${signedPercent(zahlen.gainRatio)})` : ''}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{t('pro.gainShort', 'Ertrag')}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {t('plan.headline', '{rate} p. a. · {amount}/Monat · Start {start}', {
                    rate: formatPercent(summary.params.annualRate),
                    amount: formatEur(summary.params.monthlyContribution),
                    start: formatEur(summary.params.initialCapital),
                  })}
                </p>
              </div>
              <div className="grid basis-full grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:ml-auto lg:max-w-2xl lg:flex-1 lg:basis-auto">
                <HeadStat label={t('stat.contributed', 'Eingezahlt')} value={formatEur(zahlen.contributions)} />
                {mitEntnahme ? (
                  <HeadStat label={t('stat.atRetirement', 'Bei Rentenbeginn')} value={formatEur(summary.capitalAtRetirement)} />
                ) : (
                  <HeadStat
                    label={t('stat.interestShare', 'Anteil Zinsertrag')}
                    value={formatPercent(zahlen.finalValue > 0 ? (zahlen.gain / zahlen.finalValue) * 100 : 0)}
                  />
                )}
                <HeadStat
                  label={t('pro.realShort', 'Kaufkraft heute')}
                  value={formatEur(zahlen.realFinalValue)}
                  hint={t('pro.realHint', 'Bei {rate} Inflation pro Jahr', { rate: formatPercent(summary.params.inflationRate) })}
                />
                {mitEntnahme ? (
                  <HeadStat
                    label={t('stat.monthlyWithdrawal', 'Monatliche Entnahme')}
                    value={formatEur(summary.monthlyWithdrawal)}
                    tone={summary.depletedAtYear === null ? undefined : 'down'}
                    hint={
                      summary.depletedAtYear === null
                        ? t('stat.lasts.through', 'reicht durch')
                        : t('pro.depleted', 'Aufgebraucht')
                    }
                  />
                ) : (
                  <HeadStat
                    label={t('pro.doubling', 'Verdopplung alle')}
                    value={
                      zahlen.doublingYears === null
                        ? '–'
                        : t('pro.yearsShort', '{n} J.', { n: formatDecimal(zahlen.doublingYears) })
                    }
                    hint={t('pro.doublingHint', 'Beim festen Zins, ohne Einzahlungen')}
                  />
                )}
              </div>
            </>
          ) : aktiv && !aktiv.visible ? (
            <p className="flex flex-wrap items-center gap-2 py-1 text-xs text-[var(--text-secondary)]">
              <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: slotVar(aktiv.colorSlot) }} />
              {t('plan.hiddenActive', '„{name}“ ist ausgeblendet – die Eingaben ändern es, Chart und Kennzahlen zeigen es nicht.', {
                name: aktiv.label,
              })}
              <button
                type="button"
                onClick={() => dispatch(actions.setScenarioVisible(aktiv.id, true))}
                className="h-6 rounded px-2 font-medium text-[var(--text-primary)] ring-1 ring-inset ring-[var(--hairline)] hover:bg-[var(--grid)]"
              >
                {t('stat.showActive', 'Einblenden')}
              </button>
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="flex min-h-0 flex-1 flex-col gap-px lg:flex-row">
        {/* Auf dem Handy lösen sich Chart und Tabellen aus der Spalte, damit die Eingaben dazwischen passen. */}
        <div className="contents lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-px">
          {/* Werkzeugleiste und Chart - zusammen im Vollbild. */}
          <div
            ref={flaecheRef}
            className="order-1 flex h-[62vh] min-h-[380px] flex-col bg-[var(--surface-1)] lg:order-none lg:h-auto lg:min-h-0 lg:flex-1"
          >
            <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--grid)] px-2 [scrollbar-width:none]">
              <div role="group" aria-label={t('pro.charts', 'Charts')} className="flex shrink-0 items-center gap-0.5">
                <ToolButton active={zeigeVermoegen} onClick={() => setChartTab(WEALTH)}>
                  <ChartArea size={14} aria-hidden />
                  {t('pro.tab.wealth', 'Vermögen')}
                </ToolButton>
                {marketEntries.map((m) => (
                  <ToolButton key={m.symbol} active={tab === m.symbol} onClick={() => setChartTab(m.symbol)} title={m.name}>
                    <ChartCandlestick size={14} aria-hidden />
                    {m.symbol}
                  </ToolButton>
                ))}
              </div>
              <ToolDivider />
              {zeigeVermoegen ? (
                <>
                  <ToolSegment label={t('pro.range', 'Zeitraum')} options={zeitraeume} value={rangeYears} onChange={setRangeYears} />
                  <ToolDivider />
                </>
              ) : null}
              <ToolSegment label={t('pro.scale', 'Skala')} options={skalen} value={skala} onChange={setScaleMode} />
              {zeigeVermoegen ? (
                <>
                  <ToolDivider />
                  <ToolButton
                    active={showDelta}
                    onClick={() => setShowDelta(!showDelta)}
                    title={t('pro.deltaHint', 'Balken: Veränderung der Hauptkurve zum Vorjahr')}
                  >
                    <ChartColumn size={14} aria-hidden />
                    {t('pro.delta', 'Δ p. a.')}
                  </ToolButton>
                </>
              ) : null}
              <span className="flex-1" />
              <ToolButton onClick={() => chartRef.current?.fit()} label={t('pro.fit', 'Alles zeigen')}>
                <ScanSearch size={15} aria-hidden />
              </ToolButton>
              <ToolButton onClick={screenshot} label={t('pro.screenshot', 'Chart als Bild speichern')}>
                <Camera size={15} aria-hidden />
              </ToolButton>
              {vollbild.verfuegbar ? (
                <ToolButton
                  onClick={vollbild.toggle}
                  label={vollbild.aktiv ? t('pro.exitFullscreen', 'Vollbild verlassen') : t('pro.fullscreen', 'Vollbild')}
                >
                  {vollbild.aktiv ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
                </ToolButton>
              ) : null}
            </div>

            <div className="relative min-h-0 flex-1">
              <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-[var(--surface-2)] opacity-40" />}>
                {markt ? (
                  <MarketChart
                    ref={chartRef}
                    index={markt.index}
                    name={markt.name}
                    scaleMode={skala}
                    entryTime={model.startYear === null ? null : monthToUtc(model.startYear, model.startMonth)}
                    text={marktText}
                  />
                ) : keinChart ? (
                  <p className="absolute inset-0 m-auto flex items-center justify-center p-6 text-center text-sm text-[var(--text-muted)]">
                    {sichtbar === 0
                      ? t('chart.noScenario', 'Kein Szenario sichtbar – blende mindestens eines ein.')
                      : t('chart.noSeries', 'Keine Serie aktiv – wähle mindestens eine aus.')}
                  </p>
                ) : (
                  <WealthChart
                    ref={chartRef}
                    projection={projection}
                    anchor={anchor}
                    focusKey={focusKey}
                    onFocusLine={setFocusOverride}
                    scaleMode={skala}
                    showDelta={showDelta}
                    rangeYears={rangeYears}
                    watermark={summary?.label ?? ''}
                    axisMode={modus}
                    labelOf={labelOf}
                    hint={
                      sichtbar > 1 || seriesCountOf(lines) > 1
                        ? encodingText(t, projection.encodingId, seriesCountOf(lines), projection.encodingDescription)
                        : undefined
                    }
                    text={chartText}
                  />
                )}
              </Suspense>
            </div>
          </div>

          {/* Tabellen unter dem Chart - zugeklappt bleibt die Reiterleiste stehen. */}
          <Panel
            label={t('plan.tables', 'Tabellen')}
            className={cn('order-3 flex min-h-0 flex-col lg:order-none lg:shrink-0', bottomOpen && 'lg:h-[250px]')}
          >
            <div className="flex h-9 shrink-0 items-stretch justify-between gap-2 border-b border-[var(--grid)] pr-2">
              <div role="tablist" aria-label={t('plan.tables', 'Tabellen')} className="flex items-stretch overflow-x-auto [scrollbar-width:none]">
                {bottomTabs.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="tab"
                    id={`plan-bottom-tab-${b.id}`}
                    aria-selected={bottomTab === b.id}
                    aria-controls="plan-bottom-panel"
                    onClick={() => {
                      setBottomTab(b.id)
                      setBottomOpen(true)
                    }}
                    className={cn(
                      '-mb-px whitespace-nowrap border-b-2 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
                      bottomTab === b.id && bottomOpen
                        ? 'border-[var(--accent-fill)] text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {bottomTab === 'years' && bottomOpen ? (
                  <ToolButton onClick={csv} title={t('table.download', 'CSV herunterladen')}>
                    <Download size={13} aria-hidden />
                    CSV
                  </ToolButton>
                ) : null}
                <ToolButton
                  onClick={() => setBottomOpen(!bottomOpen)}
                  label={bottomOpen ? t('pro.hideTable', 'Tabellen zuklappen') : t('pro.showTable', 'Tabellen aufklappen')}
                >
                  {bottomOpen ? <ChevronDown size={15} aria-hidden /> : <ChevronUp size={15} aria-hidden />}
                </ToolButton>
              </div>
            </div>
            {bottomOpen ? (
              <div
                id="plan-bottom-panel"
                role="tabpanel"
                aria-labelledby={`plan-bottom-tab-${bottomTab}`}
                className="thin-scroll max-h-[340px] min-h-0 flex-1 overflow-auto lg:max-h-none"
              >
                {bottomTab === 'years' ? (
                  keinChart ? null : (
                    <YearTable
                      projection={projection}
                      anchor={anchor}
                      focusKey={focusKey}
                      // Beim Kalender sagt das Datum schon dasselbe wie die Achse.
                      yearHeading={modus === 'calendar' ? null : achsenTitel}
                    />
                  )
                ) : bottomTab === 'compare' ? (
                  <CompareTable projection={projection} />
                ) : (
                  <MarketsTable
                    markets={marketEntries}
                    selected={markt?.symbol ?? null}
                    onSelect={setChartTab}
                    onAdd={wertpapierLaden}
                  />
                )}
              </div>
            ) : null}
          </Panel>
        </div>

        {/* Eingaben - immer sichtbar, jede Änderung steht sofort im Chart. */}
        <Panel label={t('inputs.title', 'Eingaben')} className="order-2 flex min-h-0 flex-col lg:order-none lg:w-[340px] lg:shrink-0">
          <PanelHeader title={t('inputs.title', 'Eingaben')} />
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <InputsPanel />
          </div>
        </Panel>
      </div>

      {/* Statuszeile: Annahmen, die jede Zahl darüber prägen. */}
      <Panel className="hidden shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1 text-[10px] text-[var(--text-muted)] lg:flex">
        <span>
          {t('model.compounding', 'Zinsmodus')}:{' '}
          <span className="text-[var(--text-secondary)]">
            {
              {
                'monthly-effective': t('model.compounding.monthly-effective', 'Effektiv'),
                'monthly-nominal': t('model.compounding.monthly-nominal', 'Nominal'),
                annual: t('model.compounding.annual', 'Jährlich'),
              }[model.compounding]
            }
          </span>
        </span>
        <span>
          {t('model.timing', 'Sparrate')}:{' '}
          <span className="text-[var(--text-secondary)]">
            {model.timing === 'start' ? t('model.timing.start', 'Vorschüssig') : t('model.timing.end', 'Nachschüssig')}
          </span>
        </span>
        <span>
          {t('pro.status.phases', 'Ansparen {save} · Entnahme {payout}', {
            save: formatYears(Math.floor(model.accumulationYears)),
            payout: model.withdrawalYears > 0 ? formatYears(Math.floor(model.withdrawalYears)) : '–',
          })}
        </span>
        <span className="flex-1" />
        <span>{t('pro.disclaimer', 'Modellrechnung, keine Anlageberatung')}</span>
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--text-secondary)] underline-offset-2 hover:underline"
        >
          {t('pro.poweredBy', 'Charts: TradingView Lightweight Charts™')}
        </a>
      </Panel>
    </div>
  )
}
