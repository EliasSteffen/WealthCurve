import { createContext, useContext } from 'react'
import type { Action, AppState } from '../core/state'
import type { Store } from '../core/store'

export type AppStore = Store<AppState, Action>

export const StoreContext = createContext<AppStore | null>(null)

export function useStore(): AppStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore muss innerhalb von <StoreProvider> aufgerufen werden')
  return store
}
