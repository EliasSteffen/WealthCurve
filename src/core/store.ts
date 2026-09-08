/**
 * Minimaler beobachtbarer Store - bewusst ohne Bibliothek.
 *
 * Der Vertrag (`getSnapshot` / `subscribe`) ist genau der, den Reacts
 * eingebautes `useSyncExternalStore` erwartet. Dadurch läuft derselbe Store
 * auch aus Vue, Svelte, einem Test oder einem Node-Skript heraus, ohne dass
 * Zustand oder Redux als Abhängigkeit dazukommen.
 */
export interface Store<S, A> {
  getSnapshot(): S
  subscribe(listener: () => void): () => void
  dispatch(action: A): void
}

export type Reducer<S, A> = (state: S, action: A) => S

export function createStore<S, A>(reducer: Reducer<S, A>, initialState: S): Store<S, A> {
  let state = initialState
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => state,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    dispatch(action) {
      const next = reducer(state, action)
      // Identitätsvergleich: liefert der Reducer denselben State zurück, hat
      // sich nichts geändert und niemand muss neu rendern.
      if (Object.is(next, state)) return
      state = next
      for (const listener of [...listeners]) listener()
    },
  }
}
