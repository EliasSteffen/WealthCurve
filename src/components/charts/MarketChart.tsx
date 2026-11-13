import {
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  createTextWatermark,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ITextWatermarkPluginApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import type { PriceIndex, UtcSeconds } from '../../core/analytics'
import { intlLocale } from '../../i18n'
import { formatPercent } from '../../lib/format'
import { useLocale } from '../../react/localeContext'
import { CHART_FONT, useChartPalette, withAlpha } from './chartTheme'
import { PhaseBand } from './phaseBand'
import type { ChartHandle, ScaleMode } from './types'

interface MarketChartProps {
  readonly index: PriceIndex
  readonly name: string
  readonly scaleMode: ScaleMode
  /** Beginn des Sparplans in dieser Historie; null ohne Startjahr. */
  readonly entryTime: UtcSeconds | null
  readonly text: {
    readonly returns: string
    readonly drawdown: string
    readonly entry: string
    readonly plan: string
    readonly interval: string
    readonly base: string
    readonly open: string
    readonly close: string
  }
  readonly ref?: Ref<ChartHandle>
}

interface Ebenen {
  readonly candles: ISeriesApi<'Candlestick'>
  readonly returns: ISeriesApi<'Histogram'>
  readonly drawdown: ISeriesApi<'Baseline'>
  readonly titles: readonly ITextWatermarkPluginApi<Time>[]
  readonly markers: ISeriesMarkersPluginApi<Time>
  band: PhaseBand | null
}

const zahl = (locale: string) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const prozentAchse = (p: number) => `${p > 0 ? '+' : ''}${formatPercent(p)}`

/**
 * Ein Wertpapier als Kerzenchart: Kurs, Monatsrendite und Abstand zum Hoch.
 *
 * Drei Flächen übereinander, wie im Terminal. Die Kerzen öffnen beim Schluss
 * des Vormonats - Tageshochs kennt die Reihe nicht, deshalb gibt es keine Dochte.
 */
export function MarketChart({ index, name, scaleMode, entryTime, text, ref }: MarketChartProps) {
  const { locale } = useLocale()
  const palette = useChartPalette()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const ebenenRef = useRef<Ebenen | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const intl = intlLocale(locale)
  const monat = useMemo(() => new Intl.DateTimeFormat(intl, { month: 'short', year: 'numeric', timeZone: 'UTC' }), [intl])
  const kurs = useMemo(() => zahl(intl), [intl])
  const positionRef = useRef(new Map<number, number>())

  useEffect(() => {
    positionRef.current = new Map(index.bars.map((b, i) => [b.time, i]))
  }, [index])

  useImperativeHandle(
    ref,
    () => ({
      screenshot: () => chartRef.current?.takeScreenshot(true, false) ?? null,
      fit: () => {
        const chart = chartRef.current
        if (!chart) return
        chart.timeScale().fitContent()
        chart.priceScale('right').applyOptions({ autoScale: true })
      },
    }),
    [],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      autoSize: true,
      layout: { attributionLogo: true, panes: { enableResize: true } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { scaleMargins: { top: 0.14, bottom: 0.04 } },
      timeScale: { fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true },
    })
    chartRef.current = chart
    const candles = chart.addSeries(CandlestickSeries, { wickVisible: false, priceLineVisible: true }, 0)
    const returns = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'custom', formatter: prozentAchse, minMove: 0.01 },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    )
    const drawdown = chart.addSeries(
      BaselineSeries,
      {
        baseValue: { type: 'price', price: 0 },
        priceFormat: { type: 'custom', formatter: prozentAchse, minMove: 0.01 },
        priceLineVisible: false,
        lineWidth: 1,
      },
      2,
    )
    const panes = chart.panes()
    panes[1]?.setStretchFactor(0.22)
    panes[2]?.setStretchFactor(0.22)
    const titles = [1, 2].map((i) => createTextWatermark(panes[i], { horzAlign: 'left', vertAlign: 'top', lines: [] }))
    ebenenRef.current = { candles, returns, drawdown, titles, markers: createSeriesMarkers(candles, []), band: null }

    const onMove = (param: MouseEventParams<Time>) => {
      if (param.time === undefined || param.point === undefined) setHover(null)
      else setHover(positionRef.current.get(param.time as number) ?? null)
    }
    chart.subscribeCrosshairMove(onMove)
    return () => {
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
      chartRef.current = null
      ebenenRef.current = null
    }
  }, [])

  /* Thema und Sprache. */
  useEffect(() => {
    const chart = chartRef.current
    const ebenen = ebenenRef.current
    if (!chart || !ebenen) return
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: palette.surface },
        textColor: palette.muted,
        fontFamily: CHART_FONT,
        fontSize: 11,
        panes: { separatorColor: palette.grid, separatorHoverColor: withAlpha(palette.accent, 0.2) },
      },
      grid: {
        vertLines: { color: withAlpha(palette.grid, 0.7) },
        horzLines: { color: withAlpha(palette.grid, 0.7) },
      },
      crosshair: {
        vertLine: { color: palette.muted, labelBackgroundColor: palette.dark ? palette.axis : palette.text },
        horzLine: { color: palette.muted, labelBackgroundColor: palette.dark ? palette.axis : palette.text },
      },
      rightPriceScale: { borderColor: palette.grid },
      timeScale: { borderColor: palette.grid },
      localization: {
        locale: intl,
        timeFormatter: (time: Time) => monat.format(new Date((time as number) * 1000)),
      },
    })
    ebenen.candles.applyOptions({
      // Am Kurs, nicht global: ein globaler Formatter überschriebe die Prozentachsen darunter.
      priceFormat: { type: 'custom', formatter: (p: number) => kurs.format(p), minMove: 0.01 },
      upColor: palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: palette.down,
    })
    ebenen.drawdown.applyOptions({
      topLineColor: palette.down,
      bottomLineColor: palette.down,
      topFillColor1: 'rgba(0, 0, 0, 0)',
      topFillColor2: 'rgba(0, 0, 0, 0)',
      bottomFillColor1: withAlpha(palette.down, 0.05),
      bottomFillColor2: withAlpha(palette.down, 0.35),
    })
    const titel = [text.returns, text.drawdown]
    ebenen.titles.forEach((w, i) =>
      w.applyOptions({
        lines: [{ text: titel[i], color: palette.muted, fontSize: 10, fontStyle: '600', fontFamily: CHART_FONT }],
      }),
    )
  }, [palette, intl, monat, kurs, text])

  /* Daten: Kerzen, Renditebalken, Unterwasserkurve - und der Einstieg des Plans. */
  useEffect(() => {
    const chart = chartRef.current
    const ebenen = ebenenRef.current
    if (!chart || !ebenen) return
    const t = (s: number) => s as UTCTimestamp
    ebenen.candles.setData(
      index.bars.map((b) => ({
        time: t(b.time),
        open: b.open,
        close: b.close,
        high: Math.max(b.open, b.close),
        low: Math.min(b.open, b.close),
      })),
    )
    ebenen.returns.setData(
      index.bars.map((b) => ({
        time: t(b.time),
        value: b.change * 100,
        color: withAlpha(b.change >= 0 ? palette.up : palette.down, 0.75),
      })),
    )
    ebenen.drawdown.setData(index.bars.map((b) => ({ time: t(b.time), value: b.drawdown * 100 })))

    // Wo der Plan in dieser Historie einsteigt: erste Kerze ab dem Startmonat.
    const einstieg = entryTime === null ? undefined : index.bars.find((b) => b.time >= entryTime)
    ebenen.markers.setMarkers(
      einstieg
        ? [{ time: t(einstieg.time), position: 'belowBar', shape: 'arrowUp', color: palette.accent, text: text.entry }]
        : [],
    )
    if (einstieg) {
      const optionen = {
        time: t(einstieg.time),
        lineColor: withAlpha(palette.accent, 0.6),
        fillColor: withAlpha(palette.accent, palette.dark ? 0.06 : 0.045),
        textColor: palette.muted,
        axisBackColor: palette.accent,
        axisTextColor: '#ffffff',
        leftLabel: '',
        rightLabel: text.plan,
        axisLabel: text.entry,
        font: CHART_FONT,
      }
      if (ebenen.band) ebenen.band.setOptions(optionen)
      else {
        ebenen.band = new PhaseBand(optionen)
        ebenen.candles.attachPrimitive(ebenen.band)
      }
    } else if (ebenen.band) {
      ebenen.candles.detachPrimitive(ebenen.band)
      ebenen.band = null
    }
  }, [index, entryTime, palette, text])

  /* Bei neuem Papier alles zeigen; bleibt es dasselbe, bleibt auch der Zoom. */
  useEffect(() => {
    chartRef.current?.timeScale().fitContent()
  }, [index.symbol])

  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      mode:
        scaleMode === 'log'
          ? PriceScaleMode.Logarithmic
          : scaleMode === 'percent'
            ? PriceScaleMode.Percentage
            : PriceScaleMode.Normal,
    })
  }, [scaleMode])

  const bar = index.bars[hover ?? index.bars.length - 1]
  const plus = bar ? bar.change >= 0 : true

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-2 top-1.5 z-10 max-w-[calc(100%-7rem)] rounded bg-[color-mix(in_srgb,var(--surface-1)_82%,transparent)] px-1.5 py-0.5 text-[11px] leading-[18px]">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{index.symbol}</span>
          <span className="truncate text-[var(--text-secondary)]">{name}</span>
          <span className="text-[var(--text-muted)]">· {text.interval} · {text.base}</span>
        </div>
        {bar ? (
          <div className="flex flex-wrap gap-x-3 tabular-nums text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">{monat.format(new Date(bar.time * 1000))}</span>
            <span>
              {text.open} <span style={{ color: plus ? 'var(--up)' : 'var(--down)' }}>{kurs.format(bar.open)}</span>
            </span>
            <span>
              {text.close} <span style={{ color: plus ? 'var(--up)' : 'var(--down)' }}>{kurs.format(bar.close)}</span>
            </span>
            <span style={{ color: plus ? 'var(--up)' : 'var(--down)' }}>
              {plus ? '+' : '−'}
              {formatPercent(Math.abs(bar.change * 100))}
            </span>
            <span className="text-[var(--down)]">DD {formatPercent(bar.drawdown * 100)}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
