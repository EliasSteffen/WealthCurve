import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'finviz.theme'

const read = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Privater Modus oder blockierte Site-Daten - der Default trägt.
  }
  return 'system'
}

/**
 * Schreibt data-theme auf <html>. Die Farben selbst liegen komplett in CSS
 * (siehe index.css) - hier wird nur umgeschaltet, nicht gerechnet.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(read)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Nicht persistierbar ist kein Fehler - die Auswahl gilt für diese Sitzung.
    }
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => setThemeState(next), [])

  return { theme, setTheme }
}
