import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ChartLegend } from '@/components/chart/ChartLegend'
import { ChartTooltip } from '@/components/chart/ChartTooltip'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import { SettingsSheet } from '@/components/layout/SettingsSheet'
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

  describe('Einstellungssuche', () => {
    it.each(['Initial capital', 'Monthly contribution', 'Return p. a.'])(
      'findet die sichtbare Beschriftung „%s“',
      async (begriff) => {
        const user = userEvent.setup()
        zeige(<SettingsPanel />)
        await user.type(screen.getByLabelText('Search settings …'), begriff)
        expect(screen.queryByText(/Nothing found/)).toBeNull()
        expect(screen.getAllByRole('slider').length).toBeGreaterThan(0)
      },
    )

    it('filtert auf den passenden Regler', async () => {
      const user = userEvent.setup()
      zeige(<SettingsPanel />)
      await user.type(screen.getByLabelText('Search settings …'), 'Initial capital')
      expect(screen.getByRole('slider', { name: 'Initial capital' })).toBeInTheDocument()
      expect(screen.queryByRole('slider', { name: 'Return p. a.' })).toBeNull()
    })

    it('findet auch Einträge ohne eigenes Registry über die englischen Stichwörter', async () => {
      const user = userEvent.setup()
      zeige(<SettingsPanel />)
      await user.type(screen.getByLabelText('Search settings …'), 'purchasing power')
      expect(screen.queryByText(/Nothing found/)).toBeNull()
    })

    it('findet weiterhin deutsche Begriffe', async () => {
      const user = userEvent.setup()
      zeige(<SettingsPanel />)
      await user.type(screen.getByLabelText('Search settings …'), 'Sparrate')
      expect(screen.queryByText(/Nothing found/)).toBeNull()
    })

    it('meldet bei Unsinn weiterhin „Nothing found“', async () => {
      const user = userEvent.setup()
      zeige(<SettingsPanel />)
      await user.type(screen.getByLabelText('Search settings …'), 'qqqxyz')
      expect(screen.getByText(/Nothing found/)).toBeInTheDocument()
    })
  })

  describe('Optionshinweise', () => {
    it('zeigt den Hinweis der gewählten Option sichtbar, nicht nur als title', async () => {
      const user = userEvent.setup()
      zeige(<SettingsPanel />)
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
      zeige(<SettingsPanel />)
      expect(screen.getByText(/Zwölf Monatsschritte ergeben exakt den Jahreszins/)).toBeInTheDocument()
    })
  })

  describe('Szenarien', () => {
    it('benennt neue Szenarien und Kopien englisch', async () => {
      const user = userEvent.setup()
      zeige(<SettingsPanel />)
      await user.click(screen.getByRole('button', { name: 'Add scenario' }))
      expect(screen.getByDisplayValue('Scenario 2')).toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'Duplicate' })[0])
      expect(screen.getByDisplayValue('Basis (copy)')).toBeInTheDocument()
    })

    it('behält auf Deutsch die deutschen Standardnamen', async () => {
      localStorage.setItem('zinseszins.locale', 'de')
      const user = userEvent.setup()
      zeige(<SettingsPanel />)
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

  describe('Mobiles Einstellungs-Sheet', () => {
    it('ist englisch beschriftet', () => {
      zeige(<SettingsSheet />)
      const knopf = screen.getByRole('button', { name: 'Open settings' })
      expect(within(knopf).getByText('Settings')).toBeInTheDocument()
      expect(screen.queryByText('Einstellungen')).toBeNull()
    })
  })
})
