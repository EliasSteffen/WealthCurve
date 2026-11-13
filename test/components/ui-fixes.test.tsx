import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketPanel } from '@/components/MarketPanel'
import { Dashboard } from '@/components/Dashboard'
import { WithdrawalPhaseToggle, TimelineControls } from '@/components/ModelSettings'
import { SliderField } from '@/components/ui/SliderField'
import { PARAMETERS } from '@/core/domain/parameters'
import type { MarketSeries, ModelSettings } from '@/core/domain/types'
import { actions, createInitialState, type AppState } from '@/core/state'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { useSeriesLabel } from '@/react/useSeriesLabel'
import { useDispatch, useSelector } from '@/react/useSelector'

function mitSprache(locale: 'de' | 'en', state: AppState, children: ReactNode) {
  localStorage.setItem('zinseszins.locale', locale)
  return (
    <LocaleProvider>
      <StoreProvider initialState={state}>{children}</StoreProvider>
    </LocaleProvider>
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('SliderField: Sprache', () => {
  function Feld() {
    const [wert, setWert] = useState(100)
    return (
      <LocaleProvider>
        <SliderField definition={PARAMETERS.monthlyContribution} value={wert} onChange={setWert} />
        <output data-testid="wert">{wert}</output>
      </LocaleProvider>
    )
  }

  it('liest im Englischen "1,500" als 1500', async () => {
    localStorage.setItem('zinseszins.locale', 'en')
    const user = userEvent.setup()
    render(<Feld />)
    const feld = screen.getByRole('textbox')
    await user.click(feld)
    await user.clear(feld)
    await user.type(feld, '1,500')
    expect(screen.getByTestId('wert')).toHaveTextContent('1500')
  })

  it('zeigt beim Fokus den Wert mit englischem Punkt', async () => {
    localStorage.setItem('zinseszins.locale', 'en')
    const user = userEvent.setup()
    render(
      <LocaleProvider>
        <SliderField definition={PARAMETERS.savingsRate} value={4.5} onChange={() => {}} />
      </LocaleProvider>,
    )
    await user.click(screen.getByRole('textbox'))
    expect(screen.getByRole('textbox')).toHaveValue('4.5')
  })

  it('bleibt im Deutschen bei Komma und Tausenderpunkt', async () => {
    localStorage.setItem('zinseszins.locale', 'de')
    const user = userEvent.setup()
    render(<Feld />)
    const feld = screen.getByRole('textbox')
    await user.click(feld)
    await user.clear(feld)
    await user.type(feld, '1.500')
    expect(screen.getByTestId('wert')).toHaveTextContent('1500')
  })
})

const markt = (symbol: string): MarketSeries => ({
  symbol,
  name: symbol,
  currency: 'USD',
  start: '1990-01',
  monthlyReturns: Array.from({ length: 24 }, () => 0.005),
})

describe('MarketPanel', () => {
  function Zustand() {
    const ids = useSelector((s) => s.enabledSeriesIds)
    const markets = useSelector((s) => s.markets)
    return (
      <>
        <output data-testid="an">{String(ids.includes('marketReturn'))}</output>
        <output data-testid="markets">{markets.map((m) => m.symbol).join(',')}</output>
      </>
    )
  }

  it('lässt die Kursserie nach zwei schnellen Abrufen eingeschaltet', async () => {
    const offen: Array<(r: Response) => void> = []
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('symbol=')) return Promise.resolve(json({ error: 'leer' }))
        return new Promise<Response>((resolve) => offen.push(resolve))
      }),
    )
    const state: AppState = {
      ...createInitialState(),
      enabledSeriesIds: createInitialState().enabledSeriesIds.filter((i) => i !== 'marketReturn'),
    }
    const user = userEvent.setup()
    render(
      mitSprache(
        'de',
        state,
        <>
          <MarketPanel />
          <Zustand />
        </>,
      ),
    )
    const feld = screen.getByRole('textbox')
    await user.type(feld, 'AAA{Enter}')
    await user.clear(feld)
    await user.type(feld, 'BBB{Enter}')
    expect(offen).toHaveLength(2)
    await act(async () => {
      offen[0](json(markt('AAA')))
      offen[1](json(markt('BBB')))
    })
    await waitFor(() => expect(screen.getByTestId('markets')).toHaveTextContent('AAA,BBB'))
    expect(screen.getByTestId('an')).toHaveTextContent('true')
  })

  it('sperrt die Vorschläge während eines Abrufs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('symbol=')
          ? Promise.resolve(
              new Response('{}', { status: 400, headers: { 'content-type': 'application/json' } }),
            )
          : new Promise<Response>(() => {}),
      ),
    )
    const user = userEvent.setup()
    render(mitSprache('de', createInitialState(), <MarketPanel />))
    await user.click(await screen.findByRole('button', { name: 'DAX' }))
    expect(screen.getByRole('button', { name: 'DAX' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Apple' })).toBeDisabled()
  })

  it('vergibt keine doppelte Feld-ID bei zwei Panels', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const { container } = render(
      mitSprache(
        'de',
        createInitialState(),
        <>
          <MarketPanel />
          <MarketPanel />
        </>,
      ),
    )
    const ids = [...container.querySelectorAll('input[type=text], input:not([type])')].map(
      (i) => i.id,
    )
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it('springt ohne Startjahr zur Zeitachse in den Eingaben', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const state: AppState = { ...createInitialState(), markets: [markt('AAA')] }
    const user = userEvent.setup()
    render(
      mitSprache(
        'de',
        state,
        <>
          <MarketPanel />
          <section data-setting="model:timeAxis">
            <input aria-label="Startjahr" />
          </section>
        </>,
      ),
    )
    expect(screen.getByText(/unter „Zeitachse" eintragen/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Abschnitt „Zeitachse" öffnen/ }))
    expect(screen.getByRole('textbox', { name: 'Startjahr' })).toHaveFocus()
  })
})

