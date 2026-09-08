import { wobble } from './wobble'

/**
 * Handgezeichnete Linien für Recharts.
 *
 * Recharts' `type`-Prop akzeptiert nicht nur die eingebauten Namen, sondern
 * eine d3-Curve-Factory (siehe recharts/types/shape/Curve.d.ts). Damit lässt
 * sich der Skizzen-Look ohne rough.js oder eine andere Abhängigkeit bauen.
 */

/** Der Teil des d3-Kontexts, den wir wirklich brauchen. */
interface PathContext {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
}

interface CurveGenerator {
  areaStart(): void
  areaEnd(): void
  lineStart(): void
  lineEnd(): void
  point(x: number, y: number): void
}

/**
 * Curve-Factory mit gegebener Amplitude in Pixeln.
 *
 * Zwischen zwei Datenpunkten werden Stützpunkte eingeschoben, damit die Linie
 * auch auf langen Strecken wackelt statt nur an den Ecken.
 */
export function sketchCurve(amplitude: number) {
  const SEGMENTS = 4

  return function curveFactory(context: PathContext): CurveGenerator {
    let started = false
    let lastX = 0
    let lastY = 0
    let index = 0

    const shift = (x: number, y: number, salt: number): [number, number] => [
      x + wobble(x, y, salt) * amplitude,
      y + wobble(y, x, salt + 1.7) * amplitude,
    ]

    return {
      areaStart() {},
      areaEnd() {},

      lineStart() {
        started = false
        index = 0
      },

      lineEnd() {},

      point(x: number, y: number) {
        index += 1
        if (!started) {
          const [px, py] = shift(x, y, index)
          context.moveTo(px, py)
          started = true
        } else {
          // Zwischenpunkte auf der Geraden, jeder einzeln versetzt.
          for (let step = 1; step <= SEGMENTS; step += 1) {
            const t = step / SEGMENTS
            const ix = lastX + (x - lastX) * t
            const iy = lastY + (y - lastY) * t
            const [px, py] = shift(ix, iy, index + step)
            context.lineTo(px, py)
          }
        }
        lastX = x
        lastY = y
      },
    }
  }
}
