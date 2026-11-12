import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DepotPage } from '@/components/depot/DepotPage'
import { MAP_CONTINENTS, MAP_COUNTRIES, MAP_DOTS } from '@/components/depot/worldMap.generated'
import { COUNTRIES } from '@/core/depot/lookthrough'
import type { DepotHolding } from '@/core/depot/types'
import { createInitialState, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { useSelector } from '@/react/useSelector'

describe('Weltkarte', () => {
  it('zeichnet jedes Land der Durchschau - als Umriss oder als Punkt - und alle Kontinente', () => {
    const gezeichnet = new Set([...MAP_COUNTRIES.map((c) => c.code), ...MAP_DOTS.map((d) => d.code)])
    const fehlen = Object.values(COUNTRIES)
      .map((c) => c.code)
      .filter((code) => !gezeichnet.has(code))
    expect(fehlen).toEqual([])
    expect(MAP_COUNTRIES.length).toBeGreaterThan(150)
    expect(MAP_CONTINENTS.map((c) => c.continent).sort()).toEqual(
      ['africa', 'asia', 'europe', 'northAmerica', 'oceania', 'southAmerica'],
    )
    // Jedes Land gehört zu einem Kontinent, sonst fehlte es im Kontinent-Modus.
    expect(MAP_COUNTRIES.filter((c) => c.continent === null).map((c) => c.code)).toEqual([])
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

  it('setzt per Klick auf einen Kontinent ein Ziel für den ganzen Kontinent', async () => {
    const user = userEvent.setup()
    zeige()
    const karte = await screen.findByRole('group', { name: /Weltkarte/ })
    // Im Kontinent-Modus sind die Kontinente je ein Umriss.
    await user.click(within(karte).getByRole('button', { name: /^Asien ·/ }))
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
    const karte = await screen.findByRole('group', { name: /Weltkarte/ })
    await user.click(within(karte).getByRole('button', { name: /^Vereinigte Staaten · heute/ }))
    await user.type(screen.getByRole('textbox', { name: 'Höchstens, Vereinigte Staaten' }), '50{Enter}')
    expect(JSON.parse(screen.getByTestId('ziele').textContent ?? '[]')).toEqual([
      { dim: 'country', key: 'US', min: null, max: 0.5 },
    ])
    // Auch ohne Maus: dieselbe Auswahl steht als Liste unter der Karte.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Land' }), 'JP')
    // Japan steckt in keinem der beiden Fonds.
    expect(screen.getByText('Japan', { selector: 'span' }).parentElement).toHaveTextContent('Japan · nicht im Depot')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Land' }), 'US')
    const entfernen = screen.getAllByRole('button', { name: 'Ziel Vereinigte Staaten entfernen' })
    await user.click(entfernen[0])
    expect(JSON.parse(screen.getByTestId('ziele').textContent ?? '[]')).toEqual([])
  })
})
