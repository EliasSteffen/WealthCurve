import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import { createInitialState, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'

// jsdom meldet navigator.language = "en-US"; ohne diese Zeile prüfte der Test
// die englische Oberfläche und die Beschriftungen hier gingen ins Leere.
beforeEach(() => localStorage.setItem('zinseszins.locale', 'de'))

function zeige(over: Partial<AppState> = {}) {
  const state: AppState = { ...createInitialState(), settingsView: 'alles', ...over }
  return render(
    <LocaleProvider>
      <StoreProvider initialState={state}>
        <SettingsPanel />
      </StoreProvider>
    </LocaleProvider>,
  )
}

/**
 * Der Abschnitt zu einem Bereich, gefunden über seine Überschrift.
 *
 * Über `data-scope` und nicht über das Element: `Card` ist selbst ein
 * `<section>`, `closest('section')` fände also die nächste Karte.
 */
function bereich(ueberschrift: string | RegExp): HTMLElement {
  const h = screen.getByRole('heading', { name: ueberschrift })
  const abschnitt = h.closest('[data-scope]')
  if (!(abschnitt instanceof HTMLElement)) throw new Error('Überschrift steht in keinem Bereich')
  return abschnitt
}

/** Der Regler zu einem Namen - SliderField zeigt Feld und Schieber zugleich. */
const regler = (wo: HTMLElement, name: string) => within(wo).queryByRole('slider', { name })

describe('SettingsPanel: Bereiche', () => {
  it('trennt die Werte des Szenarios von denen darüber hinaus', () => {
    /*
     * Der Punkt aus der To-Do-Liste: „es muss visuell deutlich werden, was je
     * scenario gespeichert wird und was über die scenarien hinweg gilt".
     *
     * Sparrate und Ansparphase standen zuvor in derselben Karte - die eine wird
     * im Szenario gespeichert, die andere gilt für alle.
     */
    zeige()
    expect(regler(bereich(/Basis/), 'Monatliche Sparrate')).toBeInTheDocument()
    expect(regler(bereich('Für alle Szenarien'), 'Ansparphase')).toBeInTheDocument()

    expect(regler(bereich(/Basis/), 'Ansparphase')).toBeNull()
    expect(regler(bereich('Für alle Szenarien'), 'Monatliche Sparrate')).toBeNull()
  })

  it('nennt den Bereich beim Namen des aktiven Szenarios', () => {
    // „Nur dieses Szenario" wäre richtig und trotzdem vage - der Name macht es
    // überprüfbar, ohne erst in die Liste darüber sehen zu müssen.
    const state = createInitialState()
    zeige({
      scenarios: [{ ...state.scenarios[0], label: 'Aggressiv' }],
      activeScenarioId: state.scenarios[0].id,
    })
    expect(screen.getByRole('heading', { name: /Aggressiv/ })).toBeInTheDocument()
  })

  it('führt die Szenarienliste über beiden Bereichen, nicht in einem', () => {
    // Sie ist der Umschalter, auf den sich „nur dieses" bezieht.
    zeige()
    expect(screen.getByLabelText('Name von Basis').closest('[data-scope]')).toBeNull()
  })

  it('klappt die beiden Hälften einer Kategorie unabhängig zu', async () => {
    const user = userEvent.setup()
    zeige()
    const szenario = within(bereich(/Basis/)).getByRole('button', { name: /Einzahlung/ })
    await user.click(szenario)

    expect(szenario).toHaveAttribute('aria-expanded', 'false')
    expect(
      within(bereich('Für alle Szenarien')).getByRole('button', { name: /Einzahlung/ }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('öffnet bei einer Suche genau die Karten mit Treffern', async () => {
    const user = userEvent.setup()
    zeige()
    await user.type(screen.getByLabelText('Einstellung suchen …'), 'Ansparphase')

    expect(regler(bereich('Für alle Szenarien'), 'Ansparphase')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Basis/ })).toBeNull()
  })
})
