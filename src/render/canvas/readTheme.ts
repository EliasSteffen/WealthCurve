import type { ProjectionLine } from '../../core/projection'
import type { RenderTheme } from './drawFrame'

/**
 * Canvas kennt keine CSS-Variablen - `fillStyle = "var(--chart-1)"` wird still
 * ignoriert. Die Werte müssen deshalb vor dem Zeichnen aufgelöst werden.
 */

const VAR_MUSTER = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/

export function resolveCssColor(value: string, root?: HTMLElement): string {
  const treffer = VAR_MUSTER.exec(value)
  if (!treffer) return value.trim()
  const element = root ?? document.documentElement
  const berechnet = getComputedStyle(element).getPropertyValue(treffer[1]).trim()
  // Fällt auf den im var() mitgegebenen Ersatzwert zurück - genau dafür steht er da.
  return berechnet || (treffer[2] ?? '').trim() || '#888888'
}

export function readRenderTheme(root?: HTMLElement): RenderTheme {
  const lies = (name: string, fallback: string) =>
    resolveCssColor(`var(${name}, ${fallback})`, root)
  return {
    surface: lies('--surface-1', '#fcfcfb'),
    text: lies('--text-primary', '#0b0b0b'),
    textMuted: lies('--text-muted', '#898781'),
    grid: lies('--grid', '#e1e0d9'),
    axis: lies('--axis', '#c3c2b7'),
  }
}

export function readLineColors(
  lines: readonly ProjectionLine[],
  root?: HTMLElement,
): Record<string, string> {
  return Object.fromEntries(lines.map((l) => [l.key, resolveCssColor(l.colorVar, root)]))
}
