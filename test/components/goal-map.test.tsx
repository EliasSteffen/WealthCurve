import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DepotPage } from '@/components/depot/DepotPage'
import { MAP_COLUMNS, MAP_ROWS, WORLD_TILES } from '@/components/depot/worldTiles'
import { COUNTRIES } from '@/core/depot/lookthrough'
import type { DepotHolding } from '@/core/depot/types'
import { createInitialState, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { useSelector } from '@/react/useSelector'

describe('Kachelkarte', () => {
  it('kennt jedes Land der Durchschau, ohne doppelte Kacheln', () => {
    const kacheln = new Set(WORLD_TILES.map((t) => t.code))
    const fehlen = Object.values(COUNTRIES)
      .map((c) => c.code)
      .filter((code) => !kacheln.has(code))
    expect(fehlen).toEqual([])
    expect(kacheln.size).toBe(WORLD_TILES.length)

    const plaetze = WORLD_TILES.map((t) => `${t.x}|${t.y}`)
    expect(new Set(plaetze).size).toBe(plaetze.length)
    for (const t of WORLD_TILES) {
      expect(t.x).toBeLessThan(MAP_COLUMNS)
      expect(t.y).toBeLessThan(MAP_ROWS)
    }
  })
})

const holding = (over: Partial<DepotHolding> & { id: string }): DepotHolding => ({
  name: over.id,
  symbol: 'X.DE',
  weight: 0,
  ter: 0.002,
  leverage: 1,
  kind: 'etf',
  lookThrough: '',
  ...over,
})

/** Zeigt die gespeicherten Ziele, damit der Test sie prüfen kann. */
function Ziele() {
  const goals = useSelector((s) => s.depot.goals)
  return <output data-testid="ziele">{JSON.stringify(goals)}</output>
}

function zeige() {
  const basis = createInitialState()
  const state: AppState = {
    ...basis,
    page: 'depot',
    depot: {
      ...basis.depot,
      holdings: [
        holding({ id: 'SP', name: 'iShares Core S&P 500', weight: 0.7 }),
        holding({ id: 'EU', name: 'Vanguard FTSE Developed Europe', weight: 0.3 }),
      ],
    },
  }
  return render(
    <LocaleProvider>
      <StoreProvider initialState={state}>
        <DepotPage />
        <Ziele />
      </StoreProvider>
    </LocaleProvider>,
  )
}

describe('Ziele auf der Karte', () => {
  beforeEach(() => {
    localStorage.setItem('zinseszins.locale', 'de')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('setzt per Klick auf eine Kachel ein Ziel für den ganzen Kontinent', async () => {
    const user = userEvent.setup()
    zeige()
    const karte = screen.getByRole('group', { name: /Weltkarte/ })
    // Im Kontinent-Modus steht jede Kachel für ihren Kontinent.
    await user.click(within(karte).getByRole('button', { name: /^Asien \(Japan\)/ }))
    const mindestens = screen.getByRole('textbox', { name: 'Mindestens, Asien' })
    await user.type(mindestens, '10{Enter}')
    expect(JSON.parse(screen.getByTestId('ziele').textContent ?? '[]')).toEqual([
      { dim: 'continent', key: 'asia', min: 0.1, max: null },
    ])
    // Das neue Ziel steht gleich in der Liste darunter - verfehlt, Asien fehlt im Depot.
    expect(screen.getAllByText(/Prozentpunkte zu wenig/).length).toBeGreaterThan(0)
  })

  it('wählt im Länder-Modus ein Land, zeigt seinen Anteil und entfernt das Ziel wieder', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(screen.getByRole('radio', { name: 'Länder' }))
    const karte = screen.getByRole('group', { name: /Weltkarte/ })
    await user.click(within(karte).getByRole('button', { name: /^Vereinigte Staaten · heute/ }))
    await user.type(screen.getByRole('textbox', { name: 'Höchstens, Vereinigte Staaten' }), '50{Enter}')
    expect(JSON.parse(screen.getByTestId('ziele').textContent ?? '[]')).toEqual([
      { dim: 'country', key: 'US', min: null, max: 0.5 },
    ])
    // Auch ohne Maus: dieselbe Auswahl steht als Liste unter der Karte.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Land' }), 'JP')
    // Japan steckt in keinem der beiden Fonds.
    expect(screen.getByText(/· nicht im Depot/)).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Land' }), 'US')
    const entfernen = screen.getAllByRole('button', { name: 'Ziel Vereinigte Staaten entfernen' })
    await user.click(entfernen[0])
    expect(JSON.parse(screen.getByTestId('ziele').textContent ?? '[]')).toEqual([])
  })
})
