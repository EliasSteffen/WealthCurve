import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Dashboard } from '@/components/Dashboard'
import type { MarketSeries } from '@/core/domain/types'
import { actions, createInitialState, reducer, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { useSelector } from '@/react/useSelector'
import { charts } from '../lwcMock'

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
  return { ...s, ...over }
}

/** Zeigt, was der Store gerade hält - aktives Szenario, Sichtbarkeit, Namen, Rendite. */
function Sonde() {
  const text = useSelector(
    (s) =>
      `${s.scenarios.find((x) => x.id === s.activeScenarioId)?.label}|${s.scenarios.map((x) => x.visible).join(',')}|` +
      `${s.scenarios.map((x) => x.label).join(',')}|${s.scenarios[0].params.annualRate}|${s.page}`,
  )
  return <output data-testid="sonde">{text}</output>
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

/** Der Chart lädt als eigener Chunk - erst nach ihm gibt es eine Attrappe. */
async function chartGeladen() {
  await waitFor(() => expect(charts.length).toBeGreaterThan(0))
  return charts.at(-1)!
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
afterEach(() => localStorage.clear())

describe('Plan: Aufbau', () => {
  it('zeigt Szenarien als Reiter, den Endwert im Kopf und die Eingaben daneben', async () => {
    zeige(zustand())
    const reiter = screen.getAllByRole('tab', { name: /Basis|Aggressiv/ })
    expect(reiter.map((r) => r.textContent)).toEqual([expect.stringMatching(/^Basis/), expect.stringMatching(/^Aggressiv/)])
    expect(reiter[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Endwert · 30 Jahre')).toBeInTheDocument()
    const eingaben = screen.getByRole('region', { name: 'Eingaben' })
    expect(within(eingaben).getByRole('textbox', { name: /Rendite p\. a\./ })).toBeInTheDocument()
    expect(within(eingaben).getByRole('region', { name: 'Laufzeit' })).toBeInTheDocument()
    await chartGeladen()
  })

  it('übergibt jede Linie der Projektion an den Chart, die Hauptkurve als Fläche', async () => {
    zeige(zustand())
    const chart = await chartGeladen()
    const haupt = chart.serien.filter((s) => s.pane === 0)
    // Zwei Szenarien × zwei Standardserien.
    expect(haupt).toHaveLength(4)
    expect(haupt.filter((s) => s.typ === 'Area')).toHaveLength(1)
    const daten = haupt[0].setData.mock.lastCall![0] as { time: number }[]
    expect(daten).toHaveLength(31)
    expect(daten.every((d, i) => i === 0 || d.time > daten[i - 1].time)).toBe(true)
    // Darunter die Balken der Veränderung.
    expect(chart.serien.filter((s) => s.pane === 1 && s.typ === 'Histogram')).toHaveLength(1)
  })

  it('macht eine Kurve aus der Legende zur Hauptkurve', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    const chart = await chartGeladen()
    const knopf = await screen.findByRole('button', { name: /Ohne Rendite · Basis/ })
    expect(knopf).toHaveAttribute('aria-pressed', 'false')
    await user.click(knopf)
    expect(knopf).toHaveAttribute('aria-pressed', 'true')
    // Die alte Fläche wird zur Linie, die neue Hauptkurve zur Fläche.
    expect(chart.entfernt.length).toBeGreaterThanOrEqual(2)
    expect(chart.serien.filter((s) => s.pane === 0 && s.typ === 'Area')).toHaveLength(1)
  })

  it('schaltet die Skala auf logarithmisch', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    const chart = await chartGeladen()
    await user.click(screen.getByRole('button', { name: /^Log$/ }))
    expect(chart.preisskala).toHaveBeenLastCalledWith({ mode: 1 })
  })
})

describe('Plan: Szenario-Reiter', () => {
  it('wählt per Klick und per Pfeiltaste', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    await user.click(screen.getByRole('tab', { name: /^Aggressiv/ }))
    expect(screen.getByTestId('sonde')).toHaveTextContent(/^Aggressiv\|/)
    fireEvent.keyDown(screen.getByRole('tab', { name: /^Aggressiv/ }), { key: 'ArrowRight' })
    expect(screen.getByTestId('sonde')).toHaveTextContent(/^Basis\|/)
  })

  it('blendet über das Menü aus und benennt per Doppelklick um', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    await user.click(screen.getByRole('button', { name: 'Aktionen für „Aggressiv“' }))
    await user.click(screen.getByRole('menuitem', { name: 'Ausblenden' }))
    expect(screen.getByTestId('sonde')).toHaveTextContent('|true,false|')

    await user.dblClick(screen.getByRole('tab', { name: /^Basis/ }))
    const feld = screen.getByRole('textbox', { name: 'Name von Basis' })
    await user.clear(feld)
    await user.type(feld, 'Sicher{Enter}')
    expect(screen.getByTestId('sonde')).toHaveTextContent('|Sicher,Aggressiv|')
  })

  it('färbt nur in freie Farben um', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    await user.click(screen.getByRole('button', { name: 'Aktionen für „Basis“' }))
    // Farbe 2 trägt schon „Aggressiv“.
    expect(screen.getByRole('menuitemradio', { name: 'Farbe 2' })).toBeDisabled()
    expect(screen.getByRole('menuitemradio', { name: 'Farbe 1' })).toHaveAttribute('aria-checked', 'true')
  })

  it('legt mit dem Plus ein neues Szenario an', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    await user.click(screen.getByRole('button', { name: 'Szenario hinzufügen' }))
    expect(screen.getAllByRole('tab', { name: /Szenario 3|Basis|Aggressiv/ })).toHaveLength(3)
  })
})

