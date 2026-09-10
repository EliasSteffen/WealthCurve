import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '@/core/domain/math'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'
import { buildProjection } from '@/core/projection'
import { CHART_SLOT_COLORS, RENDER_THEMES, themeLineColors } from '@/render/canvas/themes'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

/**
 * Die Werte eines CSS-Blocks, gefunden über seinen Selektor.
 *
 * Bewusst eine kurze Regex statt eines Parsers: es geht um zwei Blöcke mit
 * flachen Deklarationen, und ein Parser wäre hier mehr Code als Nutzen.
 */
function tokens(selektor: string): Record<string, string> {
  const start = css.indexOf(selektor)
  if (start < 0) throw new Error(`Selektor nicht in index.css: ${selektor}`)
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  )
}

describe('Farbschemata des Renderers', () => {
  /*
   * Der Renderer kann die Farben nicht immer aus dem DOM lesen - der
   * MCP-Server hat keines, und ein dunkles Video soll sich auch bei hellem
   * Thema aufnehmen lassen. Die Kopie in themes.ts ist deshalb nötig; dieser
   * Test macht sie überprüfbar, statt auf Sorgfalt zu vertrauen.
   */
  const faelle = [
    ['light', ':root {'],
    ['dark', ':root[data-theme="dark"]'],
  ] as const

  for (const [name, selektor] of faelle) {
    it(`stimmt für „${name}" mit index.css überein`, () => {
      const quelle = tokens(selektor)
      const thema = RENDER_THEMES[name]
      expect(thema.surface).toBe(quelle['--surface-1'])
      expect(thema.text).toBe(quelle['--text-primary'])
      expect(thema.textMuted).toBe(quelle['--text-muted'])
      expect(thema.grid).toBe(quelle['--grid'])
      expect(thema.axis).toBe(quelle['--axis'])
    })

    it(`hat für „${name}" dieselben acht Palettenfarben`, () => {
      const quelle = tokens(selektor)
      CHART_SLOT_COLORS[name].forEach((farbe, i) => {
        // Der Kommentar hinter der Farbe in index.css gehört nicht dazu.
        expect(quelle[`--chart-${i + 1}`].split(/\s/)[0], `Slot ${i + 1}`).toBe(farbe)
      })
    })
  }
})

describe('themeLineColors', () => {
  const projection = buildProjection({
    scenarios: [{ id: 'a', label: 'Basis', colorSlot: 1, params: DEFAULT_PARAMS }],
    seriesIds: ['compound', 'contributions'],
    model: DEFAULT_MODEL,
  })

  it('gibt jeder Linie die Farbe ihres Slots im gewählten Thema', () => {
    const hell = themeLineColors(projection.lines, 'light')
    const dunkel = themeLineColors(projection.lines, 'dark')
    for (const line of projection.lines) {
      expect(hell[line.key]).toMatch(/^#[0-9a-f]{6}$/)
      expect(dunkel[line.key]).not.toBe(hell[line.key])
    }
  })

  it('behält eine Farbe ohne erkennbaren Slot', () => {
    // Sonst würde eine Linie mit fest gesetzter Farbe stillschweigend grau.
    const farben = themeLineColors([{ ...projection.lines[0], colorVar: '#123456' }], 'dark')
    expect(Object.values(farben)[0]).toBe('#123456')
  })
})
