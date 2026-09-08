import { useSyncExternalStore } from 'react'
import type { AppState } from '../core/state'
import { useStore } from './storeContext'
import type { Action } from '../core/state'

/**
 * Liest einen abgeleiteten Wert aus dem Store.
 *
 * `selector` MUSS memoisiert sein (siehe createSelectorFactory):
 * useSyncExternalStore vergleicht das Ergebnis per Identität und rendert
 * endlos weiter, wenn bei unverändertem State jedes Mal ein neues Objekt
 * zurückkommt.
 */
export function useSelector<R>(selector: (state: AppState) => R): R {
  const store = useStore()
  const read = () => selector(store.getSnapshot())
  return useSyncExternalStore(store.subscribe, read, read)
}

export function useDispatch(): (action: Action) => void {
  return useStore().dispatch
}
