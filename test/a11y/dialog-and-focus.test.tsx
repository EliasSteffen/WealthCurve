import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { Dashboard } from '@/components/Dashboard'
import { ScenarioList } from '@/components/ScenarioList'
import { SettingsDialog } from '@/components/layout/SettingsDialog'
import { actions, createInitialState, reducer, type AppState } from '@/core/state'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { useSelector } from '@/react/useSelector'

beforeAll(() => {
  localStorage.setItem('zinseszins.locale', 'de')
  // jsdom kennt showModal/close nicht überall.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

function mit(state: AppState, children: React.ReactNode) {
  return (
    <LocaleProvider>
      <StoreProvider initialState={state}>{children}</StoreProvider>
    </LocaleProvider>
  )
}

describe('Einstellungsdialog: Reiter', () => {
  it('folgt dem Tabs-Muster mit Panel, aria-controls und Pfeiltasten', async () => {
    const user = userEvent.setup()
    render(mit(createInitialState(), <SettingsDialog theme="light" onThemeChange={() => {}} />))
    await user.click(screen.getByRole('button', { name: 'Einstellungen' }))

    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((x) => x.textContent)).toEqual(['Allgemein', 'Video'])
    expect(tabs.map((x) => x.getAttribute('tabindex'))).toEqual(['0', '-1'])

    const panel = screen.getByRole('tabpanel')
    for (const tab of tabs) expect(tab.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0]!.id)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    // Der lazy geladene Inhalt erscheint im Panel.
    expect(await screen.findByRole('radiogroup', { name: 'Sprache' })).toBeInTheDocument()

    tabs[0]!.focus()
    await user.keyboard('{ArrowRight}')
    expect(tabs[1]).toHaveFocus()
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[1]!.id)
    await user.keyboard('{ArrowRight}')
    expect(tabs[0]).toHaveFocus()
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowLeft}')
    expect(tabs[1]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Backdrop-Klick', () => {
  function cases(name: string, ui: React.ReactElement, openName: string) {
    it(`${name}: schließt nur bei pointerdown UND click auf dem Backdrop`, async () => {
      const user = userEvent.setup()
      const { container } = render(ui)
      await user.click(screen.getByRole('button', { name: openName }))
      const dialog = container.querySelector('dialog') as HTMLDialogElement
      await waitFor(() => expect(dialog).toHaveAttribute('open'))
      const inner = dialog.querySelector('h2, [role="tablist"]') as HTMLElement

      // Text markieren: Drücken im Inhalt, Loslassen auf dem Backdrop.
      fireEvent.pointerDown(inner)
      fireEvent.click(dialog)
      expect(dialog).toHaveAttribute('open')

      // Drücken auf dem Backdrop, Loslassen im Inhalt (click landet auf dem Dialog).
      fireEvent.pointerDown(dialog)
      fireEvent.click(inner)
      expect(dialog).toHaveAttribute('open')

      // Beides auf dem Backdrop.
      fireEvent.pointerDown(dialog)
      fireEvent.click(dialog)
      await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
    })
  }
  cases(
    'SettingsDialog',
    mit(createInitialState(), <SettingsDialog theme="light" onThemeChange={() => {}} />),
    'Einstellungen',
  )
})

describe('Fokus nach Aktionen', () => {
  function Liste() {
    const s = useSelector((x) => x)
    return <ScenarioList scenarios={s.scenarios} activeScenarioId={s.activeScenarioId} />
  }
  const drei = () => {
    let s = createInitialState()
    s = reducer(s, actions.addScenario('Zwei'))
    s = reducer(s, actions.addScenario('Drei'))
    return s
  }

  it('Löschen setzt den Fokus auf das nächste Szenario, am Ende auf das vorherige', async () => {
    const user = userEvent.setup()
    render(mit(drei(), <Liste />))
    const names = () => screen.getAllByRole('textbox').map((x) => (x as HTMLInputElement).value)
    expect(names()).toHaveLength(3)

    await user.click(screen.getAllByRole('button', { name: 'Löschen' })[1]!)
    expect(names()).toEqual([expect.any(String), 'Drei'])
    expect(screen.getByRole('textbox', { name: 'Name von Drei' })).toHaveFocus()

    await user.click(screen.getAllByRole('button', { name: 'Löschen' })[1]!)
    expect(names()).toHaveLength(1)
    expect(screen.getAllByRole('textbox')[0]).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

})

describe('Bereichs-Navigation', () => {
  it('markiert den offenen Bereich und wechselt ohne Neuladen', async () => {
    const user = userEvent.setup()
    render(mit(createInitialState(), <Dashboard />))
    const nav = screen.getByRole('navigation', { name: 'Bereiche' })
    const sparplan = screen.getByRole('button', { name: 'Sparplan' })
    const depot = screen.getByRole('button', { name: 'Mein Depot' })
    expect(nav).toContainElement(sparplan)
    expect(sparplan).toHaveAttribute('aria-current', 'page')
    expect(depot).not.toHaveAttribute('aria-current')
    // Das Video gehört zur Vermögenskurve.
    expect(screen.getByRole('button', { name: 'Video' })).toBeInTheDocument()

    await user.click(depot)
    expect(depot).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Dein Depot durchleuchten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Datei auswählen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Video' })).toBeNull()
    // Genau ein Weg zu den Einstellungen, nicht drei.
    expect(screen.getAllByRole('button', { name: 'Einstellungen' })).toHaveLength(1)
  })

  it('zeigt im Sparplan zuerst den Plan, die Extras zugeklappt', () => {
    const { container } = render(mit(createInitialState(), <Dashboard />))
    expect(screen.getByRole('heading', { name: 'Dein Plan' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Monatliche Sparrate' })).toBeInTheDocument()
    const abschnitte = [...container.querySelectorAll('details')]
    expect(abschnitte.length).toBeGreaterThanOrEqual(4)
    expect(abschnitte.every((d) => !d.open)).toBe(true)
    // Ohne Entnahmephase ab Werk.
    expect(screen.queryByText('Rentenbeginn')).toBeNull()
  })
})
