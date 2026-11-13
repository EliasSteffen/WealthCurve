import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Dashboard } from '@/components/Dashboard'
import { DepotPage } from '@/components/depot/DepotPage'
import { SeriesPanel } from '@/components/SeriesPanel'
import { actions, createInitialState, reducer, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { setFormatterLocale } from '@/lib/format'

function zeige(ui: React.ReactNode, over: Partial<AppState> = {}) {
  const state: AppState = { ...createInitialState(), ...over }
  return render(
    <LocaleProvider>
      <StoreProvider initialState={state}>{ui}</StoreProvider>
    </LocaleProvider>,
  )
}

describe('Englische Oberfläche', () => {
  beforeEach(() => localStorage.setItem('zinseszins.locale', 'en'))
  afterEach(() => {
    localStorage.setItem('zinseszins.locale', 'de')
    setFormatterLocale('de-DE')
  })

  describe('Bereiche und Plan-Formular', () => {
    it('beschriftet die Navigation englisch', () => {
      zeige(<Dashboard />)
      expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Savings plan' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('button', { name: 'Video' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'My portfolio' })).toBeInTheDocument()
    })

    it.each(['Initial capital', 'Monthly contribution', 'Return p. a.'])(
      'zeigt den Regler „%s“ ohne Suchen',
      (begriff) => {
        zeige(<Dashboard />)
        expect(screen.getByRole('slider', { name: begriff })).toBeInTheDocument()
      },
    )

    it('beschriftet Kopf, Eingaben und Abschnitte englisch', () => {
      zeige(<Dashboard />)
      expect(screen.getByText('Final value · 30 years')).toBeInTheDocument()
      const eingaben = screen.getByRole('region', { name: 'Inputs' })
      for (const titel of ['Savings plan', 'Duration', 'Payout', 'Assumptions', 'Curves', 'Real price histories', 'Time axis']) {
        expect(within(eingaben).getByRole('region', { name: titel })).toBeInTheDocument()
      }
      expect(screen.getByRole('tab', { name: 'Yearly values' })).toBeInTheDocument()
      expect(screen.queryByText('Auszahlung')).toBeNull()
    })
  })

  describe('Optionshinweise', () => {
    it('zeigt den Hinweis der gewählten Option sichtbar, nicht nur als title', async () => {
      const user = userEvent.setup()
      zeige(<Dashboard />)
      expect(
        screen.getByText('Twelve monthly steps add up to exactly the annual rate (ETF convention).'),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('radio', { name: 'Nominal', checked: false }))
      expect(
        screen.getByText(/Yields more than the annual rate you entered/),
      ).toBeInTheDocument()
      // Der Hinweis der abgewählten Option steht nicht mehr da.
      expect(screen.queryByText(/ETF convention/)).toBeNull()
    })

    it('zeigt auf Deutsch den deutschen Hinweis', () => {
      localStorage.setItem('zinseszins.locale', 'de')
      zeige(<Dashboard />)
      expect(screen.getByText(/Zwölf Monatsschritte ergeben exakt den Jahreszins/)).toBeInTheDocument()
    })
  })

  describe('Szenarien', () => {
    it('benennt neue Szenarien und Kopien englisch', async () => {
      const user = userEvent.setup()
      zeige(<Dashboard />)
      await user.click(screen.getByRole('button', { name: 'Add scenario' }))
      expect(screen.getByRole('tab', { name: /^Scenario 2/ })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Actions for “Basis”' }))
      await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
      expect(screen.getByRole('tab', { name: /^Basis \(copy\)/ })).toBeInTheDocument()
    })

    it('behält auf Deutsch die deutschen Standardnamen', async () => {
      localStorage.setItem('zinseszins.locale', 'de')
      const user = userEvent.setup()
      zeige(<Dashboard />)
      await user.click(screen.getByRole('button', { name: 'Szenario hinzufügen' }))
      expect(screen.getByRole('tab', { name: /^Szenario 2/ })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Aktionen für „Basis“' }))
      await user.click(screen.getByRole('menuitem', { name: 'Duplizieren' }))
      expect(screen.getByRole('tab', { name: /^Basis \(Kopie\)/ })).toBeInTheDocument()
    })
  })

  describe('Legende und Kapazität', () => {
    it('übersetzt den Kodierungshinweis aus der ID', async () => {
      zeige(<Dashboard />, reducer(createInitialState(), actions.addScenario('Two')))
      expect(await screen.findByText('Colour = scenario · dash = series')).toBeInTheDocument()
    })

    it('übersetzt die Warnung bei zu vielen Linien', () => {
      const capacity = { level: 'over', lineCount: 14, message: 'Deutsch' } as const
      zeige(
        <SeriesPanel enabledSeriesIds={[]} onToggle={() => {}} capacity={capacity} />,
      )
      expect(screen.getByText(/14 lines are hard to tell apart/)).toBeInTheDocument()
    })

    it('stellt dem Jahr in der Chart-Legende ein übersetztes „Year“ voran', async () => {
      zeige(<Dashboard />)
      expect(await screen.findByText('Year 30')).toBeInTheDocument()
    })
  })

  describe('Depot-Seite', () => {
    it('ist im leeren Zustand englisch beschriftet', () => {
      zeige(<DepotPage />)
      expect(screen.getByRole('heading', { name: 'Analyse your portfolio' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument()
      expect(screen.getByText('Drop your portfolio file here')).toBeInTheDocument()
      expect(screen.queryByText('Datei auswählen')).toBeNull()
    })
  })
})
