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

// Der Punkt gehört dazu: `{{s2.rendite}}` nennt das zweite Szenario. Ohne ihn
// brach der Ausdruck am Punkt ab und liess "{{s2" unaufgelöst im Bild stehen.
const PLATZHALTER = /\{\{\s*([\w.]+)\s*\}\}/g

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

/**
 * Kürzt auf die verfügbare Breite.
 *
 * `fillText` bricht weder um noch schneidet es ab - zu langer Text läuft
 * einfach aus dem Bild. In der Legende passiert das schnell: "Zinseszins ·
 * Aggressiv" ist bei zwei Szenarien der Normalfall, nicht die Ausnahme.
 */
function kuerzen(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let kurz = text
  while (kurz.length > 1 && ctx.measureText(`${kurz}…`).width > maxWidth) kurz = kurz.slice(0, -1)
  return `${kurz}…`
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
  const weitere = kopfzeilen.length - gezeigt.length

  /*
   * Schriftgröße und Zeilenabstand hängen voneinander ab.
   *
   * Vorher kam der Abstand aus der Bildhöhe und die Schrift aus der Bildbreite -
   * zwei Größen, die nichts voneinander wussten. Im Quadrat- und Querformat war
   * der Abstand (35 px) kleiner als die Schrift (56 bzw. 100 px), die Zeilen
   * liefen also zwangsläufig ineinander. Jetzt folgt der Abstand aus dem, was
   * tatsächlich darin steht.
   */
  const einzeilig = gezeigt.length <= 1
  const untertitel = resolveText(frame.scene.text, input.facts)

  /*
   * Die kürzere Bildkante gibt das Maß, nicht die Breite.
   *
   * Im Querformat (1920x1080) ergäbe die Breite eine 111-px-Schrift in einem nur
   * 1080 px hohen Bild - der Kopf fräße zwei Drittel der Fläche. Für Hoch- und
   * Quadratformat ändert sich nichts, dort IST die Breite die kürzere Kante.
   */
  const bezug = Math.min(width, height)
  const kopfOben = Math.round(pad * 0.7)
  const kopfUnten = Math.round(pad * 0.5)
  // Mehr als zwei Fünftel des Bildes darf die Beschriftung nicht belegen, sonst
  // bleibt von der Kurve - dem eigentlichen Inhalt - nichts übrig.
  const maxKopf = Math.round(height * 0.42)

  const messen = (skala: number) => {
    const wert = Math.round(
      bezug * (einzeilig ? 0.085 : gezeigt.length === 2 ? 0.058 : 0.046) * skala,
    )
    const label = Math.round(bezug * (einzeilig ? 0.032 : 0.026) * skala)
    const zeile = Math.round(label * 1.25 + wert * 1.2)
    const weitereHoehe = weitere > 0 ? Math.round(label * 1.6) : 0
    const unter = Math.round(bezug * 0.03 * skala)
    // Umbrechen braucht die gesetzte Schrift, sonst misst measureText die falsche.
    ctx.font = font(style, unter)
    const zeilen =
      frame.scene.kind === 'build' && untertitel ? wrapLines(ctx, untertitel, width - pad * 2) : []
    const abstand = zeilen.length > 0 ? Math.round(unter * 0.6) : 0
    const variabel =
      gezeigt.length * zeile + weitereHoehe + abstand + zeilen.length * Math.round(unter * 1.3)
    return {
      wert,
      label,
      zeile,
      weitereHoehe,
      unter,
      unterZeilenH: Math.round(unter * 1.3),
      zeilen,
      abstand,
      variabel,
      hoehe: kopfOben + variabel + kopfUnten,
    }
  }

  let kopf = messen(1)
  if (kopf.hoehe > maxKopf) {
    // Nur der veränderliche Teil lässt sich stauchen; die festen Ränder nicht.
    const platz = maxKopf - kopfOben - kopfUnten
    kopf = messen(Math.max(0.45, platz / kopf.variabel))
  }

  const wertGroesse = kopf.wert
  const labelGroesse = kopf.label
  const zeilenH = kopf.zeile
  const weitereH = kopf.weitereHoehe
  const untertitelGroesse = kopf.unter
  const untertitelZeilenH = kopf.unterZeilenH
  const untertitelZeilen = kopf.zeilen
  const untertitelAbstand = kopf.abstand

  // Der Kopf darf wachsen, aber nicht schrumpfen: bei einem Szenario beginnt das
  // Diagramm genau da, wo es immer begann.
  const headerH = Math.max(
    Math.round(height * (format.height > format.width ? 0.2 : 0.16)),
    kopf.hoehe,
  )
  const footerH = Math.round(height * (format.height > format.width ? 0.13 : 0.15))
  // Die Achsenbeschriftung steht ÜBER ihrer Gitterlinie. Ohne diese Reserve
  // ragte die oberste Zahl in den Kopfbereich und legte sich auf die Kopfzeilen.
  const achsenGroesse = Math.round(bezug * 0.024)
  const plot = {
    left: pad,
    right: width - pad,
    top: headerH + (style.axis.show ? achsenGroesse : 0),
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

  ctx.textAlign = 'left'
  let kopfY = kopfOben
  for (const eintrag of gezeigt) {
    // Bei einem Szenario bleibt die Zeile gedämpft, bei mehreren trägt sie die
    // Farbe ihrer Kurve - sonst ist nicht zuzuordnen, welche Zahl wohin gehört.
    ctx.fillStyle = einzeilig ? theme.textMuted : eintrag.color
    ctx.font = font(style, labelGroesse)
    ctx.fillText(eintrag.label, pad, kopfY + labelGroesse)

    ctx.fillStyle = theme.text
    ctx.font = font(style, wertGroesse, '600')
    ctx.fillText(formatEur(eintrag.value ?? 0), pad, kopfY + labelGroesse * 1.25 + wertGroesse * 0.8)
    kopfY += zeilenH
  }
  if (weitere > 0) {
    ctx.fillStyle = theme.textMuted
    ctx.font = font(style, Math.round(width * 0.024))
    ctx.fillText(`+ ${weitere} weitere`, pad, kopfY + labelGroesse)
    kopfY += weitereH
  }

  // Untertitel direkt unter dem Kopfblock statt an einer festen Bruchteilhöhe,
  // die bei drei Zeilen längst überschrieben war.
  if (untertitelZeilen.length > 0) {
    ctx.fillStyle = theme.textMuted
    ctx.font = font(style, untertitelGroesse)
    untertitelZeilen.forEach((zeile, i) =>
      ctx.fillText(zeile, pad, kopfY + untertitelAbstand + untertitelGroesse + i * untertitelZeilenH),
    )
  }

  /*
   * Nur Striche bis zur Obergrenze.
   *
   * `TICKS` ist ein Wunsch, keine Zusage: `niceStep` rundet die Schrittweite auf
   * und `obergrenze` schneidet danach ab. Die feste Schleife bis `TICKS` zeichnete
   * deshalb regelmäßig Linien und Beschriftungen OBERHALB der Plotfläche - bei
   * kurzem Kopf fiel das in leeren Raum, bei zwei Szenarien landete es im Text.
   */
  const tickWerte: number[] = []
  for (let value = 0; value <= obergrenze + schritt * 1e-9; value += schritt) tickWerte.push(value)

  /* ------------------------------------------------------------------ Gitter */
  if (style.grid.show) {
    ctx.strokeStyle = theme.grid
    ctx.lineWidth = 1
    ctx.setLineDash(style.grid.dash ? style.grid.dash.split(/[\s,]+/).map(Number) : [])
    for (const value of tickWerte) {
      const gy = y(value)
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
    ctx.font = font(style, achsenGroesse)
    ctx.textAlign = 'left'
    for (const value of tickWerte) ctx.fillText(formatEurCompact(value), plot.left, y(value) - 8)
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
  // Auch hier die kürzere Kante: im Querformat ergäbe die Breite eine 54-px-
  // Zeile, die sich in die Legende darunter legte.
  ctx.font = font(style, Math.round(bezug * 0.028))
  /*
   * Dieselbe Beschriftung wie im Chart.
   *
   * Weicht sie vom Index ab, ist sie absolut (Alter oder Kalenderjahr) und
   * steht für sich - „Jahr 2007" wäre falsch.
   */
  const jahrText = projection.yearLabels[frame.year]
  ctx.fillText(
    jahrText !== undefined && jahrText !== String(frame.year) ? jahrText : `Jahr ${frame.year}`,
    pad,
    plot.bottom + Math.round(footerH * 0.34),
  )

  const legendSize = Math.round(bezug * 0.026)
  const legendZeilenH = Math.round(legendSize * 1.5)
  ctx.font = font(style, legendSize)
  const legendStart = plot.bottom + Math.round(footerH * 0.62)
  // Nur so viele Einträge, wie unter der Achse wirklich Platz haben.
  const passt = Math.max(1, Math.floor((height - legendStart) / legendZeilenH))
  const textLinks = pad + legendSize * 2.2
  const textBreite = width - pad - textLinks

  /*
   * Beim Vergleich nennt die Legende nur die Serien.
   *
   * Zwei Szenarien mal zwei Serien ergeben vier Einträge, von denen in die
   * Fußzeile zwei passen - die Legende zeigte dann "... · Basis" zweimal und
   * verschwieg das zweite Szenario komplett. Die Szenarien stehen ohnehin
   * farbig im Kopf; hier unten fehlt nur noch, welche Kurve welche Serie ist.
   */
  const vergleich = new Set(projection.lines.map((l) => l.scenarioId)).size > 1
  const legende = vergleich
    ? [...new Map(projection.lines.map((l) => [l.seriesId, l])).values()]
    : projection.lines

  let ly = legendStart
  for (const line of legende.slice(0, Math.min(4, passt))) {
    ctx.strokeStyle = colors[line.key] ?? theme.text
    ctx.lineWidth = Math.max(2, style.line.width * (width / 700))
    ctx.setLineDash(line.dash ? line.dash.split(/[\s,]+/).map(Number) : [])
    ctx.beginPath()
    ctx.moveTo(pad, ly - legendSize * 0.35)
    ctx.lineTo(pad + legendSize * 1.6, ly - legendSize * 0.35)
    ctx.stroke()
    ctx.setLineDash([])

    // Das " · Szenario" am Ende weglassen - es benennt hier nur eines von
    // mehreren und führte damit in die Irre.
    const beschriftung =
      vergleich && line.scenarioLabel
        ? line.label.replace(` · ${line.scenarioLabel}`, '')
        : line.label

    ctx.fillStyle = theme.text
    ctx.fillText(kuerzen(ctx, beschriftung, textBreite), textLinks, ly)
    ly += legendZeilenH
  }

  ctx.restore()
}
