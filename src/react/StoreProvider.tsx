import { useEffect, useMemo, type ReactNode } from 'react'
import { reducer, type AppState } from '../core/state'
import { createStore } from '../core/store'
import { attachPersistence, resolveInitialState, saveState } from '../lib/persistence'
import { StoreContext } from './storeContext'

export function StoreProvider({
  children,
  initialState,
}: {
  readonly children: ReactNode
  readonly initialState?: AppState
}) {
  // Einmal erzeugen - der Store lebt über Renders hinweg. Ohne expliziten
  // Startzustand kommt er aus Link oder Speicher; Tests mit `initialState`
  // bleiben davon unberührt (und schreiben auch nichts weg).
  const { store, fromLink } = useMemo(() => {
    const start = initialState ? { state: initialState, fromLink: false } : resolveInitialState()
    return { store: createStore(reducer, start.state), fromLink: start.fromLink }
  }, [initialState])

  useEffect(() => {
    if (initialState) return
    // Ein importierter Link ersetzt den Speicher sofort, nicht erst bei der ersten Änderung.
    if (fromLink) saveState(store.getSnapshot())
    return attachPersistence(store)
  }, [store, fromLink, initialState])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
