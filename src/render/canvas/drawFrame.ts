import type { FrameState, VideoFormat } from '../../core/animation'
import type { ChartStyle } from '../../core/chart-style'
import type { Projection } from '../../core/projection'
import { formatEur, formatEurCompact } from '../../lib/format'
import { wobble } from '../wobble'

/**
 * Zeichnet ein Einzelbild auf ein Canvas.
 *
 * Zweiter Renderer neben Recharts, weil MediaRecorder ein Canvas braucht und
 * SVG nicht bildgenau aufzunehmen ist. Er liest denselben `ChartStyle` wie der
 * Chart in der App - ein Stil wird also nur einmal definiert.
 *
 * Bewusst außerhalb von src/core/: hier geht es um Pixel, nicht um Rechnen.
 */

export interface RenderTheme {
  readonly surface: string
  readonly text: string
  readonly textMuted: string
  readonly grid: string
  readonly axis: string
}

export interface DrawInput {
  readonly frame: FrameState
  readonly projection: Projection
  readonly style: ChartStyle
  readonly format: VideoFormat
  readonly theme: RenderTheme
  /** Linien-Key -> fertige Farbe. Canvas kennt keine CSS-Variablen. */
  readonly colors: Readonly<Record<string, string>>
  readonly title: string
}

const scale = (d0: number, d1: number, r0: number, r1: number) => (value: number) =>
  d1 === d0 ? r0 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0)

const font = (style: ChartStyle, size: number, weight = '400') =>
  `${weight} ${size}px ${style.fontFamily ?? 'system-ui, -apple-system, sans-serif'}`

/**
 * Rundet eine Schrittweite auf 1, 2 oder 5 mal Zehnerpotenz.
 *
 * Ohne das stünden an der Achse Werte wie "823.672,7 €" - rechnerisch richtig,
 * aber niemand liest daran einen Wert ab.
 */
function niceStep(range: number, count: number): number {
  const roh = range / count
  const groesse = Math.pow(10, Math.floor(Math.log10(roh)))
  const norm = roh / groesse
  const faktor = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return faktor * groesse
}

/**
 * Größter Wert der GESAMTEN Projektion, nicht nur des sichtbaren Teils.
 *
 * Würde die Achse mit der Animation mitwachsen, schrumpfte die Kurve optisch
 * beim Zeichnen - der Zuschauer sähe eine fast waagerechte Linie statt eines
 * Anstiegs.
 */
function maxValue(projection: Projection): number {
  let max = 0
  for (const row of projection.rows) {
    for (const line of projection.lines) {
      const value = row[line.key]
      if (typeof value === 'number' && value > max) max = value
    }
  }
  return max === 0 ? 1 : max
}

