import { createInitialState, deserialize, serialize, type AppState } from '../core/state'

/** Versionierter Schlüssel: ein späteres Zustandsformat bekommt `v2`, statt alte Daten zu verbiegen. */
export const STORAGE_KEY = 'wealthcurve.state.v1'
export const SAVE_DELAY_MS = 300
const HASH_PREFIX = '#s='

/* ------------------------------------------------------------ localStorage */

/*
 * Jeder Zugriff in try/catch: im privaten Modus, bei gesperrten Website-Daten
 * oder voller Quota wirft der Browser - das darf die App nie lahmlegen.
 */

export function loadSavedState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? null : deserialize(raw)
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state))
  } catch {
    /* Speichern ist Komfort, kein Muss. */
  }
}

/* ------------------------------------------------------------- Teilen-Link */

/**
 * Nur das, was den Plan ausmacht: `markets` ist zu groß für eine URL, und die
 * Oberflächenfelder sind Sache des Empfängers, nicht des Absenders.
 */
export function toShareJson(state: AppState): string {
  const json = JSON.parse(serialize(state)) as Record<string, unknown>
  delete json.markets
  delete json.sidebarCollapsed
  delete json.collapsedCards
  delete json.settingsView
  return JSON.stringify(json)
}

/** UTF-8 -> base64url. `btoa` allein kennt nur Latin-1 und würde Umlaute/Emoji zerlegen. */
export function encodeShare(state: AppState): string {
  const bytes = new TextEncoder().encode(toShareJson(state))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Liefert null bei allem, was kein gültiger Zustand ist; wirft nie. */
export function decodeShare(encoded: string): AppState | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return deserialize(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return null
  }
}

export function buildShareUrl(
  state: AppState,
  location: Pick<Location, 'origin' | 'pathname' | 'search'>,
): string {
  return `${location.origin}${location.pathname}${location.search}${HASH_PREFIX}${encodeShare(state)}`
}

export function stateFromHash(hash: string): AppState | null {
  return hash.startsWith(HASH_PREFIX) ? decodeShare(hash.slice(HASH_PREFIX.length)) : null
}

/** Kopiert Text; false, wenn die Zwischenablage nicht verfügbar ist oder ablehnt. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ Start */

/**
 * Startzustand: Link im Hash vor gespeichertem Stand vor Ausgangszustand.
 * Der Hash wird danach entfernt, damit ein Neuladen ihn nicht erneut einspielt
 * und spätere Änderungen überschreibt.
 */
export function resolveInitialState(): { state: AppState; fromLink: boolean } {
  try {
    const shared = stateFromHash(window.location.hash)
    if (shared) {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      } catch {
        /* nur Kosmetik */
      }
      return { state: shared, fromLink: true }
    }
  } catch {
    /* kein window/location - weiter mit Speicher */
  }
  return { state: loadSavedState() ?? createInitialState(), fromLink: false }
}

interface Subscribable {
  getSnapshot(): AppState
  subscribe(listener: () => void): () => void
}

/** Speichert Änderungen entprellt und beim Verlassen der Seite sofort. */
export function attachPersistence(store: Subscribable, delay = SAVE_DELAY_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  const flush = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (!dirty) return
    dirty = false
    saveState(store.getSnapshot())
  }
  const unsubscribe = store.subscribe(() => {
    dirty = true
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, delay)
  })
  window.addEventListener('pagehide', flush)
  return () => {
    unsubscribe()
    window.removeEventListener('pagehide', flush)
    flush()
  }
}
