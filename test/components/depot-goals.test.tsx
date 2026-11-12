import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DepotPage } from '@/components/depot/DepotPage'
import type { DepotHolding } from '@/core/depot/types'
import { createInitialState, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'

const holding = (over: Partial<DepotHolding> & { id: string }): DepotHolding => ({
  name: over.id,
  symbol: '',
  weight: 0,
  ter: 0.002,
  leverage: 1,
  kind: 'etf',
  lookThrough: '',
  ...over,
})

function zeige(holdings: DepotHolding[]) {
  const basis = createInitialState()
  const state: AppState = {
    ...basis,
    page: 'depot',
    depot: { ...basis.depot, holdings, value: 20000 },
  }
  return render(
    <LocaleProvider>
      <StoreProvider initialState={state}>
        <DepotPage />
      </StoreProvider>
    </LocaleProvider>,
  )
}

beforeEach(() => localStorage.setItem('zinseszins.locale', 'de'))

describe('Gespeichertes Depot nachbessern', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('schlägt Positionen ohne Namen nach und schätzt sie dann über den Index', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/resolve')) {
        return new Response(
          JSON.stringify({
            results: [{ id: 'ETF146', symbol: null, name: 'Amundi MSCI World UCITS ETF', currency: null, type: 'etf' }],
          }),
          { headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    zeige([holding({ id: 'ETF146', weight: 1 })])

    expect(await screen.findByText(/Amundi MSCI World UCITS ETF \(MSCI World\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Ohne Durchschau/)).toBeNull()
    // Einmal je Sitzung - kein zweiter Abruf beim nächsten Rendern.
    expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/resolve'))).toHaveLength(1)
  })
})

describe('Ziele & Vorschläge', () => {
  beforeEach(() => {
    // Statische Auslieferung: kein Server, also nur Schätzungen aus den Namen.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('schätzt ETFs ohne Bestand aus dem Namen statt „Unbekannt“', async () => {
    zeige([
      holding({ id: 'A', name: 'Xtrackers S&P 500 2x Leveraged Daily Swap UCITS ETF 1C', weight: 0.6 }),
      holding({ id: 'B', name: 'Vanguard FTSE Developed Europe UCITS ETF', weight: 0.4 }),
    ])
    expect(await screen.findByText(/Geschätzt, weil der Anbieter keinen Bestand veröffentlicht/)).toBeInTheDocument()
    expect(screen.queryByText(/Ohne Durchschau/)).toBeNull()
    // Der Hebel steht im Namen, aber nicht im Depot - unter „Daten & Quellen“ steht die Korrektur.
    fireEvent.click(screen.getByRole('tab', { name: 'Daten & Quellen' }))
    expect(screen.getByRole('button', { name: 'Typ und Hebel übernehmen' })).toBeInTheDocument()
  })

  it('zeigt nach einer Vorlage, was fehlt und welcher Baustein hilft', async () => {
    const user = userEvent.setup()
    zeige([
      holding({ id: 'A', name: 'iShares Core S&P 500', weight: 0.6 }),
      holding({ id: 'B', name: 'Vanguard FTSE Developed Europe UCITS ETF', weight: 0.4 }),
    ])
    await user.click(screen.getByRole('tab', { name: 'Ziele & Vorschläge' }))
    const abschnitt = screen.getByRole('tabpanel')
    await user.click(within(abschnitt).getByRole('button', { name: /70\/30/ }))

    expect(await within(abschnitt).findByText('So kommst du hin – ohne zu verkaufen')).toBeInTheDocument()
    expect(within(abschnitt).getByText('Schwellenländer-ETF')).toBeInTheDocument()
    expect(within(abschnitt).getAllByText(/Prozentpunkte zu wenig/).length).toBeGreaterThan(0)
    // Mit Depotwert stehen Beträge in Euro dabei.
    expect(within(abschnitt).getAllByText(/€/).length).toBeGreaterThan(0)

    // Ohne Ziele steht wieder die Auswahl der Vorlagen da.
    await user.click(within(abschnitt).getByRole('button', { name: 'Ziel Schwellenländer entfernen' }))
    await user.click(within(abschnitt).getByRole('button', { name: 'Ziel Industrieländer entfernen' }))
    expect(within(abschnitt).getByRole('button', { name: /Welt nach Börsenwert/ })).toBeInTheDocument()
  })
})
