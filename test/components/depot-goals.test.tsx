import { render, screen, within } from '@testing-library/react'
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

describe('Ziele & Vorschläge', () => {
  beforeEach(() => {
    localStorage.setItem('zinseszins.locale', 'de')
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
    // Der Hebel steht im Namen, aber nicht im Depot - die Seite bietet die Korrektur an.
    expect(screen.getByRole('button', { name: 'Typ und Hebel übernehmen' })).toBeInTheDocument()
  })

  it('zeigt nach einer Vorlage, was fehlt und welcher Baustein hilft', async () => {
    const user = userEvent.setup()
    zeige([
      holding({ id: 'A', name: 'iShares Core S&P 500', weight: 0.6 }),
      holding({ id: 'B', name: 'Vanguard FTSE Developed Europe UCITS ETF', weight: 0.4 }),
    ])
    const abschnitt = screen.getByRole('heading', { name: 'Ziele & Vorschläge' }).closest('section')!
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
