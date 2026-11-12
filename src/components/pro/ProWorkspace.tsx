import {
  Camera,
  ChartArea,
  ChartCandlestick,
  ChartColumn,
  Download,
  Maximize2,
  Minimize2,
  PanelBottomClose,
  PanelBottomOpen,
  ScanSearch,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { marketPriceIndex, marketStats, monthToUtc, scenarioFigures, timeAnchor } from '../../core/analytics'
import { projectionToCsv } from '../../core/csv'
import { selectProjection } from '../../core/derive'
import { slotVar } from '../../core/palette'
import { effectiveMode } from '../../core/timeAxis'
import { cn } from '../../lib/cn'
import { downloadBlob, downloadCsv } from '../../lib/download'
import { formatEur, formatPercent, formatYears } from '../../lib/format'
import { useT } from '../../react/localeContext'
import { useStore } from '../../react/storeContext'
import { useSeriesLabel } from '../../react/useSeriesLabel'
import { useSelector } from '../../react/useSelector'
import { ABSCHNITT_WERTPAPIERE, PlanPanel } from '../sparplan/SparplanPage'
import { MarketChart } from './MarketChart'
import { ProChart } from './ProChart'
import { ProSidebar, type MarketEntry } from './ProSidebar'
import { ProTable } from './ProTable'
import type { ChartHandle, ScaleMode } from './types'
import { formatDecimal, signedEur, signedPercent } from './numbers'
import { ToolButton, ToolDivider, ToolSegment } from './ui'

const WEALTH = 'wealth'
type AsideTab = 'overview' | 'plan'

/** Vorlieben der Ansicht im Browser merken - Komfort, kein Muss; jeder Zugriff darf scheitern. */
function useStoredState<T>(key: string, fallback: T, valid: (v: unknown) => v is T) {
  const [wert, setWert] = useState<T>(() => {
    try {
      const roh = localStorage.getItem(`wealthcurve.pro.${key}`)
      const gelesen: unknown = roh === null ? undefined : JSON.parse(roh)
      return valid(gelesen) ? gelesen : fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(`wealthcurve.pro.${key}`, JSON.stringify(wert))
    } catch {
      /* privat oder voll - die Wahl gilt für diese Sitzung */
    }
  }, [key, wert])
  return [wert, setWert] as const
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isScale = (v: unknown): v is ScaleMode => v === 'linear' || v === 'log' || v === 'percent'
const isAside = (v: unknown): v is AsideTab => v === 'overview' || v === 'plan'

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

/** Eine Kennzahl im Kopf: Bezeichnung klein darüber, Wert darunter. */
function HeadStat({ label, value, tone }: { readonly label: string; readonly value: string; readonly tone?: 'up' | 'down' }) {
  return (
    <div className="min-w-0 border-l border-[var(--grid)] pl-3">
      <div className="truncate text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div
        className="truncate text-[13px] font-medium tabular-nums text-[var(--text-primary)]"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

function Panel({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <div className={cn('bg-[var(--surface-1)]', className)}>{children}</div>
}

/**
 * Die Pro-Ansicht: ein Handelsterminal für den Sparplan.
 *
 * Oben das „Symbol" - das gewählte Szenario mit Endwert und Ertrag -, darunter
 * die Werkzeugleiste, der TradingView-Chart und die Jahreswerte. Rechts die
 * Beobachtungsliste und, einen Reiter weiter, der vollständige Plan. Alles, was
 * die ruhige Ansicht kann, geht hier auch; nur dichter.
 */
export function ProWorkspace() {
  const t = useT()
  const store = useStore()
  const labelOf = useSeriesLabel()
  const projection = useSelector(selectProjection)
  const model = useSelector((s) => s.model)
  const scenarios = useSelector((s) => s.scenarios)
  const activeId = useSelector((s) => s.activeScenarioId)
  const markets = useSelector((s) => s.markets)

  const [chartTab, setChartTab] = useState<string>(WEALTH)
  const [rangeYears, setRangeYears] = useState<number | null>(null)
  const [focusOverride, setFocusOverride] = useState<string | null>(null)
  const [scaleMode, setScaleMode] = useStoredState<ScaleMode>('scale', 'linear', isScale)
  const [showDelta, setShowDelta] = useStoredState('delta', true, isBool)
  const [tableOpen, setTableOpen] = useStoredState('table', true, isBool)
  const [asideTab, setAsideTab] = useStoredState<AsideTab>('aside', 'overview', isAside)
  // Gesetzt vom Plus der Beobachtungsliste, eingelöst, sobald der Plan-Reiter steht.
  const marktOeffnenRef = useRef(false)

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
  const summary =
    projection.summaries.find((s) => s.scenarioId === activeId) ?? projection.summaries[0] ?? null
  const jahre = projection.rows.length - 1
  const zahlen = summary ? scenarioFigures(summary, jahre) : null
  const modus = effectiveMode(model)
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

  // Das Plus der Beobachtungsliste: zum Plan wechseln und dort die Kurssuche aufklappen.
  useEffect(() => {
    if (!marktOeffnenRef.current || asideTab !== 'plan') return
    marktOeffnenRef.current = false
    const abschnitt = document.getElementById(ABSCHNITT_WERTPAPIERE)
    if (abschnitt instanceof HTMLDetailsElement) {
      abschnitt.open = true
      abschnitt.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      abschnitt.querySelector<HTMLInputElement>('input:not([type=file])')?.focus({ preventScroll: true })
    }
  }, [asideTab])

  const screenshot = () => {
    const canvas = chartRef.current?.screenshot()
    if (!canvas) return
    const name = zeigeVermoegen ? 'vermoegen' : tab.replace(/[^\w-]+/g, '')
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `wealthcurve-${name}-${new Date().toISOString().slice(0, 10)}.png`)
    }, 'image/png')
  }

  const csv = () => downloadCsv(projectionToCsv(selectProjection(store.getSnapshot())))

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
      : [
          {
            value: 'percent' as const,
            label: '%',
            title: t('pro.scale.percentHint', 'Prozent zum ersten sichtbaren Kurs'),
          },
        ]),
  ]
  const skala: ScaleMode = zeigeVermoegen && scaleMode === 'percent' ? 'linear' : scaleMode

  const keinChart = lines.length === 0
  const sichtbar = scenarios.filter((s) => s.visible).length

  return (
    <div className="flex flex-col gap-px bg-[var(--grid)] text-[var(--text-primary)] lg:h-full lg:min-h-0">
      {/* Kopf: das „Symbol" mit Kurs und Veränderung. */}
      <Panel className="flex flex-wrap items-end gap-x-6 gap-y-2 px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            {aktiv ? (
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ background: slotVar(aktiv.colorSlot) }}
              />
            ) : null}
            <span className="font-semibold text-[var(--text-primary)]">{summary?.label ?? '–'}</span>
            {summary ? (
              <span className="tabular-nums">
                {formatPercent(summary.params.annualRate)} {t('pro.perYear', 'p. a.')} ·{' '}
                {t('pro.perMonth', '{amount}/Monat', { amount: formatEur(summary.params.monthlyContribution) })} ·{' '}
                {formatYears(jahre)}
              </span>
            ) : null}
            <span className="rounded border border-[var(--grid)] px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t('pro.projection', 'Projektion')}
            </span>
          </div>
          {zahlen ? (
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatEur(zahlen.finalValue)}</span>
              <span
                className="text-sm font-medium tabular-nums"
                style={{ color: zahlen.gain >= 0 ? 'var(--up)' : 'var(--down)' }}
              >
                {signedEur(zahlen.gain)}
                {zahlen.gainRatio !== null ? ` (${signedPercent(zahlen.gainRatio)})` : ''}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{t('pro.vsContributions', 'Ertrag auf Einzahlungen')}</span>
            </div>
          ) : null}
        </div>
        {zahlen && summary ? (
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:max-w-2xl lg:justify-self-end">
            <HeadStat label={t('stat.contributed', 'Eingezahlt')} value={formatEur(zahlen.contributions)} />
            {projection.retirementYear > 0 && projection.retirementYear < jahre ? (
              <HeadStat label={t('stat.atRetirement', 'Bei Rentenbeginn')} value={formatEur(summary.capitalAtRetirement)} />
            ) : (
              <HeadStat
                label={t('stat.interestShare', 'Anteil Zinsertrag')}
                value={formatPercent(zahlen.finalValue > 0 ? (zahlen.gain / zahlen.finalValue) * 100 : 0)}
              />
            )}
            <HeadStat label={t('pro.realShort', 'Kaufkraft heute')} value={formatEur(zahlen.realFinalValue)} />
            <HeadStat
              label={t('pro.doubling', 'Verdopplung alle')}
              value={
                zahlen.doublingYears === null
                  ? '–'
                  : t('pro.yearsShort', '{n} J.', { n: formatDecimal(zahlen.doublingYears) })
              }
            />
          </div>
        ) : null}
      </Panel>

      <div className="flex min-h-0 flex-1 flex-col gap-px lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-px">
          {/* Werkzeugleiste und Chart - zusammen im Vollbild. */}
          <div ref={flaecheRef} className="flex h-[62vh] min-h-[380px] flex-col bg-[var(--surface-1)] lg:h-auto lg:min-h-0 lg:flex-1">
            <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--grid)] px-2 py-1 [scrollbar-width:none]">
              <div role="group" aria-label={t('pro.charts', 'Charts')} className="flex shrink-0 items-center gap-0.5">
                <ToolButton
                  active={zeigeVermoegen}
                  onClick={() => setChartTab(WEALTH)}
                  className={zeigeVermoegen ? 'text-[var(--text-primary)]' : undefined}
                >
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
              <ToolButton
                onClick={() => setTableOpen(!tableOpen)}
                active={tableOpen}
                label={tableOpen ? t('pro.hideTable', 'Jahreswerte ausblenden') : t('pro.showTable', 'Jahreswerte einblenden')}
                className="hidden lg:inline-flex"
              >
                {tableOpen ? <PanelBottomClose size={15} aria-hidden /> : <PanelBottomOpen size={15} aria-hidden />}
              </ToolButton>
            </div>

            <div className="relative min-h-0 flex-1">
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
                <ProChart
                  ref={chartRef}
                  projection={projection}
                  anchor={anchor}
                  focusKey={focusKey}
                  scaleMode={skala}
                  showDelta={showDelta}
                  rangeYears={rangeYears}
                  watermark={summary?.label ?? ''}
                  axisMode={modus}
                  labelOf={labelOf}
                  text={chartText}
                />
              )}
            </div>
          </div>

          {/* Jahreswerte - im Terminal immer griffbereit, auf dem Handy unter dem Chart. */}
          {tableOpen && !keinChart ? (
            <Panel className="flex min-h-0 flex-col lg:h-[220px] lg:shrink-0">
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--grid)] px-3 py-1">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {t('pro.yearly', 'Jahreswerte')}
                </h2>
                <ToolButton onClick={csv} title={t('table.download', 'CSV herunterladen')}>
                  <Download size={13} aria-hidden />
                  CSV
                </ToolButton>
              </div>
              <div className="pro-scroll max-h-[320px] min-h-0 flex-1 overflow-auto lg:max-h-none">
                <ProTable
                  projection={projection}
                  anchor={anchor}
                  focusKey={focusKey}
                  // Beim Kalender sagt das Datum schon dasselbe wie die Achse.
                  yearHeading={modus === 'calendar' ? null : achsenTitel}
                />
              </div>
            </Panel>
          ) : null}
        </div>

        {/* Seitenspalte: Beobachtungsliste und Plan. */}
        <Panel className="flex min-h-0 flex-col lg:w-[340px] lg:shrink-0">
          <div role="tablist" aria-label={t('pro.sidebar', 'Seitenspalte')} className="flex shrink-0 border-b border-[var(--grid)]">
            {(
              [
                ['overview', t('pro.aside.overview', 'Übersicht')],
                ['plan', t('pro.aside.plan', 'Plan')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                id={`pro-aside-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={asideTab === id}
                aria-controls="pro-aside-panel"
                onClick={() => setAsideTab(id)}
                className={cn(
                  '-mb-px flex-1 border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                  asideTab === id
                    ? 'border-[var(--accent-fill)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            id="pro-aside-panel"
            role="tabpanel"
            aria-labelledby={`pro-aside-tab-${asideTab}`}
            className="pro-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {asideTab === 'overview' ? (
              <ProSidebar
                projection={projection}
                focusKey={focusKey}
                onFocus={setFocusOverride}
                chartTab={tab}
                onChartTab={setChartTab}
                markets={marketEntries}
                onOpenMarkets={() => {
                  marktOeffnenRef.current = true
                  setAsideTab('plan')
                }}
              />
            ) : (
              <div className="p-3">
                <PlanPanel />
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Statuszeile: Annahmen, die jede Zahl darüber prägen. */}
      <Panel className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1 text-[10px] text-[var(--text-muted)]">
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
