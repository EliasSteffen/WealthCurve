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
    surface: lies('--surface-1', '#ffffff'),
    text: lies('--text-primary', '#131722'),
    textMuted: lies('--text-muted', '#6a6d78'),
    grid: lies('--grid', '#e0e3eb'),
    axis: lies('--axis', '#c3c6ce'),
  }
}

export function readLineColors(
  lines: readonly ProjectionLine[],
  root?: HTMLElement,
): Record<string, string> {
  return Object.fromEntries(lines.map((l) => [l.key, resolveCssColor(l.colorVar, root)]))
}