export function drawFrame(ctx: CanvasRenderingContext2D, input: DrawInput): void {
  const { frame, projection, style, format, theme, colors } = input
  const { width, height } = format

  ctx.save()
  ctx.fillStyle = theme.surface
  ctx.fillRect(0, 0, width, height)

  const pad = Math.round(width * 0.075)
  const headerH = Math.round(height * (format.height > format.width ? 0.2 : 0.16))
  const footerH = Math.round(height * (format.height > format.width ? 0.13 : 0.15))
  const plot = {
    left: pad,
    right: width - pad,
    top: headerH,
    bottom: height - footerH,
  }

  const lastYear = Math.max(1, projection.rows.length - 1)
  const TICKS = 4
  const schritt = niceStep(maxValue(projection), TICKS)
  // Obergrenze auf die nächste runde Stufe aufziehen, damit die oberste
  // Beschriftung genau auf der obersten Gitterlinie sitzt.
  const obergrenze = Math.ceil(maxValue(projection) / schritt) * schritt
  const x = scale(0, lastYear, plot.left, plot.right)
  const y = scale(0, obergrenze, plot.bottom, plot.top)

  /* ------------------------------------------------------------- Kopfbereich */
  const primary = projection.lines[0]
  const primaryValue = primary ? frame.values[primary.key] : null

  ctx.textAlign = 'left'
  ctx.fillStyle = theme.textMuted
  ctx.font = font(style, Math.round(width * 0.032))
  ctx.fillText(input.title, pad, Math.round(headerH * 0.42))

  ctx.fillStyle = theme.text
  ctx.font = font(style, Math.round(width * 0.085), '600')
  ctx.fillText(formatEur(primaryValue ?? 0), pad, Math.round(headerH * 0.75))

  /* ------------------------------------------------------------------ Gitter */
  if (style.grid.show) {
    ctx.strokeStyle = theme.grid
    ctx.lineWidth = 1
    ctx.setLineDash(style.grid.dash ? style.grid.dash.split(/[\s,]+/).map(Number) : [])
    for (let i = 0; i <= TICKS; i += 1) {
      const gy = y(schritt * i)
      ctx.beginPath()
      ctx.moveTo(plot.left, gy)
      ctx.lineTo(plot.right, gy)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  /* ------------------------------------------------------------------ Achsen */
  if (style.axis.show) {
    ctx.fillStyle = theme.textMuted
    ctx.font = font(style, Math.round(width * 0.024))
    ctx.textAlign = 'left'
    for (let i = 0; i <= TICKS; i += 1) {
      const value = schritt * i
      ctx.fillText(formatEurCompact(value), plot.left, y(value) - 8)
    }
  }

  /* ------------------------------------------------------------------ Kurven */
  // Rückwärts, damit die Hauptkurve zuletzt und damit obenauf gezeichnet wird.
  for (const line of [...projection.lines].reverse()) {
    const punkte: Array<[number, number]> = []
    const voll = Math.floor(frame.visibleYears)

    for (let year = 0; year <= voll; year += 1) {
      const value = projection.rows[year]?.[line.key]
      if (typeof value === 'number') punkte.push([x(year), y(value)])
    }
    // Angebrochenes Jahr: den bereits interpolierten Wert aus dem Frame nehmen,
    // damit Kurvenende und angezeigte Zahl garantiert zusammenpassen.
    const teil = frame.values[line.key]
    if (frame.visibleYears > voll && typeof teil === 'number') {
      punkte.push([x(frame.visibleYears), y(teil)])
    }
    if (punkte.length < 2) continue

    ctx.strokeStyle = colors[line.key] ?? theme.text
    ctx.lineWidth = style.line.width * (width / 500)
    ctx.lineCap = style.line.cap
    ctx.lineJoin = 'round'
    ctx.globalAlpha = line.opacity
    ctx.setLineDash(line.dash ? line.dash.split(/[\s,]+/).map(Number) : [])

    ctx.beginPath()
    const amp = style.line.jitter * (width / 500)
    punkte.forEach(([px, py], i) => {
      const jx = amp > 0 ? px + wobble(px, py, i) * amp : px
      const jy = amp > 0 ? py + wobble(py, px, i + 1.7) * amp : py
      if (i === 0) ctx.moveTo(jx, jy)
      else ctx.lineTo(jx, jy)
    })
    ctx.stroke()

    if (style.area.opacity > 0) {
      ctx.lineTo(punkte.at(-1)![0], plot.bottom)
      ctx.lineTo(punkte[0][0], plot.bottom)
      ctx.closePath()
      ctx.globalAlpha = line.opacity * style.area.opacity
      ctx.fillStyle = colors[line.key] ?? theme.text
      ctx.fill()
    }

    ctx.globalAlpha = 1
    ctx.setLineDash([])
  }

  /* ------------------------------------------------------------------- Fußzeile */
  ctx.textAlign = 'left'
  ctx.fillStyle = theme.textMuted
  ctx.font = font(style, Math.round(width * 0.028))
  ctx.fillText(`Jahr ${frame.year}`, pad, plot.bottom + Math.round(footerH * 0.34))

  const legendSize = Math.round(width * 0.026)
  ctx.font = font(style, legendSize)
  let ly = plot.bottom + Math.round(footerH * 0.62)
  for (const line of projection.lines.slice(0, 4)) {
    ctx.strokeStyle = colors[line.key] ?? theme.text
    ctx.lineWidth = Math.max(2, style.line.width * (width / 700))
    ctx.beginPath()
    ctx.moveTo(pad, ly - legendSize * 0.35)
    ctx.lineTo(pad + legendSize * 1.6, ly - legendSize * 0.35)
    ctx.stroke()

    ctx.fillStyle = theme.text
    ctx.fillText(line.label, pad + legendSize * 2.2, ly)
    ly += legendSize * 1.5
  }

  ctx.restore()
}
