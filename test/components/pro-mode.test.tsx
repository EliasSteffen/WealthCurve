import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '@/components/Dashboard'
import type { MarketSeries } from '@/core/domain/types'
import { actions, createInitialState, reducer, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { useSelector } from '@/react/useSelector'

/*
 * jsdom hat kein Canvas - `lightweight-charts` liefe hier ins Leere. Die
 * Attrappe merkt sich stattdessen, was der Chart bekommt: welche Serien, in
 * welcher Fläche, mit welchen Daten.
 */
interface SerieAttrappe {
  readonly typ: string
  readonly pane: number
  readonly setData: ReturnType<typeof vi.fn>
  readonly applyOptions: ReturnType<typeof vi.fn>
}
interface ChartAttrappe {
  readonly serien: SerieAttrappe[]
  readonly entfernt: SerieAttrappe[]
  readonly preisskala: ReturnType<typeof vi.fn>
  readonly remove: ReturnType<typeof vi.fn>
}
const charts: ChartAttrappe[] = []

vi.mock('lightweight-charts', () => {
  const createChart = () => {
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
      timeScale: () => ({ fitContent: vi.fn(), setVisibleRange: vi.fn(), timeToCoordinate: () => 100, width: () => 800 }),
      priceScale: () => ({ applyOptions: chart.preisskala }),
      takeScreenshot: vi.fn(),
    }
  }
  return {
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
})

const markt: MarketSeries = {
  symbol: '^GSPC',
  name: 'S&P 500',
  currency: 'USD',
  start: '2000-01-01',
  monthlyReturns: [0.1, -0.5, 1, 0.02, 0.01, -0.01, 0.03, 0.02, 0.01, 0.02, -0.02, 0.01],
}

function zustand(over: Partial<AppState> = {}): AppState {
  let s = createInitialState()
  s = reducer(s, actions.addScenario('Aggressiv', { annualRate: 9 }))
  s = reducer(s, actions.selectScenario(s.scenarios[0].id))
  return { ...s, proMode: true, ...over }
}

/** Zeigt den aktiven Szenarionamen und den Pro-Schalter des Stores. */
function Sonde() {
  const aktiv = useSelector((s) => s.scenarios.find((x) => x.id === s.activeScenarioId)?.label)
  const sichtbar = useSelector((s) => s.scenarios.map((x) => x.visible).join(','))
  return (
    <output data-testid="sonde">
      {aktiv}|{sichtbar}
    </output>
  )
}

function zeige(state: AppState) {
  return render(
    <LocaleProvider>
      <StoreProvider initialState={state}>
        <Dashboard />
        <Sonde />
      </StoreProvider>
    </LocaleProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('zinseszins.locale', 'de')
  charts.length = 0
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  document.documentElement.removeAttribute('data-pro')
})

describe('Pro-Modus', () => {
  it('schaltet über die Kopfzeile ein und aus - samt Farbschema', async () => {
    const user = userEvent.setup()
    zeige(createInitialState())
    const schalter = screen.getByRole('button', { name: /^Pro/ })
    expect(schalter).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.hasAttribute('data-pro')).toBe(false)

    await user.click(schalter)
    expect(schalter).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.hasAttribute('data-pro')).toBe(true)
    expect(await screen.findByRole('tab', { name: 'Übersicht' })).toBeInTheDocument()

    await user.click(schalter)
    expect(document.documentElement.hasAttribute('data-pro')).toBe(false)
    expect(screen.queryByRole('tab', { name: 'Übersicht' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dein Plan' })).toBeInTheDocument()
  })

  it('übergibt jede Linie der Projektion an den Chart, die Hauptkurve als Fläche', async () => {
    zeige(zustand())
    await screen.findByRole('tab', { name: 'Übersicht' })
    const chart = charts.at(-1)!
    const haupt = chart.serien.filter((s) => s.pane === 0)
    // Zwei Szenarien × zwei Standardserien.
    expect(haupt).toHaveLength(4)
    expect(haupt.filter((s) => s.typ === 'Area')).toHaveLength(1)
    // Jede Serie bekommt eine Zeile je Jahr, mit aufsteigender Zeit.
    const daten = haupt[0].setData.mock.lastCall![0] as { time: number }[]
    expect(daten).toHaveLength(31)
    expect(daten.every((d, i) => i === 0 || d.time > daten[i - 1].time)).toBe(true)
    // Darunter die Balken der Veränderung.
    expect(chart.serien.filter((s) => s.pane === 1 && s.typ === 'Histogram')).toHaveLength(1)
  })

  it('wählt in der Beobachtungsliste das Szenario und blendet es aus', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    const liste = await screen.findByRole('region', { name: 'Szenarien' })
    await user.click(within(liste).getByRole('button', { name: 'Aggressiv' }))
    expect(screen.getByTestId('sonde')).toHaveTextContent('Aggressiv|true,true')
    await user.click(within(liste).getByRole('button', { name: '„Aggressiv“ ausblenden' }))
    expect(screen.getByTestId('sonde')).toHaveTextContent('Aggressiv|true,false')
  })

  it('macht eine angeklickte Kurve zur Hauptkurve', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    const kurven = await screen.findByRole('region', { name: 'Kurven' })
    const knoepfe = within(kurven).getAllByRole('button')
    expect(knoepfe[0]).toHaveAttribute('aria-pressed', 'true')
    await user.click(knoepfe[1])
    expect(knoepfe[1]).toHaveAttribute('aria-pressed', 'true')
    expect(knoepfe[0]).toHaveAttribute('aria-pressed', 'false')
    // Die alte Fläche wird zur Linie, die neue Hauptkurve zur Fläche.
    const chart = charts.at(-1)!
    expect(chart.entfernt.length).toBeGreaterThanOrEqual(2)
    expect(chart.serien.filter((s) => s.pane === 0 && s.typ === 'Area')).toHaveLength(1)
  })

  it('schaltet die Skala auf logarithmisch', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    await screen.findByRole('tab', { name: 'Übersicht' })
    await user.click(screen.getByRole('button', { name: /^Log$/ }))
    expect(charts.at(-1)!.preisskala).toHaveBeenLastCalledWith({ mode: 1 })
  })

  it('zeigt ein geladenes Wertpapier mit Kennzahlen und als Kerzenchart', async () => {
    const user = userEvent.setup()
    zeige(zustand({ markets: [markt] }))
    const papiere = await screen.findByRole('region', { name: 'Wertpapiere' })
    // Größter Rückgang: von 110 auf 55.
    expect(within(papiere).getByText('-50 %')).toBeInTheDocument()

    await user.click(within(papiere).getByRole('button', { name: /\^GSPC/ }))
    expect(await screen.findByRole('region', { name: 'Kennzahlen ^GSPC' })).toBeInTheDocument()
    const chart = charts.at(-1)!
    expect(chart.serien.map((s) => `${s.typ}@${s.pane}`)).toEqual(['Candlestick@0', 'Histogram@1', 'Baseline@2'])
    const kerzen = chart.serien[0].setData.mock.lastCall![0] as { open: number; close: number }[]
    expect(kerzen).toHaveLength(12)
    expect(kerzen[1].open).toBeCloseTo(110, 6)
    expect(kerzen[1].close).toBeCloseTo(55, 6)
  })

  it('führt mit dem Plus zur Kurssuche im Plan', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    const papiere = await screen.findByRole('region', { name: 'Wertpapiere' })
    await user.click(within(papiere).getByRole('button', { name: 'Wertpapier laden' }))
    expect(screen.getByRole('tab', { name: 'Plan' })).toHaveAttribute('aria-selected', 'true')
    const abschnitt = document.getElementById('plan-wertpapiere') as HTMLDetailsElement
    expect(abschnitt.open).toBe(true)
  })

  it('räumt den Chart beim Verlassen ab', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    await screen.findByRole('tab', { name: 'Übersicht' })
    const chart = charts.at(-1)!
    await user.click(screen.getByRole('button', { name: /^Pro/ }))
    await act(async () => {})
    expect(chart.remove).toHaveBeenCalled()
  })
})
