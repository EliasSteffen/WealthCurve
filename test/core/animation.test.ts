import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCENES,
  DEFAULT_SPEC,
  easeInOutCubic,
  frameAt,
  frameCount,
  resolveFormat,
  sceneFrames,
  totalSeconds,
  VIDEO_FORMATS,
  type AnimationSpec,
} from '@/core/animation'
import { DEFAULT_MODEL } from '@/core/domain/math'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'
import { buildProjection } from '@/core/projection'

const projection = buildProjection({
  scenarios: [{ id: 'a', label: 'Basis', colorSlot: 1, params: DEFAULT_PARAMS }],
  seriesIds: ['compound', 'contributions'],
  model: DEFAULT_MODEL,
})

const spec: AnimationSpec = {
  formatId: 'reel',
  fps: 30,
  scenes: [
    { kind: 'hook', seconds: 2, text: 'Aufhänger' },
    { kind: 'build', seconds: 4, text: 'Aufbau' },
    { kind: 'punchline', seconds: 2, text: 'Pointe' },
  ],
}
const letztesJahr = projection.rows.length - 1

describe('Formate', () => {
  it('vergibt eindeutige IDs', () => {
    expect(new Set(VIDEO_FORMATS.map((f) => f.id)).size).toBe(VIDEO_FORMATS.length)
  })

  it('fällt bei unbekanntem Format auf das erste zurück', () => {
    expect(resolveFormat('gibt-es-nicht')).toBe(VIDEO_FORMATS[0])
  })

  it('liefert Hochformat für Reels', () => {
    const reel = resolveFormat('reel')
    expect(reel.height).toBeGreaterThan(reel.width)
  })
})

describe('easeInOutCubic', () => {
  it('bildet die Ränder exakt ab', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10)
  })

  it('steigt monoton und begrenzt Werte außerhalb von 0..1', () => {
    let vorher = -1
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const wert = easeInOutCubic(t)
      expect(wert).toBeGreaterThanOrEqual(vorher)
      vorher = wert
    }
    expect(easeInOutCubic(-5)).toBe(0)
    expect(easeInOutCubic(5)).toBe(1)
  })
})

describe('Szenen', () => {
  it('rechnet die Bildanzahl je Abschnitt', () => {
    expect(sceneFrames(spec)).toEqual([60, 120, 60])
    expect(frameCount(spec)).toBe(240)
    expect(totalSeconds(spec)).toBe(8)
  })

  it('überspringt Abschnitte mit Dauer 0', () => {
    // So entsteht ein reines Aufbau-Video, ohne dass es dafür einen zweiten
    // Modus braucht.
    const nurAufbau: AnimationSpec = {
      ...spec,
      scenes: spec.scenes.map((s) => (s.kind === 'build' ? s : { ...s, seconds: 0 })),
    }
    expect(sceneFrames(nurAufbau)).toEqual([0, 120, 0])
    expect(frameAt(nurAufbau, projection, 0).scene.kind).toBe('build')
  })

  it('liefert auch bei lauter Nullen mindestens ein Bild', () => {
    const leer: AnimationSpec = { ...spec, scenes: spec.scenes.map((s) => ({ ...s, seconds: 0 })) }
    expect(frameCount(leer)).toBe(1)
    expect(() => frameAt(leer, projection, 0)).not.toThrow()
  })

  it('bringt eine sinnvolle Vorgabe mit', () => {
    expect(DEFAULT_SCENES.map((s) => s.kind)).toEqual(['hook', 'build', 'punchline'])
    expect(DEFAULT_SCENES.every((s) => s.seconds > 0)).toBe(true)
    expect(frameCount(DEFAULT_SPEC)).toBeGreaterThan(0)
  })
})

describe('frameAt', () => {
  it('hält die Kurve im Aufhänger bei null', () => {
    // Ein halb gezeichnetes Diagramm würde von der Aussage ablenken.
    for (const i of [0, 30, 59]) {
      const f = frameAt(spec, projection, i)
      expect(f.scene.kind).toBe('hook')
      expect(f.visibleYears).toBe(0)
    }
  })

  it('zeichnet die Kurve nur im Aufbau', () => {
    const start = frameAt(spec, projection, 60)
    const ende = frameAt(spec, projection, 179)
    expect(start.scene.kind).toBe('build')
    expect(ende.scene.kind).toBe('build')
    expect(start.visibleYears).toBe(0)
    expect(ende.visibleYears).toBeCloseTo(letztesJahr, 6)
  })

  it('hält die Pointe auf dem Endwert still', () => {
    const a = frameAt(spec, projection, 180)
    const b = frameAt(spec, projection, 239)
    expect(a.scene.kind).toBe('punchline')
    expect(a.visibleYears).toBeCloseTo(letztesJahr, 10)
    expect(b.values).toEqual(a.values)
  })

  it('wächst über das ganze Video monoton', () => {
    let vorher = -1
    for (let i = 0; i < frameCount(spec); i += 1) {
      const jetzt = frameAt(spec, projection, i).visibleYears
      expect(jetzt).toBeGreaterThanOrEqual(vorher)
      vorher = jetzt
    }
  })

  it('reicht den Szenentext unaufgelöst durch', () => {
    // Der Kern formatiert nicht - das macht erst der Renderer.
    expect(frameAt(spec, projection, 0).scene.text).toBe('Aufhänger')
    expect(frameAt(spec, projection, 200).scene.text).toBe('Pointe')
  })

  it('begrenzt Indizes außerhalb des Bereichs', () => {
    expect(frameAt(spec, projection, -10).index).toBe(0)
    expect(frameAt(spec, projection, 9999).index).toBe(frameCount(spec) - 1)
  })

  it('trifft am Ende exakt den Endwert der Projektion', () => {
    const letzte = frameAt(spec, projection, frameCount(spec) - 1)
    for (const line of projection.lines) {
      expect(letzte.values[line.key], line.key).toBeCloseTo(
        projection.rows.at(-1)![line.key] as number,
        6,
      )
    }
  })

  it('kommt mit einer leeren Projektion zurecht', () => {
    const leer = buildProjection({ scenarios: [], seriesIds: [], model: DEFAULT_MODEL })
    expect(() => frameAt(spec, leer, 100)).not.toThrow()
  })
})
