/**
 * Die Bildmarke: Achse, wachsende Kurve, Endpunkt.
 *
 * Genau das Bild, das die Anwendung erzeugt. Eine erste Fassung zeigte
 * zusätzlich die gerade Linie des Eingezahlten und die Fläche dazwischen - die
 * eigentliche Aussage -, aber zwei fast parallele Kurven lassen sich in 24 px
 * nicht trennen: bei 26 px blieb ein blauer Haken übrig. Was klein nicht mehr
 * lesbar ist, gehört nicht in ein Logo.
 *
 * Inline und nicht als Datei, damit `currentColor` und die Palette greifen: die
 * Marke trägt im hellen wie im dunklen Thema und braucht keine zweite Fassung.
 */
export function Logo({ size = 26 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      {/* Die Achse - ohne sie schwebte die Kurve im Nichts. */}
      <path
        d="M3.5 20.5H20.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M3.5 17.5C9.5 17.2 13.5 14.5 17.5 5.5"
        stroke="var(--chart-1, #2a78d6)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="17.5" cy="5.5" r="2.4" fill="var(--chart-1, #2a78d6)" />
    </svg>
  )
}
