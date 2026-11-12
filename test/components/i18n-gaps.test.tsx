import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ChartLegend } from '@/components/chart/ChartLegend'
import { ChartTooltip } from '@/components/chart/ChartTooltip'
import { Dashboard } from '@/components/Dashboard'
import { DepotPage } from '@/components/depot/DepotPage'
import { SparplanPage } from '@/components/sparplan/SparplanPage'
import { SeriesPanel } from '@/components/SeriesPanel'
import { buildProjection } from '@/core/projection'
import { createInitialState, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { setFormatterLocale } from '@/lib/format'

function zeige(ui: React.ReactNode, over: Partial<AppState> = {}) {
  const state: AppState = { ...createInitialState(), settingsView: 'alles', ...over }
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
      expect(screen.getByRole('button', { name: 'My portfolio' })).toBeInTheDocument()
    })

    it.each(['Initial capital', 'Monthly contribution', 'Return p. a.'])(
      'zeigt den Regler „%s“ ohne Suchen',
      (begriff) => {
        zeige(<SparplanPage />)
        expect(screen.getByRole('slider', { name: begriff })).toBeInTheDocument()
      },
    )

    it('beschriftet Plan und Abschnitte englisch', () => {
      zeige(<SparplanPage />)
      expect(screen.getByRole('heading', { name: 'Your plan' })).toBeInTheDocument()
      for (const titel of ['Payout', 'Assumptions', 'Curves & style', 'Real price histories', 'Time axis']) {
        expect(screen.getAllByText(titel).length).toBeGreaterThan(0)
      }
      expect(screen.queryByText('Auszahlung')).toBeNull()
    })
  })

  describe('Optionshinweise', () => {
    it('zeigt den Hinweis der gewählten Option sichtbar, nicht nur als title', async () => {
      const user = userEvent.setup()
      zeige(<SparplanPage />)
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
      zeige(<SparplanPage />)
      expect(screen.getByText(/Zwölf Monatsschritte ergeben exakt den Jahreszins/)).toBeInTheDocument()
    })
  })

  describe('Szenarien', () => {
    it('benennt neue Szenarien und Kopien englisch', async () => {
      const user = userEvent.setup()
      zeige(<SparplanPage />)
      await user.click(screen.getByRole('button', { name: 'Add scenario' }))
      expect(screen.getByDisplayValue('Scenario 2')).toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'Duplicate' })[0])
      expect(screen.getByDisplayValue('Basis (copy)')).toBeInTheDocument()
    })

    it('behält auf Deutsch die deutschen Standardnamen', async () => {
      localStorage.setItem('zinseszins.locale', 'de')
      const user = userEvent.setup()
      zeige(<SparplanPage />)
      await user.click(screen.getByRole('button', { name: 'Szenario hinzufügen' }))
      expect(screen.getByDisplayValue('Szenario 2')).toBeInTheDocument()
      await user.click(screen.getAllByRole('button', { name: 'Duplizieren' })[0])
      expect(screen.getByDisplayValue('Basis (Kopie)')).toBeInTheDocument()
    })
  })

  describe('Legende, Kapazität, Tooltip', () => {
    it('übersetzt den Kodierungshinweis aus der ID', () => {
      zeige(
        <ChartLegend
          series={[]}
          rows={[]}
          encodingId="colorByScenario"
          encodingDescription="Farbe = Szenario · Strich = Serie"
          seriesCount={2}
          showEncodingHint
        />,
      )
      expect(screen.getByText('Colour = scenario · dash = series')).toBeInTheDocument()
    })

    it('übersetzt die Warnung bei zu vielen Linien', () => {
      const capacity = { level: 'over', lineCount: 14, message: 'Deutsch' } as const
      zeige(
        <SeriesPanel enabledSeriesIds={[]} onToggle={() => {}} capacity={capacity} />,
      )
      expect(screen.getByText(/14 lines are hard to tell apart/)).toBeInTheDocument()
    })

    it('stellt dem Tooltip-Index ein übersetztes „Year“ voran', () => {
      const projection = buildProjection({
        scenarios: createInitialState().scenarios,
        model: createInitialState().model,
        seriesIds: ['compound'],
      })
      const line = projection.lines[0]
      zeige(
        <ChartTooltip
          active
          label={3}
          payload={[{ dataKey: line.key, value: 1000 }]}
          series={projection.lines}
        />,
      )
      expect(screen.getByText('Year 3')).toBeInTheDocument()
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
