import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  createTextWatermark,
  type AreaSeriesPartialOptions,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ITextWatermarkPluginApi,
  type LineSeriesPartialOptions,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { yearIndexTime, yearOverYear, type TimeAnchor } from '../../core/analytics'
import type { Projection, ProjectionLine } from '../../core/projection'
import type { TimeAxisMode } from '../../core/domain/types'
import { intlLocale } from '../../i18n'
import { cn } from '../../lib/cn'
import { formatEur, formatPercent } from '../../lib/format'
import { useLocale } from '../../react/localeContext'
import { CHART_FONT, useChartPalette, withAlpha } from './chartTheme'
import { shortEur, signedShortEur } from '../../lib/numbers'
import { PhaseBand } from './phaseBand'
import type { ChartHandle, ScaleMode } from './types'

type Linie = { readonly area: true; readonly api: ISeriesApi<'Area'> } | { readonly area: false; readonly api: ISeriesApi<'Line'> }

/** Wie viele Linien die Legende einzeln nennt - darüber wird sie zur Wand. */
const LEGENDE_MAX = 8

const eurFormat = { type: 'custom', formatter: (p: number) => shortEur(p), minMove: 1 } as const

interface WealthChartProps {
  readonly projection: Projection
  readonly anchor: TimeAnchor
  /** Die Linie mit Fläche, Marken und Balken darunter. */
  readonly focusKey: string | null
  /** Klick auf eine Linie in der Legende macht sie zur Hauptkurve. */
  readonly onFocusLine?: (key: string) => void
  readonly scaleMode: ScaleMode
  readonly showDelta: boolean
  /** Sichtbare Jahre ab Start; null zeigt alles. */
  readonly rangeYears: number | null
  readonly watermark: string
  readonly axisMode: TimeAxisMode
  readonly labelOf: (line: ProjectionLine) => string
  /** Was Farbe und Strich bedeuten - unter der Legende, leer bleibt die Zeile weg. */
  readonly hint?: string
  /** Texte, damit der Chart selbst keine Übersetzung kennen muss. */
  readonly text: {
    readonly saving: string
    readonly payout: string
    readonly retirement: string
    readonly depleted: string
    readonly delta: string
    readonly year: (n: string) => string
    readonly age: (n: string) => string
    readonly more: (n: number) => string
    readonly focus: string
  }
  readonly ref?: Ref<ChartHandle>
}

/**
 * Die Vermögenskurve als TradingView-Chart.
 *
 * Gezeichnet wird mit `lightweight-charts`, gerechnet wird nichts: Zeilen und
 * Linien kommen fertig aus der Projektion. Der Chart lebt so lange wie die
 * Komponente; Reglerschritte tauschen nur die Daten, damit Zoom und Scroll
 * stehen bleiben, während man dreht.
 */
