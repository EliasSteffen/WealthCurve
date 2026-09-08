import type { Projection } from '../projection'
import type { AnimationSpec, FrameState } from './types'

export const DEFAULT_SPEC: AnimationSpec = {
  formatId: 'reel',
  durationSeconds: 9,
  holdSeconds: 2.5,
  fps: 30,
}

/** Sanft an, sanft aus - die Kurve soll nicht ruckartig einsetzen. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

const positiveFrames = (seconds: number, fps: number) => Math.max(0, Math.round(seconds * fps))

export function buildFrameCount(spec: AnimationSpec): number {
  return Math.max(1, positiveFrames(spec.durationSeconds, spec.fps))
}

export function frameCount(spec: AnimationSpec): number {
  return buildFrameCount(spec) + positiveFrames(spec.holdSeconds, spec.fps)
}

/** Linear zwischen zwei Jahresstützpunkten; null bleibt null. */
function interpolate(a: number | null, b: number | null, t: number): number | null {
  if (typeof a !== 'number') return null
  if (typeof b !== 'number') return a
  return a + (b - a) * t
}

/**
 * Der Zustand zu Bild `index`.
 *
 * Rein: gleiche Eingabe, gleiches Ergebnis. Dadurch kann derselbe Aufruf sowohl
 * die Vorschau als auch die Aufnahme speisen, ohne dass beide auseinanderlaufen.
 */
export function frameAt(spec: AnimationSpec, projection: Projection, index: number): FrameState {
  const total = frameCount(spec)
  const clamped = Math.min(Math.max(0, Math.round(index)), total - 1)
  const build = buildFrameCount(spec)

  // Nach dem Aufbau steht das Bild still - der Fortschritt bleibt bei 1.
  const raw = build <= 1 ? 1 : Math.min(1, clamped / (build - 1))
  const progress = easeInOutCubic(raw)

  const lastYear = Math.max(0, projection.rows.length - 1)
  const visibleYears = progress * lastYear

  const lower = Math.floor(visibleYears)
  const upper = Math.min(lastYear, lower + 1)
  const t = visibleYears - lower

  const values: Record<string, number | null> = {}
  for (const line of projection.lines) {
    values[line.key] = interpolate(
      projection.rows[lower]?.[line.key] ?? null,
      projection.rows[upper]?.[line.key] ?? null,
      t,
    )
  }

  return { index: clamped, progress, visibleYears, values, year: Math.round(visibleYears) }
}
