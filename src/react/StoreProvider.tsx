import { useMemo, type ReactNode } from 'react'
import { createInitialState, reducer, type AppState } from '../core/state'
import { createStore } from '../core/store'
import { StoreContext } from './storeContext'

export function StoreProvider({
  children,
  initialState,
}: {
  readonly children: ReactNode
  readonly initialState?: AppState
}) {
  // Einmal erzeugen - der Store lebt über Renders hinweg.
  const store = useMemo(
    () => createStore(reducer, initialState ?? createInitialState()),
    [initialState],
  )
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
