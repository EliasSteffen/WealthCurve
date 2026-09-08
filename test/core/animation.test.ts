import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SPEC,
  buildFrameCount,
  easeInOutCubic,
  frameAt,
  frameCount,
  resolveFormat,
  VIDEO_FORMATS,
} from '@/core/animation'
import { DEFAULT_MODEL } from '@/core/domain/math'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'
import { buildProjection } from '@/core/projection'

const projection = buildProjection({
  scenarios: [{ id: 'a', label: 'Basis', colorSlot: 1, params: DEFAULT_PARAMS }],
  seriesIds: ['compound', 'contributions'],
  model: DEFAULT_MODEL,
})

const spec = { ...DEFAULT_SPEC, durationSeconds: 4, holdSeconds: 1, fps: 30 }
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

  it('steigt monoton', () => {
    let vorher = -1
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const wert = easeInOutCubic(t)
      expect(wert).toBeGreaterThanOrEqual(vorher)
      vorher = wert
    }
  })

  it('begrenzt Werte außerhalb von 0..1', () => {
    expect(easeInOutCubic(-5)).toBe(0)
    expect(easeInOutCubic(5)).toBe(1)
  })
})

describe('Bildanzahl', () => {
  it('rechnet Aufbau plus Standbild', () => {
    expect(buildFrameCount(spec)).toBe(120)
    expect(frameCount(spec)).toBe(150)
  })

  it('liefert auch ohne Standbild mindestens ein Bild', () => {
    expect(frameCount({ ...spec, durationSeconds: 0, holdSeconds: 0 })).toBe(1)
  })
})

describe('frameAt', () => {
  it('beginnt bei null', () => {
    const f = frameAt(spec, projection, 0)
    expect(f.progress).toBe(0)
    expect(f.visibleYears).toBe(0)
    expect(f.year).toBe(0)
  })

  it('endet auf dem letzten Jahr', () => {
    const f = frameAt(spec, projection, frameCount(spec) - 1)
    expect(f.progress).toBeCloseTo(1, 10)
    expect(f.visibleYears).toBeCloseTo(letztesJahr, 10)
  })

  it('hält das Bild nach dem Aufbau still', () => {
    // Das Standbild darf nicht weiterlaufen, sonst wirkt das Ende unruhig.
    const ersteHaltung = frameAt(spec, projection, buildFrameCount(spec) - 1)
    const letzte = frameAt(spec, projection, frameCount(spec) - 1)
    expect(letzte.visibleYears).toBeCloseTo(ersteHaltung.visibleYears, 10)
    expect(letzte.values).toEqual(ersteHaltung.values)
  })

  it('wächst monoton', () => {
    let vorher = -1
    for (let i = 0; i < frameCount(spec); i += 1) {
      const jetzt = frameAt(spec, projection, i).visibleYears
      expect(jetzt).toBeGreaterThanOrEqual(vorher)
      vorher = jetzt
    }
  })

  it('begrenzt Indizes außerhalb des Bereichs', () => {
    expect(frameAt(spec, projection, -10).index).toBe(0)
    expect(frameAt(spec, projection, 9999).index).toBe(frameCount(spec) - 1)
  })

  it('interpoliert die Werte zwischen zwei Jahren', () => {
    const key = projection.lines[0].key
    const mitte = frameAt(spec, projection, Math.floor(buildFrameCount(spec) / 2))
    const unten = Math.floor(mitte.visibleYears)
    const oben = unten + 1
    const a = projection.rows[unten][key] as number
    const b = projection.rows[oben][key] as number
    const wert = mitte.values[key] as number
    expect(wert).toBeGreaterThanOrEqual(Math.min(a, b))
    expect(wert).toBeLessThanOrEqual(Math.max(a, b))
  })

  it('trifft am Ende exakt den Endwert der Projektion', () => {
    // Der Zuschauer sieht am Schluss dieselbe Zahl wie in der App.
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
    expect(() => frameAt(spec, leer, 5)).not.toThrow()
  })
})
