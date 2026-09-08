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
  /**
   * Fertig formatierte Werte für die Platzhalter im Szenentext.
   *
   * Der Renderer löst nur ein, er rechnet und formatiert nicht - dadurch bleibt
   * er frei von Domänenwissen und die Oberfläche bestimmt, welche Platzhalter
   * es gibt.
   */
  readonly facts: Readonly<Record<string, string>>
}

const PLATZHALTER = /\{\{\s*(\w+)\s*\}\}/g

export function resolveText(template: string, facts: Readonly<Record<string, string>>): string {
  return template.replace(PLATZHALTER, (_, key: string) => facts[key] ?? '')
}

/**
 * Bricht Text auf die verfügbare Breite um.
 *
 * Notwendig, weil Platzhalter beliebig lang werden können - {{szenarien}} mit
 * drei Szenarien sprengt jede feste Zeile. Text, der aus dem Bild läuft, wäre
 * im fertigen Video nicht mehr zu retten.
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): readonly string[] {
  const ergebnis: string[] = []
  for (const absatz of text.split('\n')) {
    if (!absatz.trim()) continue
    let zeile = ''
    for (const wort of absatz.split(/\s+/)) {
      const versuch = zeile ? `${zeile} ${wort}` : wort
      if (zeile && ctx.measureText(versuch).width > maxWidth) {
        ergebnis.push(zeile)
        zeile = wort
      } else {
        zeile = versuch
      }
    }
    if (zeile) ergebnis.push(zeile)
  }
  return ergebnis
}

/** Zeichnet mehrzeiligen, umgebrochenen Text und gibt die Gesamthöhe zurück. */
function drawLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  maxWidth = Infinity,
): number {
  const zeilen = wrapLines(ctx, text, maxWidth)
  zeilen.forEach((zeile, i) => ctx.fillText(zeile, x, y + i * lineHeight))
  return zeilen.length * lineHeight
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

  /* ------------------------------------------------------- Aufhänger allein */
  // Der Aufhänger zeigt nur Text. Ein halb gezeichnetes Diagramm darunter würde
  // die Aufmerksamkeit teilen, bevor die Aussage überhaupt gelesen ist.
  if (frame.scene.kind === 'hook') {
    const text = resolveText(frame.scene.text, input.facts)
    ctx.textAlign = 'center'
    ctx.fillStyle = theme.text
    const groesse = Math.round(width * 0.082)
    ctx.font = font(style, groesse, '600')
    const nutzbar = width - pad * 2
    const zeilen = wrapLines(ctx, text, nutzbar).length
    drawLines(
      ctx,
      text,
      width / 2,
      height / 2 - ((zeilen - 1) * groesse * 1.25) / 2,
      groesse * 1.25,
      nutzbar,
    )
    ctx.restore()
    return
  }

  /* ------------------------------------------------------------- Kopfbereich */
  /*
   * Eine Zeile je Szenario statt einer einzigen grossen Zahl.
   *
   * Die Kurven zeigten schon immer alle Szenarien - der Kopf nannte aber nur
   * das erste, und damit war ein Vergleichsvideo im Grunde falsch beschriftet.
   */
  const proSzenario = new Map<string, { label: string; value: number | null; color: string }>()
  for (const line of projection.lines) {
    if (proSzenario.has(line.scenarioId)) continue
    const summary = projection.summaries.find((s) => s.scenarioId === line.scenarioId)
    proSzenario.set(line.scenarioId, {
      label: summary?.label ?? input.title,
      value: frame.values[line.key],
      color: colors[line.key] ?? theme.text,
    })
  }
  const kopfzeilen = [...proSzenario.values()]
  const MAX_ZEILEN = 3
  const gezeigt = kopfzeilen.slice(0, MAX_ZEILEN)

  ctx.textAlign = 'left'
  if (gezeigt.length <= 1) {
    ctx.fillStyle = theme.textMuted
    ctx.font = font(style, Math.round(width * 0.032))
    ctx.fillText(gezeigt[0]?.label ?? input.title, pad, Math.round(headerH * 0.38))

    ctx.fillStyle = theme.text
    ctx.font = font(style, Math.round(width * 0.085), '600')
    ctx.fillText(formatEur(gezeigt[0]?.value ?? 0), pad, Math.round(headerH * 0.66))
  } else {
    // Kleinere Schrift, dafuer jede Zeile in der Farbe ihrer Kurve.
    const zeilenH = Math.round(headerH * 0.2)
    const wertGroesse = Math.round(width * 0.052)
    let y = Math.round(headerH * 0.3)
    for (const eintrag of gezeigt) {
      ctx.fillStyle = eintrag.color
      ctx.font = font(style, Math.round(width * 0.026))
      ctx.fillText(eintrag.label, pad, y - wertGroesse * 0.72)
      ctx.fillStyle = theme.text
      ctx.font = font(style, wertGroesse, '600')
      ctx.fillText(formatEur(eintrag.value ?? 0), pad, y)
      y += zeilenH
    }
    if (kopfzeilen.length > MAX_ZEILEN) {
      ctx.fillStyle = theme.textMuted
      ctx.font = font(style, Math.round(width * 0.024))
      ctx.fillText(`+ ${kopfzeilen.length - MAX_ZEILEN} weitere`, pad, y - wertGroesse * 0.7)
    }
  }

  // Untertitel des laufenden Abschnitts.
  const untertitel = resolveText(frame.scene.text, input.facts)
  if (frame.scene.kind === 'build' && untertitel) {
    ctx.fillStyle = theme.textMuted
    ctx.font = font(style, Math.round(width * 0.03))
    drawLines(
      ctx,
      untertitel,
      pad,
      Math.round(headerH * 0.86),
      Math.round(width * 0.038),
      width - pad * 2,
    )
  }

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

  /* --------------------------------------------------------------- Pointe */
  if (frame.scene.kind === 'punchline' && untertitel) {
    const groesse = Math.round(width * 0.058)
    ctx.font = font(style, groesse, '600')
    const nutzbar = width - pad * 2
    const zeilen = wrapLines(ctx, untertitel, nutzbar).length
    const blockH = zeilen * groesse * 1.25 + groesse
    const blockY = plot.bottom - blockH - groesse * 0.5

    // Leicht abgedunkelter Grund, damit der Text auch über der Kurve trägt.
    ctx.globalAlpha = 0.88
    ctx.fillStyle = theme.surface
    ctx.fillRect(pad - groesse * 0.4, blockY, width - pad * 2 + groesse * 0.8, blockH)
    ctx.globalAlpha = 1

    ctx.textAlign = 'left'
    ctx.fillStyle = theme.text
    drawLines(ctx, untertitel, pad, blockY + groesse * 1.1, groesse * 1.25, nutzbar)
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
