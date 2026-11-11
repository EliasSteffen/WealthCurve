import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

/** Token-Werte aus dem Block, dessen Selektor mit `selector` beginnt. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  expect(start).toBeGreaterThanOrEqual(0)
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]!] = m[2]!
  return out
}

const light = tokens(':root {')
const dark = tokens(':root[data-theme="dark"]')
// Die Media-Query-Variante muss dieselben Werte tragen wie der Toggle-Scope.
const darkMedia = tokens(':root:not([data-theme="light"])')

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('Kontrast (WCAG AA, 4.5:1)', () => {
  it('berechnet bekannte Referenzwerte', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })

  it('Dark-Scopes sind identisch', () => {
    expect(darkMedia).toEqual(dark)
  })

  for (const [name, t] of [
    ['hell', light],
    ['dunkel', dark],
  ] as const) {
    it(`--text-muted erreicht 4.5:1 auf Karte und Seite (${name})`, () => {
      expect(contrast(t['text-muted']!, t['surface-1']!)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t['text-muted']!, t['surface-page']!)).toBeGreaterThanOrEqual(4.5)
    })

    it(`Text auf gefüllter Akzentfläche erreicht 4.5:1 (${name})`, () => {
      expect(contrast(t['on-accent']!, t['accent-fill']!)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('--text-muted bleibt erkennbar gedämpft (schwächer als Sekundärtext)', () => {
    expect(contrast(light['text-muted']!, light['surface-1']!)).toBeLessThan(
      contrast(light['text-secondary']!, light['surface-1']!),
    )
  })

  it('Palette bleibt unverändert', () => {
    expect(light['chart-1']).toBe('#2a78d6')
    expect(dark['chart-1']).toBe('#3987e5')
  })
})
