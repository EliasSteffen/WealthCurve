import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { Dashboard } from '@/components/Dashboard'
import { actions, createInitialState, reducer, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('zinseszins.locale', 'de')
})

function mit(state: AppState) {
  return (
    <LocaleProvider>
      <StoreProvider initialState={state}>
        <Dashboard />
      </StoreProvider>
    </LocaleProvider>
  )
}

const drei = () => {
  let s = createInitialState()
  s = reducer(s, actions.addScenario('Zwei'))
  s = reducer(s, actions.addScenario('Drei'))
  return reducer(s, actions.selectScenario(s.scenarios[1].id))
}

describe('Bereichs-Navigation', () => {
  it('markiert den offenen Bereich und wechselt ohne Neuladen', async () => {
    const user = userEvent.setup()
    render(mit(createInitialState()))
    const nav = screen.getByRole('navigation', { name: 'Bereiche' })
    const plan = within(nav).getByRole('button', { name: /Sparplan/ })
    const depot = within(nav).getByRole('button', { name: /Depot/ })
    expect(plan).toHaveAttribute('aria-current', 'page')
    expect(depot).not.toHaveAttribute('aria-current')

    await user.click(depot)
    expect(depot).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Dein Depot durchleuchten' })).toBeInTheDocument()

    // Das Video ist ein eigener Bereich, kein Dialog mehr.
    await user.click(within(nav).getByRole('button', { name: /Video/ }))
    expect(within(nav).getByRole('button', { name: /Video/ })).toHaveAttribute('aria-current', 'page')
  })

  it('zeigt im Plan alle Eingaben offen - nichts versteckt sich hinter einem Pfeil', () => {
    const { container } = render(mit(createInitialState()))
    expect(screen.getByRole('slider', { name: 'Monatliche Sparrate' })).toBeInTheDocument()
    expect(container.querySelectorAll('details')).toHaveLength(0)
    for (const name of ['Sparplan', 'Laufzeit', 'Auszahlung', 'Annahmen', 'Kurven', 'Echte Kursverläufe', 'Zeitachse']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    // Ohne Entnahmephase ab Werk.
    expect(screen.queryByText('Rentenbeginn')).toBeNull()
  })
})

describe('Menü', () => {
  it('öffnet mit Pfeil runter, wandert mit Pfeilen und gibt den Fokus beim Schließen zurück', async () => {
    const user = userEvent.setup()
    render(mit(createInitialState()))
    const knopf = screen.getByRole('button', { name: 'Weitere Aktionen' })
    knopf.focus()
    await user.keyboard('{ArrowDown}')
    const menu = screen.getByRole('menu', { name: 'Weitere Aktionen' })
    const eintraege = within(menu).getAllByRole('menuitem')
    expect(eintraege[0]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(eintraege.at(-1)).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(knopf).toHaveFocus()
    expect(knopf).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Rückfrage beim Zurücksetzen', () => {
  async function oeffnen() {
    const user = userEvent.setup()
    const ansicht = render(mit(reducer(createInitialState(), actions.addScenario('Extra'))))
    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }))
    await user.click(screen.getByRole('menuitem', { name: 'Zurücksetzen …' }))
    const dialog = screen.getByRole('dialog', { name: 'Alles zurücksetzen?' }) as HTMLDialogElement
    return { user, dialog, ansicht }
  }

  it('fragt nach und setzt erst nach Bestätigung zurück', async () => {
    const { user, dialog } = await oeffnen()
    expect(dialog).toHaveAttribute('open')
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    expect(dialog).not.toHaveAttribute('open')
    expect(screen.getByRole('tab', { name: /^Extra/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }))
    await user.click(screen.getByRole('menuitem', { name: 'Zurücksetzen …' }))
    await user.click(within(dialog).getByRole('button', { name: 'Ja, zurücksetzen' }))
    expect(screen.queryByRole('tab', { name: /^Extra/ })).toBeNull()
  })

  it('schließt nur bei pointerdown UND click auf dem Backdrop', async () => {
    const { dialog } = await oeffnen()
    const inner = dialog.querySelector('h2') as HTMLElement

    // Text markieren: Drücken im Inhalt, Loslassen auf dem Backdrop.
    fireEvent.pointerDown(inner)
    fireEvent.click(dialog)
    expect(dialog).toHaveAttribute('open')

    // Drücken auf dem Backdrop, Loslassen im Inhalt.
    fireEvent.pointerDown(dialog)
    fireEvent.click(inner)
    expect(dialog).toHaveAttribute('open')

    // Beides auf dem Backdrop.
    fireEvent.pointerDown(dialog)
    fireEvent.click(dialog)
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
  })
})

describe('Szenario-Reiter', () => {
  it('folgt dem Tabs-Muster: genau ein Reiter im Tab-Fokus', () => {
    render(mit(drei()))
    const reiter = within(screen.getByRole('tablist', { name: 'Szenarien' })).getAllByRole('tab')
    expect(reiter).toHaveLength(3)
    expect(reiter.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('Löschen setzt den Fokus auf das nächste Szenario, am Ende auf das vorherige', async () => {
    const user = userEvent.setup()
    render(mit(drei()))
    await user.click(screen.getByRole('button', { name: 'Aktionen für „Zwei“' }))
    await user.click(screen.getByRole('menuitem', { name: 'Löschen' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Drei/ })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Aktionen für „Drei“' }))
    await user.click(screen.getByRole('menuitem', { name: 'Löschen' }))
    await waitFor(() => expect(screen.getAllByRole('tab', { name: /Basis/ })[0]).toHaveFocus())
    expect(document.body).not.toHaveFocus()
  })
})

describe('Befehlspalette', () => {
  it('öffnet mit Strg+K, filtert, wandert mit Pfeilen und springt zur Einstellung', async () => {
    const user = userEvent.setup()
    render(mit(createInitialState()))
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const eingabe = await screen.findByRole('combobox', { name: 'Suchen und Befehle' })
    expect(eingabe).toHaveFocus()

    await user.type(eingabe, 'sparrate')
    const optionen = screen.getAllByRole('option')
    expect(optionen[0]).toHaveTextContent('Monatliche Sparrate')
    expect(eingabe).toHaveAttribute('aria-activedescendant', optionen[0].id)
    await user.keyboard('{ArrowDown}')
    expect(eingabe).toHaveAttribute('aria-activedescendant', optionen[1].id)
    await user.keyboard('{ArrowUp}{Enter}')

    // Der Sprung setzt den Fokus ins Feld der Einstellung.
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Monatliche Sparrate/ })).toHaveFocus())
    expect(document.querySelector('dialog.palette')).not.toHaveAttribute('open')
  })

  it('findet auf Englisch auch mit deutschem Begriff und wechselt den Bereich', async () => {
    localStorage.setItem('zinseszins.locale', 'en')
    const user = userEvent.setup()
    render(mit(createInitialState()))
    await user.click(screen.getByRole('button', { name: 'Search and commands' }))
    const eingabe = await screen.findByRole('combobox', { name: 'Search and commands' })
    await user.type(eingabe, 'Zinsmodus')
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Compounding')

    await user.clear(eingabe)
    await user.type(eingabe, 'portfolio{Enter}')
    expect(screen.getByRole('button', { name: 'My portfolio' })).toHaveAttribute('aria-current', 'page')
  })
})
