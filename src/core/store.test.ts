import { describe, expect, it, vi } from 'vitest'
import { selectProjection } from './derive'
import { actions, createInitialState, reducer } from './state'
import { createStore } from './store'

const makeStore = () => createStore(reducer, createInitialState())

describe('Store', () => {
  it('liefert bei unverändertem State dieselbe Referenz', () => {
    // Der Vertrag von useSyncExternalStore. Bricht er, rendert React endlos -
    // das äußert sich als Hänger, nicht als Testfehler. Deshalb hier festhalten.
    const store = makeStore()
    expect(store.getSnapshot()).toBe(store.getSnapshot())
  })

  it('benachrichtigt nur bei echten Änderungen', () => {
    const store = makeStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.dispatch(actions.addScenario('Zweites'))
    expect(listener).toHaveBeenCalledTimes(1)

    // Wirkungslos: der Reducer gibt denselben State zurück.
    store.dispatch(actions.selectScenario('gibt-es-nicht'))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('meldet sich nach unsubscribe nicht mehr', () => {
    const store = makeStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.dispatch(actions.addScenario('Zweites'))
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('Selektoren', () => {
  it('memoisieren auf Referenz-Ebene', () => {
    const store = makeStore()
    const first = selectProjection(store.getSnapshot())
    expect(selectProjection(store.getSnapshot())).toBe(first)
  })

  it('rechnen bei relevanter Änderung neu', () => {
    const store = makeStore()
    const before = selectProjection(store.getSnapshot())
    store.dispatch(actions.setParam(store.getSnapshot().scenarios[0].id, 'annualRate', 3))
    expect(selectProjection(store.getSnapshot())).not.toBe(before)
  })

  it('rechnen bei irrelevanter Änderung nicht neu', () => {
    // Die Sidebar zu schließen darf keine Simulation auslösen.
    const store = makeStore()
    const before = selectProjection(store.getSnapshot())
    store.dispatch(actions.setSidebarCollapsed(true))
    expect(selectProjection(store.getSnapshot())).toBe(before)
  })
})
