import { describe, expect, it } from 'vitest'
import { sketchCurve } from '@/render/sketchCurve'

/** Minimaler Pfad-Kontext, der die erzeugten Punkte mitschreibt. */
function aufzeichnen() {
  const punkte: Array<[string, number, number]> = []
  return {
    punkte,
    context: {
      moveTo: (x: number, y: number) => punkte.push(['M', x, y]),
      lineTo: (x: number, y: number) => punkte.push(['L', x, y]),
      closePath: () => {},
    },
  }
}

const zeichnen = (amplitude: number, daten: Array<[number, number]>) => {
  const { punkte, context } = aufzeichnen()
  const gen = sketchCurve(amplitude)(context)
  gen.lineStart()
  for (const [x, y] of daten) gen.point(x, y)
  gen.lineEnd()
  return punkte
}

const DATEN: Array<[number, number]> = [
  [0, 100],
  [50, 80],
  [100, 40],
  [150, 10],
]

describe('sketchCurve', () => {
  it('liefert bei gleicher Eingabe exakt dasselbe Ergebnis', () => {
    // DER entscheidende Test: mit Math.random() bekäme dieselbe Kurve bei jedem
    // Render einen neuen Versatz und würde beim Ziehen eines Reglers flimmern.
    // Das fiele im Screenshot nicht auf, in der Bedienung sofort.
    expect(zeichnen(3, DATEN)).toEqual(zeichnen(3, DATEN))
  })

  it('weicht vom geraden Verlauf ab', () => {
    const gerade = zeichnen(0, DATEN)
    const wackelig = zeichnen(3, DATEN)
    expect(wackelig).not.toEqual(gerade)
  })

  it('bleibt innerhalb der Amplitude', () => {
    const amplitude = 2.5
    const gerade = zeichnen(0, DATEN)
    const wackelig = zeichnen(amplitude, DATEN)
    for (const [i, [, x, y]] of wackelig.entries()) {
      const [, gx, gy] = gerade[i]
      expect(Math.abs(x - gx)).toBeLessThanOrEqual(amplitude + 1e-9)
      expect(Math.abs(y - gy)).toBeLessThanOrEqual(amplitude + 1e-9)
    }
  })

  it('beginnt mit moveTo und setzt danach nur Linien', () => {
    const punkte = zeichnen(2, DATEN)
    expect(punkte[0][0]).toBe('M')
    expect(punkte.slice(1).every(([cmd]) => cmd === 'L')).toBe(true)
  })

  it('schiebt Stützpunkte zwischen die Datenpunkte', () => {
    // Ohne Zwischenpunkte wackelte nur die Ecke, nicht die Strecke.
    const punkte = zeichnen(2, DATEN)
    expect(punkte.length).toBeGreaterThan(DATEN.length)
  })

  it('kommt mit einem einzelnen Punkt zurecht', () => {
    expect(() => zeichnen(2, [[10, 10]])).not.toThrow()
  })
})
