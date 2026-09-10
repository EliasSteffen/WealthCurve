/**
 * Die Bildmarke - Geometrie und Farben an genau einer Stelle.
 *
 * Sie erscheint an vier Orten: in der Kopfzeile als React-Komponente, als
 * favicon.svg, als Symbol für den Startbildschirm und in den Symbolen des
 * Web-Manifests. Läge die Geometrie in jeder Datei erneut, liefen sie beim
 * ersten Nachschärfen auseinander - und es fällt niemandem auf, weil man ein
 * Favicon selten ansieht. Die Dateien in public/ werden deshalb aus diesem
 * Modul erzeugt (`npm run icons`) und nicht von Hand gepflegt.
 *
 * Framework-frei: dasselbe Modul bedient JSX im Browser und Canvas in Node.
 */

export const LOGO_VIEWBOX = 24

/** Die Achse - ohne sie schwebte die Kurve im Nichts. */
export const LOGO_AXIS = 'M3.5 20.5H20.5'
/** Der Depotwert: flach beginnend, am Ende steil. */
export const LOGO_CURVE = 'M3.5 17.5C9.5 17.2 13.5 14.5 17.5 5.5'
export const LOGO_DOT = { cx: 17.5, cy: 5.5 } as const

export type LogoVariante = 'normal' | 'kompakt'

export interface LogoStrichstaerke {
  readonly axis: number
  readonly curve: number
  readonly dot: number
}

/**
 * Zwei Strichstärken, weil ein Favicon bei 16 px gezeichnet wird.
 *
 * Die Marke der Kopfzeile hat dort Haarlinien und zerfällt zu einem grauen
 * Fleck. „kompakt" ist keine zweite Marke, nur dieselbe mit Reserve für die
 * Größe, in der sie tatsächlich erscheint.
 */
export const LOGO_STROKE: Record<LogoVariante, LogoStrichstaerke> = {
  normal: { axis: 1.5, curve: 2.4, dot: 2.4 },
  kompakt: { axis: 2, curve: 3.2, dot: 3 },
}

/**
 * Feste Farben für alles außerhalb der Seite.
 *
 * Ein Favicon und ein Symbol für den Startbildschirm werden gezeichnet, ohne
 * dass die CSS-Variablen der Seite existieren. Die Werte sind die Ersatzfarben
 * der Palette; das Grau trägt auf hellem wie auf dunklem Grund.
 */
export const LOGO_COLORS = { axis: '#8a8a8a', accent: '#2a78d6' } as const

/** Grund für Symbole, die keinen durchsichtigen Hintergrund vertragen. */
export const LOGO_BACKGROUND = { light: '#f9f9f7', dark: '#141413' } as const

/** Der Kreis am Kurvenende als Pfad - `arc` gibt es nicht in jeder Umgebung. */
function punktPfad(r: number): string {
  const { cx, cy } = LOGO_DOT
  return `M${cx} ${cy}m${-r} 0a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
}

export interface LogoSvgOptions {
  readonly variante?: LogoVariante
  /** Ohne Angabe durchsichtig - für ein Favicon das Richtige. */
  readonly background?: string
  readonly comment?: string
}

/** Die Marke als eigenständige SVG-Datei. */
export function logoSvg({ variante = 'normal', background, comment }: LogoSvgOptions = {}): string {
  const s = LOGO_STROKE[variante]
  const v = LOGO_VIEWBOX
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v} ${v}" width="${v}" height="${v}" fill="none">`,
    comment ? `  <!--\n${comment}\n  -->` : null,
    background ? `  <rect width="${v}" height="${v}" fill="${background}"/>` : null,
    `  <path d="${LOGO_AXIS}" stroke="${LOGO_COLORS.axis}" stroke-width="${s.axis}" stroke-linecap="round"/>`,
    `  <path d="${LOGO_CURVE}" stroke="${LOGO_COLORS.accent}" stroke-width="${s.curve}" stroke-linecap="round"/>`,
    `  <circle cx="${LOGO_DOT.cx}" cy="${LOGO_DOT.cy}" r="${s.dot}" fill="${LOGO_COLORS.accent}"/>`,
    '</svg>',
  ]
    .filter((zeile) => zeile !== null)
    .join('\n')
}

/**
 * Nur die zum Zeichnen nötigen Fähigkeiten eines Canvas.
 *
 * Node und Browser bringen beide einen 2D-Kontext mit, aber mit
 * unterschiedlichen Typen. Diese Form ist der gemeinsame Nenner und erspart ein
 * `as unknown as` an der Aufrufstelle.
 */
export interface LogoCanvas {
  save(): void
  restore(): void
  scale(x: number, y: number): void
  stroke(path: never): void
  fill(path: never): void
  fillRect(x: number, y: number, w: number, h: number): void
  lineWidth: number
  lineCap: string
  strokeStyle: string
  fillStyle: string
}

/**
 * Zeichnet die Marke auf ein Canvas beliebiger Größe.
 *
 * `Pfad` ist der Path2D-Konstruktor der jeweiligen Umgebung - im Browser der
 * globale, in Node der aus @napi-rs/canvas. Er kommt als Parameter, damit
 * dieses Modul keine der beiden Welten importieren muss.
 */
export function drawLogo(
  ctx: LogoCanvas,
  size: number,
  Pfad: new (d: string) => unknown,
  optionen: { readonly variante?: LogoVariante; readonly background?: string } = {},
): void {
  const { variante = 'normal', background } = optionen
  const s = LOGO_STROKE[variante]
  const zeichne = (methode: 'stroke' | 'fill', d: string) =>
    ctx[methode](new Pfad(d) as never)

  ctx.save()
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, size, size)
  }
  const faktor = size / LOGO_VIEWBOX
  ctx.scale(faktor, faktor)
  ctx.lineCap = 'round'

  ctx.strokeStyle = LOGO_COLORS.axis
  ctx.lineWidth = s.axis
  zeichne('stroke', LOGO_AXIS)

  ctx.strokeStyle = LOGO_COLORS.accent
  ctx.lineWidth = s.curve
  zeichne('stroke', LOGO_CURVE)

  ctx.fillStyle = LOGO_COLORS.accent
  zeichne('fill', punktPfad(s.dot))
  ctx.restore()
}
