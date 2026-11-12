import { vi } from 'vitest'

/*
 * Attrappe für `lightweight-charts`.
 *
 * jsdom hat kein Canvas - die echte Bibliothek liefe hier ins Leere. Die
 * Attrappe merkt sich stattdessen, was ein Chart bekommt: welche Serien, in
 * welcher Fläche, mit welchen Daten. Eingebunden in test/setup.ts, damit jede
 * Seite rendern kann; Tests, die hineinschauen wollen, lesen `charts`.
 */
export interface SerieAttrappe {
  readonly typ: string
  readonly pane: number
  readonly setData: ReturnType<typeof vi.fn>
  readonly applyOptions: ReturnType<typeof vi.fn>
}

export interface ChartAttrappe {
  readonly serien: SerieAttrappe[]
  readonly entfernt: SerieAttrappe[]
  readonly preisskala: ReturnType<typeof vi.fn>
  readonly remove: ReturnType<typeof vi.fn>
}

export const charts: ChartAttrappe[] = []

function createChart() {
  const chart: ChartAttrappe = { serien: [], entfernt: [], preisskala: vi.fn(), remove: vi.fn() }
  charts.push(chart)
  const panes = [0, 1, 2].map(() => ({ setStretchFactor: vi.fn() }))
  return {
    addSeries: (typ: string, _optionen: unknown, pane = 0) => {
      const serie = {
        typ,
        pane,
        setData: vi.fn(),
        applyOptions: vi.fn(),
        setSeriesOrder: vi.fn(),
        attachPrimitive: vi.fn(),
        detachPrimitive: vi.fn(),
        createPriceLine: vi.fn(() => ({})),
        removePriceLine: vi.fn(),
      }
      chart.serien.push(serie)
      return serie
    },
    removeSeries: (serie: SerieAttrappe) => {
      chart.serien.splice(chart.serien.indexOf(serie), 1)
      chart.entfernt.push(serie)
    },
    applyOptions: vi.fn(),
    remove: chart.remove,
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    panes: () => panes,
    timeScale: () => ({
      fitContent: vi.fn(),
      setVisibleRange: vi.fn(),
      timeToCoordinate: () => 100,
      width: () => 800,
    }),
    priceScale: () => ({ applyOptions: chart.preisskala }),
    takeScreenshot: vi.fn(),
  }
}

export const lightweightChartsMock = {
  createChart,
  createSeriesMarkers: () => ({ setMarkers: vi.fn(), detach: vi.fn() }),
  createTextWatermark: () => ({ applyOptions: vi.fn() }),
  AreaSeries: 'Area',
  LineSeries: 'Line',
  HistogramSeries: 'Histogram',
  CandlestickSeries: 'Candlestick',
  BaselineSeries: 'Baseline',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
  PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2 },
}
