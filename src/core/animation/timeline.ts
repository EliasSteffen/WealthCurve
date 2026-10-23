import type { Projection } from '../projection.ts'
import type { AnimationSpec, FrameState, Scene } from './types.ts'

/**
 * Vorgabe im Reel-Aufbau: Aufhänger, Aufbau, Pointe.
 *
 * Platzhalter in geschweiften Doppelklammern werden erst beim Zeichnen
 * ersetzt - der Kern bleibt dadurch frei von Formatierung.
 */
export const DEFAULT_SCENES: readonly Scene[] = [
  { kind: 'hook', seconds: 2.5, text: '{{rate}} im Monat.\n{{ansparjahre}} Jahre lang.' },
  { kind: 'build', seconds: 9, text: '{{rendite}} Rendite pro Jahr' },
  {
    kind: 'punchline',
    seconds: 3.5,
    // Bewusst nebeneinandergestellt statt "davon": mit Entnahmephase ist der
    // Zinsertrag groesser als das Restkapital, weil bereits Entnommenes
    // mitzaehlt. "Davon" waere dann schlicht falsch.
    text: 'Eingezahlt: {{eingezahlt}}\nZinsen: {{zinsertrag}}',
  },
]

export const DEFAULT_SPEC: AnimationSpec = {
  formatId: 'reel',
  fps: 30,
  scenes: DEFAULT_SCENES,
  showYear: true,
  showHeader: true,
  showLegend: true,
  theme: 'app',
}

/** Sanft an, sanft aus - die Kurve soll nicht ruckartig einsetzen. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

const framesOf = (scene: Scene, fps: number) => Math.max(0, Math.round(scene.seconds * fps))

export function sceneFrames(spec: AnimationSpec): readonly number[] {
  return spec.scenes.map((scene) => framesOf(scene, spec.fps))
}

export function frameCount(spec: AnimationSpec): number {
  return Math.max(1, sceneFrames(spec).reduce((sum, n) => sum + n, 0))
}

export function totalSeconds(spec: AnimationSpec): number {
  return spec.scenes.reduce((sum, scene) => sum + Math.max(0, scene.seconds), 0)
}

/** Linear zwischen zwei Jahresstützpunkten; null bleibt null. */
function interpolate(a: number | null, b: number | null, t: number): number | null {
  if (typeof a !== 'number') return null
  if (typeof b !== 'number') return a
  return a + (b - a) * t
}

interface SceneHit {
  readonly scene: Scene
  readonly progress: number
}

/** Findet den Abschnitt, in dem ein Bild liegt, samt Fortschritt darin. */
function locate(spec: AnimationSpec, index: number): SceneHit {
  const laengen = sceneFrames(spec)
  let offset = 0
  for (const [i, laenge] of laengen.entries()) {
    if (laenge === 0) continue
    if (index < offset + laenge) {
      return {
        scene: spec.scenes[i],
        progress: laenge <= 1 ? 1 : (index - offset) / (laenge - 1),
      }
    }
    offset += laenge
  }
  // Hinter dem letzten Bild - den letzten nicht leeren Abschnitt festhalten.
  const letzter = [...spec.scenes].reverse().find((s) => s.seconds > 0) ?? spec.scenes.at(-1)
  return { scene: letzter ?? { kind: 'build', seconds: 0, text: '' }, progress: 1 }
}

/**
 * Der Zustand zu Bild `index`.
 *
 * Rein: gleiche Eingabe, gleiches Ergebnis. Dadurch speist derselbe Aufruf
 * Vorschau und Aufnahme, ohne dass beide auseinanderlaufen.
 */
export function frameAt(spec: AnimationSpec, projection: Projection, index: number): FrameState {
  const total = frameCount(spec)
  const clamped = Math.min(Math.max(0, Math.round(index)), total - 1)
  const { scene, progress: sceneProgress } = locate(spec, clamped)

  // Nur der Aufbau bewegt die Kurve. Davor steht sie bei null, danach am Ende -
  // so bleiben Aufhänger und Pointe ruhig genug zum Lesen.
  const progress =
    scene.kind === 'hook' ? 0 : scene.kind === 'punchline' ? 1 : easeInOutCubic(sceneProgress)

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

  return {
    index: clamped,
    progress,
    visibleYears,
    values,
    year: Math.round(visibleYears),
    scene: { kind: scene.kind, text: scene.text, progress: sceneProgress },
  }
}
