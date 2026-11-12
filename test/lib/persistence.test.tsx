import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '@/components/Dashboard'
import { actions, createInitialState, reducer, serialize } from '@/core/state'
import { createStore } from '@/core/store'
import {
  attachPersistence,
  buildShareUrl,
  decodeShare,
  encodeShare,
  loadSavedState,
  resolveInitialState,
  saveState,
  STORAGE_KEY,
} from '@/lib/persistence'
import { LocaleProvider } from '@/react/LocaleProvider'
import { StoreProvider } from '@/react/StoreProvider'
import { useStore } from '@/react/storeContext'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('zinseszins.locale', 'de')
  history.replaceState(null, '', '/')
  // jsdom hat kein matchMedia; Dashboard fragt es für Sidebar/Sheet ab.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})
afterEach(() => vi.restoreAllMocks())

describe('localStorage', () => {
  it('Round-Trip', () => {
    const s = reducer(createInitialState(), actions.addScenario('Größe 🚀'))
    saveState(s)
    expect(loadSavedState()).toEqual(s)
    expect(resolveInitialState().state).toEqual(s)
  })

  it('kaputtes JSON ergibt den Ausgangszustand', () => {
    localStorage.setItem(STORAGE_KEY, '{nope')
    const { state } = resolveInitialState()
    expect(loadSavedState()).toBeNull()
    expect(state.scenarios).toHaveLength(createInitialState().scenarios.length)
  })

  it('wirft der Speicher, läuft die App trotzdem', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota')
    })
    vi.useFakeTimers()
    try {
      const ref: { dispatch?: (a: ReturnType<typeof actions.addScenario>) => void } = {}
      function Probe() {
        const { dispatch } = useStore()
        useEffect(() => {
          ref.dispatch = dispatch
        })
        return null
      }
      render(
        <LocaleProvider>
          <StoreProvider>
            <Dashboard />
            <Probe />
          </StoreProvider>
        </LocaleProvider>,
      )
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      act(() => ref.dispatch?.(actions.addScenario('X')))
      expect(() => vi.advanceTimersByTime(500)).not.toThrow()
    } finally {
      vi.useRealTimers()
    }
  })

  it('speichert entprellt und beim pagehide', () => {
    vi.useFakeTimers()
    try {
      const store = createStore(reducer, createInitialState())
      const detach = attachPersistence(store)
      store.dispatch(actions.addScenario('A'))
      store.dispatch(actions.addScenario('B'))
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
      vi.advanceTimersByTime(300)
      expect(localStorage.getItem(STORAGE_KEY)).toBe(serialize(store.getSnapshot()))
      store.dispatch(actions.addScenario('C'))
      window.dispatchEvent(new Event('pagehide'))
      expect(localStorage.getItem(STORAGE_KEY)).toBe(serialize(store.getSnapshot()))
      detach()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Teilen-Link', () => {
  it('Round-Trip inklusive Umlauten und Emoji, ohne markets/UI-Felder', () => {
    const s = {
      ...reducer(createInitialState(), actions.addScenario('Größe 🚀')),
      sidebarCollapsed: true,
    }
    const encoded = encodeShare(s)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    const back = decodeShare(encoded)
    expect(back?.scenarios.map((x) => x.label)).toContain('Größe 🚀')
    expect(back?.scenarios.map((x) => x.params)).toEqual(s.scenarios.map((x) => x.params))
    expect(back?.sidebarCollapsed).toBe(false)
    expect(back?.markets).toEqual([])
  })

  it('ungültiger Hash wird ignoriert', () => {
    expect(decodeShare('%%%')).toBeNull()
    expect(decodeShare('e30')).toBeNull()
    saveState(reducer(createInitialState(), actions.addScenario('Gespeichert')))
    history.replaceState(null, '', '/#s=!!!kaputt')
    const { state, fromLink } = resolveInitialState()
    expect(fromLink).toBe(false)
    expect(state.scenarios.some((x) => x.label === 'Gespeichert')).toBe(true)
  })

  it('gültiger Hash gewinnt und wird danach entfernt', () => {
    saveState(reducer(createInitialState(), actions.addScenario('Gespeichert')))
    const shared = reducer(createInitialState(), actions.addScenario('Geteilt'))
    const url = buildShareUrl(shared, { origin: '', pathname: '/', search: '' })
    history.replaceState(null, '', url)
    const { state, fromLink } = resolveInitialState()
    expect(fromLink).toBe(true)
    expect(state.scenarios.some((x) => x.label === 'Geteilt')).toBe(true)
    expect(window.location.hash).toBe('')
  })
})

describe('Zurücksetzen', () => {
  it('verlangt eine Bestätigung', async () => {
    // jsdom kennt showModal nicht überall.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    const user = userEvent.setup()
    render(
      <LocaleProvider>
        <StoreProvider initialState={reducer(createInitialState(), actions.addScenario('Extra'))}>
          <Dashboard />
        </StoreProvider>
      </LocaleProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Einstellungen' }))
    await user.click(await screen.findByRole('tab', { name: 'Allgemein' }))
    await user.click(await screen.findByRole('button', { name: 'Zurücksetzen' }))
    expect(screen.getByText('Wirklich zurücksetzen?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByText('Wirklich zurücksetzen?')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
    await user.click(screen.getByRole('button', { name: 'Ja, zurücksetzen' }))
    expect(screen.getByRole('button', { name: 'Zurücksetzen' })).toBeInTheDocument()
  })
})
