import { LOGO_AXIS, LOGO_CURVE, LOGO_DOT, LOGO_STROKE, LOGO_VIEWBOX } from '../../render/logo'

/**
 * Die Bildmarke: Achse, wachsende Kurve, Endpunkt.
 *
 * Genau das Bild, das die Anwendung erzeugt. Eine erste Fassung zeigte
 * zusätzlich die gerade Linie des Eingezahlten und die Fläche dazwischen - die
 * eigentliche Aussage -, aber zwei fast parallele Kurven lassen sich in 24 px
 * nicht trennen: bei 26 px blieb ein blauer Haken übrig. Was klein nicht mehr
 * lesbar ist, gehört nicht in ein Logo.
 *
 * Die Geometrie kommt aus `render/logo`, damit Kopfzeile, Favicon und die
 * Symbole für den Startbildschirm dieselbe Marke zeigen. Die Farben stehen
 * dagegen hier: im Browser gibt es CSS-Variablen, und die Marke soll dem Thema
 * folgen. Die festen Werte im Modul gelten nur für alles außerhalb der Seite.
 */
export function Logo({ size = 26 }: { readonly size?: number }) {
  const strich = LOGO_STROKE.normal
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d={LOGO_AXIS}
        stroke="currentColor"
        strokeWidth={strich.axis}
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d={LOGO_CURVE}
        stroke="var(--chart-1, #2a78d6)"
        strokeWidth={strich.curve}
        strokeLinecap="round"
      />
      <circle cx={LOGO_DOT.cx} cy={LOGO_DOT.cy} r={strich.dot} fill="var(--chart-1, #2a78d6)" />
    </svg>
  )
}