describe('Plan: Eingaben', () => {
  it('ändert die Rendite mit den Pfeiltasten um einen Schritt', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    const feld = screen.getByRole('textbox', { name: /Rendite p\. a\./ })
    await user.click(feld)
    await user.keyboard('{ArrowUp}')
    expect(screen.getByTestId('sonde')).toHaveTextContent('|7.1|')
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    expect(screen.getByTestId('sonde')).toHaveTextContent('|6.1|')
  })

  it('setzt die Rendite über eine Vorgabe', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    const vorgaben = screen.getByRole('group', { name: 'Rendite-Vorgaben' })
    await user.click(within(vorgaben).getByRole('button', { name: /^5\s%$/ }))
    expect(screen.getByTestId('sonde')).toHaveTextContent('|5|')
  })
})

describe('Plan: Tabellen', () => {
  it('vergleicht die Szenarien und markiert den besten Endwert', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    await user.click(screen.getByRole('tab', { name: 'Vergleich' }))
    const tabelle = within(screen.getByRole('tabpanel')).getByRole('table')
    const zeile = within(tabelle).getByRole('row', { name: /^Endkapital/ })
    // Aggressiv (9 %) liegt vorn.
    expect(within(zeile).getAllByRole('cell')[1]).toHaveTextContent('Bester Wert')
  })

  it('zeigt ein geladenes Wertpapier mit Kennzahlen und öffnet seinen Kerzenchart', async () => {
    const user = userEvent.setup()
    zeige(zustand({ markets: [markt] }))
    await chartGeladen()
    await user.click(screen.getByRole('tab', { name: 'Wertpapiere (1)' }))
    const panel = screen.getByRole('tabpanel')
    // Größter Rückgang: von 110 auf 55.
    expect(within(panel).getByText('-50 %')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /\^GSPC/ }))
    await waitFor(() =>
      expect(charts.at(-1)!.serien.map((s) => `${s.typ}@${s.pane}`)).toEqual(['Candlestick@0', 'Histogram@1', 'Baseline@2']),
    )
    const kerzen = charts.at(-1)!.serien[0].setData.mock.lastCall![0] as { open: number; close: number }[]
    expect(kerzen).toHaveLength(12)
    expect(kerzen[1].open).toBeCloseTo(110, 6)
    expect(kerzen[1].close).toBeCloseTo(55, 6)
  })

  it('führt ohne Wertpapier zur Kurssuche in den Eingaben', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    await user.click(screen.getByRole('tab', { name: 'Wertpapiere' }))
    await user.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Wertpapier laden' }))
    const abschnitt = document.getElementById('plan-wertpapiere')!
    expect(abschnitt.contains(document.activeElement)).toBe(true)
  })

  it('räumt den Chart beim Bereichswechsel ab', async () => {
    const user = userEvent.setup()
    zeige(zustand())
    const chart = await chartGeladen()
    await user.click(screen.getByRole('button', { name: /Depot/ }))
    expect(chart.remove).toHaveBeenCalled()
  })
})