describe('Entnahmephase', () => {
  function Steuerung() {
    const dispatch = useDispatch()
    const model = useSelector((s) => s.model)
    const set = (next: ModelSettings) => dispatch(actions.setModel(next))
    return (
      <>
        <WithdrawalPhaseToggle value={model} onChange={set} />
        <TimelineControls category="auszahlung" value={model} onChange={set} />
        <output data-testid="jahre">{model.withdrawalYears}</output>
      </>
    )
  }
  const start = () => {
    const s = createInitialState()
    return { ...s, model: { ...s.model, withdrawalYears: 20 } }
  }

  it('lässt den Regler bei 1 enden und bei 0 nicht verschwinden', async () => {
    const user = userEvent.setup()
    render(mitSprache('de', start(), <Steuerung />))
    const regler = screen.getByRole('slider', { name: 'Entnahmephase' })
    expect(regler).toHaveAttribute('min', '1')

    const feld = screen.getByRole('textbox')
    await user.click(feld)
    await user.clear(feld)
    await user.type(feld, '0')
    expect(screen.getByRole('slider', { name: 'Entnahmephase' })).toBeInTheDocument()
    expect(screen.getByTestId('jahre')).toHaveTextContent('1')
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('merkt sich den Wert beim Ausschalten über den Schalter', async () => {
    const user = userEvent.setup()
    render(mitSprache('de', start(), <Steuerung />))
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByTestId('jahre')).toHaveTextContent('0')
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByTestId('jahre')).toHaveTextContent('20')
  })
})

describe('Kennzahlen im Plan', () => {
  it('weist auf ein ausgeblendetes aktives Szenario hin und blendet es wieder ein', async () => {
    const s = createInitialState()
    const zweites = { ...s.scenarios[0], id: 'zwei', label: 'Zwei', visible: true }
    const state: AppState = {
      ...s,
      scenarios: [{ ...s.scenarios[0], visible: false, label: 'Eins' }, zweites],
      activeScenarioId: s.scenarios[0].id,
    }
    const user = userEvent.setup()
    render(mitSprache('de', state, <Dashboard />))
    expect(screen.getByText(/„Eins“ ist ausgeblendet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Einblenden' }))
    expect(screen.queryByText(/ist ausgeblendet/)).toBeNull()
  })

  it('nennt das Aufbrauchjahr im Vergleich in der Beschriftung der Achse', async () => {
    const s = createInitialState()
    const state: AppState = {
      ...s,
      model: {
        ...s.model,
        timeAxis: 'calendar',
        startYear: 2000,
        accumulationYears: 5,
        withdrawalYears: 40,
        withdrawalStrategyId: 'fixedAmount',
      },
      scenarios: [
        {
          ...s.scenarios[0],
          params: { ...s.scenarios[0].params, monthlyWithdrawal: 10_000 },
        },
      ],
    }
    const user = userEvent.setup()
    render(mitSprache('de', state, <Dashboard />))
    await user.click(screen.getByRole('tab', { name: 'Vergleich' }))
    const aus = screen.getByText(/^bis \d{4}$/)
    expect(Number(aus.textContent?.slice(4))).toBeGreaterThanOrEqual(2000)
    expect(screen.queryByText(/^bis Jahr/)).toBeNull()
  })
})

describe('useSeriesLabel', () => {
  it('fällt bei leerem Szenarionamen auf "Szenario N" zurück', () => {
    const s = createInitialState()
    const state: AppState = {
      ...s,
      scenarios: [
        { ...s.scenarios[0], label: '' },
        { ...s.scenarios[0], id: 'zwei', label: 'Zwei' },
      ],
    }
    localStorage.setItem('zinseszins.locale', 'de')
    const { result } = renderHook(() => useSeriesLabel(), {
      wrapper: ({ children }) => mitSprache('de', state, children),
    })
    const name = result.current({
      key: 'k',
      scenarioId: state.scenarios[0].id,
      seriesId: 'compound',
      label: 'Zinseszins · ',
      scenarioLabel: '',
      colorVar: 'x',
      opacity: 1,
    })
    expect(name).toContain('Szenario 1')
  })
})

describe('useMediaQuery', () => {
  it('meldet sich über Re-Renders hinweg nur einmal an', () => {
    const add = vi.fn()
    const remove = vi.fn()
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: add,
      removeEventListener: remove,
    }))
    function Probe() {
      const [, setN] = useState(0)
      const matches = useMediaQuery('(min-width: 1024px)')
      return (
        <button type="button" onClick={() => setN((n) => n + 1)}>
          {String(matches)}
        </button>
      )
    }
    render(<Probe />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    expect(add).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })
})
