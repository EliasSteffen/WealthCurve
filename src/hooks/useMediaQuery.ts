import { useCallback, useSyncExternalStore } from 'react'

/**
 * Reagiert auf eine Media Query.
 *
 * Über useSyncExternalStore statt useState+useEffect: das vermeidet den
 * Zwischenrender mit falschem Wert direkt nach dem Mounten.
 */
export function useMediaQuery(query: string): boolean {
  // Stabil je Abfrage: eine neue Funktion pro Render ließe React bei jedem
  // Rendern ab- und wieder anmelden.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false, // Serverseitig gibt es keine Viewport-Breite.
  )
}
