import { useMemo, useSyncExternalStore } from 'react'
import { resolveCssColor } from '../../render/canvas/readTheme'

/**
 * Farben für die TradingView-Charts.
 *
 * `lightweight-charts` zeichnet auf Canvas und kennt keine CSS-Variablen - jede
 * Farbe muss vorher aufgelöst sein. Und sie muss neu aufgelöst werden, sobald
 * sich das Thema ändert: Umschalter (data-theme) oder die Einstellung des
 * Betriebssystems.
 */
export interface ChartPalette {
  /** Dunkle Fläche - entscheidet etwa, wie hell die Achsenmarken hinterlegt werden. */
  readonly dark: boolean
  readonly surface: string
  readonly text: string
  readonly textSecondary: string
  readonly muted: string
  readonly grid: string
  readonly axis: string
  readonly up: string
  readonly down: string
  readonly accent: string
  /** Eine Serienfarbe (`var(--chart-3, …)`) im aktuellen Thema. */
  readonly resolve: (colorVar: string) => string
}

/**
 * `#rgb`, `#rrggbb` und `rgb(…)` mit Deckkraft - als `rgba(r, g, b, a)`, das jede
 * Canvas-Bibliothek versteht. Alles andere kommt unverändert zurück.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha))
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color.trim())
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`
  return color
}

/** Relative Helligkeit unter 0,2 gilt als dunkel - bei Hex-Werten; alles andere als hell. */
function isDark(color: string): boolean {
  const rgba = /rgba\((\d+), (\d+), (\d+)/.exec(withAlpha(color, 1))
  if (!rgba) return false
  const [r, g, b] = rgba.slice(1, 4).map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.2
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  media?.addEventListener?.('change', onChange)
  return () => {
    observer.disconnect()
    media?.removeEventListener?.('change', onChange)
  }
}

/** Ein Schlüssel, der sich genau dann ändert, wenn sich die Farben ändern könnten. */
function themeKey(): string {
  const root = document.documentElement
  const dunkel = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
  return `${root.getAttribute('data-theme') ?? 'system'}|${dunkel}`
}

export function useChartPalette(): ChartPalette {
  const key = useSyncExternalStore(subscribe, themeKey, () => 'server')
  return useMemo(() => {
    // `key` steht nur für den Neuaufbau da - gelesen wird jedes Mal frisch aus dem DOM.
    void key
    const lies = (name: string, fallback: string) => resolveCssColor(`var(${name}, ${fallback})`)
    const surface = lies('--surface-1', '#131722')
    return {
      dark: isDark(surface),
      surface,
      text: lies('--text-primary', '#d1d4dc'),
      textSecondary: lies('--text-secondary', '#b2b5be'),
      muted: lies('--text-muted', '#868993'),
      grid: lies('--grid', '#1f2431'),
      axis: lies('--axis', '#363a45'),
      up: lies('--up', '#22ab94'),
      down: lies('--down', '#f7525f'),
      accent: lies('--accent-fill', '#2962ff'),
      resolve: (colorVar: string) => resolveCssColor(colorVar),
    }
  }, [key])
}

/** Schrift der App auch im Canvas - sonst stünde Arial neben system-ui. */
export const CHART_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
