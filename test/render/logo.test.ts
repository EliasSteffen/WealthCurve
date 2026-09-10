import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOGO_AXIS, LOGO_CURVE, LOGO_STROKE, logoSvg } from '@/render/logo'

// Vom Projektwurzelverzeichnis aus: `import.meta.url` ist in der jsdom-Umgebung
// nicht gesetzt, und ein relativer Pfad zeigte dann ins Leere.
const gelesen = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('Bildmarke', () => {
  it('hält favicon.svg auf dem Stand der Quelle', () => {
    /*
     * Der eigentliche Zweck: die Datei ist erzeugt, nicht gepflegt. Wer die
     * Geometrie ändert und `npm run icons` vergisst, bekommt es hier gesagt -
     * sonst zeigt der Tab noch monatelang die alte Marke, und niemand sieht
     * ein Favicon genau genug an, um das zu bemerken.
     */
    const erwartet = logoSvg({
      variante: 'kompakt',
      comment: [
        '    Erzeugt aus src/render/logo.ts - nicht von Hand aendern, sondern',
        '    dort und danach `npm run icons`. Feste Farben, weil ein Favicon',
        '    ausserhalb der Seite gezeichnet wird und deren CSS-Variablen nicht',
        '    kennt; die Variante "kompakt" hat die Strichstaerke fuer 16 px.',
      ].join('\n'),
    })
    expect(gelesen('public/favicon.svg').trim()).toBe(erwartet.trim())
  })

  it('bindet jedes erzeugte Symbol auch ein', () => {
    // Eine Datei, die niemand anfordert, ist totes Gewicht; ein Verweis auf
    // eine fehlende Datei ist ein leerer Tab.
    const html = gelesen('index.html')
    const manifest = JSON.parse(gelesen('public/site.webmanifest')) as { icons: { src: string }[] }
    expect(html).toContain('/favicon.svg')
    expect(html).toContain('/apple-touch-icon.png')
    expect(html).toContain('/site.webmanifest')
    for (const icon of manifest.icons) {
      expect(() => gelesen(join('public', icon.src)), icon.src).not.toThrow()
    }
  })

  it('zeichnet die kompakte Fassung kräftiger', () => {
    // Nicht Geschmack: bei 16 px zerfallen die Haarlinien der großen Fassung.
    expect(LOGO_STROKE.kompakt.curve).toBeGreaterThan(LOGO_STROKE.normal.curve)
    expect(LOGO_STROKE.kompakt.axis).toBeGreaterThan(LOGO_STROKE.normal.axis)
  })

  it('erzeugt ein SVG mit beiden Pfaden und ohne Hintergrund', () => {
    const svg = logoSvg()
    expect(svg).toContain(LOGO_AXIS)
    expect(svg).toContain(LOGO_CURVE)
    expect(svg).not.toContain('<rect')
  })

  it('legt auf Wunsch einen Grund unter', () => {
    // Apple zeigt das Symbol ohne Transparenz - durchsichtig würde schwarz.
    expect(logoSvg({ background: '#ffffff' })).toContain('<rect')
  })
})