export function WealthChart({
  projection,
  anchor,
  focusKey,
  onFocusLine,
  scaleMode,
  showDelta,
  rangeYears,
  watermark,
  axisMode,
  labelOf,
  hint,
  text,
  ref,
}: WealthChartProps) {
  const { locale } = useLocale()
  const palette = useChartPalette()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const linesRef = useRef(new Map<string, Linie>())
  const deltaRef = useRef<{ api: ISeriesApi<'Histogram'>; title: ITextWatermarkPluginApi<Time> } | null>(null)
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null)
  const decorRef = useRef<{
    host: ISeriesApi<'Area'> | ISeriesApi<'Line'>
    band: PhaseBand | null
    markers: ISeriesMarkersPluginApi<Time>
    priceLine: IPriceLine | null
  } | null>(null)
  const indexOfTimeRef = useRef(new Map<number, number>())
  const [hover, setHover] = useState<number | null>(null)

  const { rows, lines } = projection
  const times = useMemo(() => rows.map((_, i) => yearIndexTime(anchor, i) as UTCTimestamp), [rows, anchor])
  const intl = intlLocale(locale)
  const monthYear = useMemo(
    () => new Intl.DateTimeFormat(intl, { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    [intl],
  )

  /** „Jahr 20" oder „Alter 55" - beim Kalender sagt das Datum schon alles. */
  const caption = (index: number): string => {
    const label = projection.yearLabels[index] ?? String(index)
    if (axisMode === 'age') return text.age(label)
    if (axisMode === 'calendar') return ''
    return text.year(label)
  }
  const captionRef = useRef(caption)
  useEffect(() => {
    captionRef.current = caption
    indexOfTimeRef.current = new Map(times.map((t, i) => [t as number, i]))
  })

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

  /* Einmal anlegen, beim Abbau wegräumen. */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      autoSize: true,
      layout: { attributionLogo: true, panes: { enableResize: true } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { scaleMargins: { top: 0.14, bottom: 0.06 } },
      timeScale: { fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true },
    })
    chartRef.current = chart
    watermarkRef.current = createTextWatermark(chart.panes()[0], {
      horzAlign: 'center',
      vertAlign: 'center',
      lines: [],
    })
    const onMove = (param: MouseEventParams<Time>) => {
      if (param.time === undefined || param.point === undefined) setHover(null)
      else setHover(indexOfTimeRef.current.get(param.time as number) ?? null)
    }
    chart.subscribeCrosshairMove(onMove)
    const lines = linesRef.current
    return () => {
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
      chartRef.current = null
      lines.clear()
      deltaRef.current = null
      watermarkRef.current = null
      decorRef.current = null
    }
  }, [])

  /* Thema, Sprache, Achsenformat. */
  useEffect(() => {
    chartRef.current?.applyOptions({
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
        timeFormatter: (time: Time) => {
          const datum = monthYear.format(new Date((time as number) * 1000))
          const index = indexOfTimeRef.current.get(time as number)
          const zusatz = index === undefined ? '' : captionRef.current(index)
          return zusatz ? `${datum} · ${zusatz}` : datum
        },
      },
    })
  }, [palette, intl, monthYear])

  /* Ein Wasserzeichen wie das Tickersymbol bei TradingView - hier der Plan. */
  useEffect(() => {
    watermarkRef.current?.applyOptions({
      lines: [
        {
          text: watermark,
          color: withAlpha(palette.text, palette.dark ? 0.05 : 0.06),
          fontSize: 52,
          fontStyle: '600',
          fontFamily: CHART_FONT,
        },
      ],
    })
  }, [watermark, palette])

  /* Linien: vorhandene behalten, fehlende anlegen, überzählige entfernen. */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const map = linesRef.current
    const gewollt = new Set(lines.map((l) => l.key))
    const entfernt = new Set<ISeriesApi<'Area'> | ISeriesApi<'Line'>>()
    const entferne = (key: string, linie: Linie) => {
      chart.removeSeries(linie.api)
      entfernt.add(linie.api)
      map.delete(key)
    }
    for (const [key, linie] of map) if (!gewollt.has(key)) entferne(key, linie)

    for (const line of lines) {
      const area = line.key === focusKey
      const farbe = withAlpha(palette.resolve(line.colorVar), line.opacity)
      const gemeinsam = {
        lineWidth: 2,
        lineStyle: line.dash ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: palette.surface,
        crosshairMarkerBackgroundColor: farbe,
        priceFormat: eurFormat,
      } as const
      let linie = map.get(line.key)
      if (linie && linie.area !== area) {
        entferne(line.key, linie)
        linie = undefined
      }
      if (area) {
        const optionen: AreaSeriesPartialOptions = {
          ...gemeinsam,
          lineColor: farbe,
          topColor: withAlpha(palette.resolve(line.colorVar), 0.28),
          bottomColor: withAlpha(palette.resolve(line.colorVar), 0.02),
        }
        if (linie?.area) linie.api.applyOptions(optionen)
        else {
          linie = { area: true, api: chart.addSeries(AreaSeries, optionen) }
          map.set(line.key, linie)
        }
      } else {
        const optionen: LineSeriesPartialOptions = { ...gemeinsam, color: farbe }
        if (linie && !linie.area) linie.api.applyOptions(optionen)
        else {
          linie = { area: false, api: chart.addSeries(LineSeries, optionen) }
          map.set(line.key, linie)
        }
      }
      linie.api.setData(
        rows.map((row, i) => {
          const wert = row[line.key]
          return typeof wert === 'number' ? { time: times[i], value: wert } : { time: times[i] }
        }),
      )
    }

    // Die Hauptlinie zuletzt zeichnen, damit sie über allen anderen liegt.
    const fokus = focusKey ? map.get(focusKey) : undefined
    fokus?.api.setSeriesOrder(map.size - 1)

    /*
     * Phasengrenze, Marken und Preislinie hängen an der Hauptlinie. Wechselt sie,
     * wandern sie mit; wurde die alte Linie gerade entfernt, sind sie mit ihr
     * gegangen und dürfen nicht noch einmal abgehängt werden.
     */
    const alt = decorRef.current
    if (alt && alt.host !== fokus?.api) {
      if (!entfernt.has(alt.host)) {
        if (alt.band) alt.host.detachPrimitive(alt.band)
        alt.markers.detach()
        if (alt.priceLine) alt.host.removePriceLine(alt.priceLine)
      }
      decorRef.current = null
    }
    if (!fokus) return

    const fokusLinie = lines.find((l) => l.key === focusKey)
    const summary = projection.summaries.find((s) => s.scenarioId === fokusLinie?.scenarioId)
    const ret = projection.retirementYear
    const mitEntnahme = ret > 0 && ret < rows.length - 1
    const basisKurve = fokusLinie?.seriesId === 'compound'

    const bandOptionen = {
      time: times[Math.min(ret, times.length - 1)],
      lineColor: withAlpha(palette.muted, 0.7),
      fillColor: withAlpha(palette.accent, palette.dark ? 0.06 : 0.045),
      textColor: palette.muted,
      axisBackColor: palette.dark ? palette.axis : palette.text,
      axisTextColor: palette.dark ? palette.text : palette.surface,
      leftLabel: text.saving,
      rightLabel: text.payout,
      axisLabel: text.retirement,
      font: CHART_FONT,
    }
    const markers: SeriesMarker<Time>[] =
      basisKurve && summary?.depletedAtYear != null && summary.depletedAtYear < times.length
        ? [
            {
              time: times[summary.depletedAtYear],
              position: 'aboveBar',
              shape: 'circle',
              color: palette.down,
              text: text.depleted,
            },
          ]
        : []

    const bisher = decorRef.current
    const markerApi = bisher ? bisher.markers : createSeriesMarkers(fokus.api, markers)
    if (bisher) markerApi.setMarkers(markers)

    let band = bisher?.band ?? null
    if (mitEntnahme) {
      if (band) band.setOptions(bandOptionen)
      else {
        band = new PhaseBand(bandOptionen)
        fokus.api.attachPrimitive(band)
      }
    } else if (band) {
      fokus.api.detachPrimitive(band)
      band = null
    }

    // Das Kapital bei Rentenbeginn als waagrechte Marke - wie ein Kursziel.
    if (bisher?.priceLine) fokus.api.removePriceLine(bisher.priceLine)
    const priceLine =
      mitEntnahme && basisKurve && summary && fokusLinie
        ? fokus.api.createPriceLine({
            price: summary.capitalAtRetirement,
            color: withAlpha(palette.resolve(fokusLinie.colorVar), 0.8),
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: text.retirement,
          })
        : null
    decorRef.current = { host: fokus.api, band, markers: markerApi, priceLine }
  }, [lines, rows, times, focusKey, palette, projection.summaries, projection.retirementYear, text])

  /* Balken unter der Kurve: Veränderung zum Vorjahr, grün oder rot. */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const fokus = focusKey && lines.some((l) => l.key === focusKey) ? focusKey : null
    if (!showDelta || !fokus) {
      // Mit der letzten Serie verschwindet auch ihre Fläche samt Überschrift.
      if (deltaRef.current) chart.removeSeries(deltaRef.current.api)
      deltaRef.current = null
      return
    }
    if (!deltaRef.current) {
      const api = chart.addSeries(
        HistogramSeries,
        { priceFormat: eurFormat, priceLineVisible: false, lastValueVisible: false },
        1,
      )
      const pane = chart.panes()[1]
      pane.setStretchFactor(0.3)
      // Die Überschrift der Fläche - als Wasserzeichen oben links, wie bei TradingView die Indikatornamen.
      const title = createTextWatermark(pane, { horzAlign: 'left', vertAlign: 'top', lines: [] })
      deltaRef.current = { api, title }
    }
    deltaRef.current.title.applyOptions({
      lines: [{ text: text.delta, color: palette.muted, fontSize: 10, fontStyle: '600', fontFamily: CHART_FONT }],
    })
    const werte = yearOverYear(rows.map((r) => r[fokus] ?? null))
    deltaRef.current.api.setData(
      werte.map((wert, i) =>
        wert === null
          ? { time: times[i] }
          : { time: times[i], value: wert, color: withAlpha(wert >= 0 ? palette.up : palette.down, 0.75) },
      ),
    )
  }, [showDelta, focusKey, lines, rows, times, palette, text])

  /* Skala. Prozent gibt es hier nicht: ab einem Startwert 0 wäre jede Veränderung unendlich. */
  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      mode: scaleMode === 'log' ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    })
  }, [scaleMode])

  /*
   * Zeitraum ab Start. Hängt an Länge und Anfang der Achse, nicht an den Zeilen
   * selbst: sonst setzte jeder Reglerschritt den Zoom zurück.
   */
  const anzahl = times.length
  const erster = times[0]
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || anzahl < 2) return
    if (rangeYears === null || rangeYears >= anzahl - 1) chart.timeScale().fitContent()
    else chart.timeScale().setVisibleRange({ from: erster, to: (erster + rangeYears * 365.25 * 86400) as UTCTimestamp })
  }, [rangeYears, anzahl, erster])

  /* ------------------------------------------------------------- Legende */

  const letzterIndex = rows.length - 1
  const index = hover ?? letzterIndex
  const wertBei = (key: string, i: number): number | null => {
    const wert = rows[i]?.[key]
    return typeof wert === 'number' ? wert : null
  }
  const zeit = times[index]
  const ueberschrift = zeit === undefined ? '' : monthYear.format(new Date(zeit * 1000))
  const zusatz = caption(index)
  // Die Hauptkurve steht immer drin, auch wenn sie in der Reihenfolge weit hinten käme.
  const fokusLinie = lines.find((l) => l.key === focusKey)
  const ersteN = lines.slice(0, LEGENDE_MAX)
  const sichtbar = fokusLinie && !ersteN.includes(fokusLinie) ? [fokusLinie, ...ersteN.slice(0, -1)] : ersteN

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-2 top-1.5 z-10 max-w-[calc(100%-7rem)] rounded bg-[color-mix(in_srgb,var(--surface-1)_82%,transparent)] px-1.5 py-0.5 text-[11px] leading-[18px]">
        <div className="flex items-baseline gap-2 text-[var(--text-secondary)]">
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">{ueberschrift}</span>
          {zusatz ? <span className="tabular-nums">{zusatz}</span> : null}
          {hover === null ? null : <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-fill)]" aria-hidden />}
        </div>
        <ul>
          {sichtbar.map((line) => {
            const wert = wertBei(line.key, index)
            const vorher = index > 0 ? wertBei(line.key, index - 1) : null
            const delta = wert !== null && vorher !== null ? wert - vorher : null
            const prozent = delta !== null && vorher !== null && vorher > 0 ? (delta / vorher) * 100 : null
            return (
              // Auf dem Handy nur die Hauptkurve - sonst verdeckt die Legende den halben Chart.
              <li
                key={line.key}
                className={cn('min-w-0', line.key === focusKey || lines.length === 1 ? 'flex' : 'hidden sm:flex')}
              >
                <button
                  type="button"
                  onClick={() => onFocusLine?.(line.key)}
                  aria-pressed={line.key === focusKey}
                  title={text.focus}
                  className="pointer-events-auto -mx-1 flex min-w-0 items-center gap-1.5 rounded px-1 text-left hover:bg-[var(--grid)]"
                >
                <span
                  aria-hidden
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ background: line.colorVar, opacity: line.opacity }}
                />
                <span className={cn('truncate text-[var(--text-secondary)]', line.key === focusKey && 'font-medium text-[var(--text-primary)]')}>
                  {labelOf(line)}
                </span>
                <span className="shrink-0 font-semibold tabular-nums" style={{ color: line.colorVar }}>
                  {wert === null ? '–' : formatEur(wert)}
                </span>
                {delta !== null ? (
                  <span
                    className="shrink-0 tabular-nums"
                    style={{ color: delta >= 0 ? 'var(--up, #22ab94)' : 'var(--down, #f7525f)' }}
                  >
                    {signedShortEur(delta)}
                    {prozent !== null ? ` (${delta >= 0 ? '+' : '−'}${formatPercent(Math.abs(prozent))})` : ''}
                  </span>
                ) : null}
                </button>
              </li>
            )
          })}
          {lines.length > LEGENDE_MAX ? (
            <li className="hidden text-[var(--text-muted)] sm:block">{text.more(lines.length - LEGENDE_MAX)}</li>
          ) : null}
        </ul>
        {hint ? <p className="hidden text-[10px] text-[var(--text-muted)] sm:block">{hint}</p> : null}
      </div>
    </div>
  )
}
