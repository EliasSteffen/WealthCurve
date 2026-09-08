import { useSyncExternalStore } from 'react'

/**
 * Reagiert auf eine Media Query.
 *
 * Über useSyncExternalStore statt useState+useEffect: das vermeidet den
 * Zwischenrender mit falschem Wert direkt nach dem Mounten.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    const list = window.matchMedia(query)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // Serverseitig gibt es keine Viewport-Breite.
  )
}
