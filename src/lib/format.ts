/*
 * Intl.NumberFormat ist teuer zu konstruieren. Diese Formatter laufen in
 * Achsen-Ticks und Tabellenzeilen - also einmal je Sprache bauen und
 * zwischenspeichern, niemals pro Render.
 *
 * Die aktive Sprache liegt bewusst modulweit statt im React-Kontext: dadurch
 * behalten formatEur & Co. ihre einfache Signatur und bleiben auch aus dem
 * Canvas-Renderer und dem Kern heraus aufrufbar, die keinen Kontext haben.
 * Der Preis ist ein globaler Zustand - vertretbar, weil immer genau eine
 * Sprache aktiv ist und der Provider sie als Einziger setzt.
 */

interface Formatter {
  readonly eur: Intl.NumberFormat
  readonly eurCents: Intl.NumberFormat
  readonly compact: Intl.NumberFormat
  readonly percent: Intl.NumberFormat
}

const cache = new Map<string, Formatter>()

function build(locale: string): Formatter {
  const waehrung = locale.startsWith('de') ? 'EUR' : 'EUR'
  return {
    eur: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: waehrung,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }),
    eurCents: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: waehrung,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    /*
     * Deutsches Compact kuerzt Tausender NICHT ab: 609985 -> "609.985".
     * Erst ab Millionen greift es: 1234567 -> "1,2 Mio.". Englisch kuerzt
     * dagegen schon ab Tausendern ("610K") - beides ist korrekt fuer die
     * jeweilige Sprache.
     */
    compact: new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }),
    percent: new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }),
  }
}

let aktuell = 'de-DE'

function f(): Formatter {
  let vorhanden = cache.get(aktuell)
  if (!vorhanden) {
    vorhanden = build(aktuell)
    cache.set(aktuell, vorhanden)
  }
  return vorhanden
}

/** Wird ausschliesslich vom LocaleProvider aufgerufen. */
export function setFormatterLocale(locale: string): void {
  aktuell = locale
}

export function currentFormatterLocale(): string {
  return aktuell
}

export const formatEur = (value: number) => f().eur.format(value)
export const formatEurCents = (value: number) => f().eurCents.format(value)
export const formatEurCompact = (value: number) => `${f().compact.format(value)} €`

/** Erwartet Prozentpunkte: 7.25 -> "7,25 %". */
export const formatPercent = (percentPoints: number) => f().percent.format(percentPoints / 100)

export const formatYears = (years: number) =>
  aktuell.startsWith('de')
    ? `${years} ${years === 1 ? 'Jahr' : 'Jahre'}`
    : `${years} ${years === 1 ? 'year' : 'years'}`

/** Nach Einheit aus dem Parameter-Registry formatieren. */
export function formatParamValue(value: number, unit: 'currency' | 'percent' | 'years') {
  if (unit === 'currency') return formatEur(value)
  if (unit === 'percent') return formatPercent(value)
  return formatYears(value)
}

/**
 * Akzeptiert deutsche Eingaben. `<input type="number">` liefert bei "4,5" in
 * mehreren Browsern NaN - deshalb parsen wir selbst.
 *
 * Der Punkt ist im Deutschen mehrdeutig: "10.000" sind zehntausend, "4.5" ist
 * viereinhalb. Aufgeloest wird nach der Gruppenregel - ein Punkt mit exakt drei
 * Ziffern dahinter ist ein Tausenderpunkt, sonst ein Dezimaltrenner.
 * Ein Komma ist immer eindeutig der Dezimaltrenner.
 */
export function parseGermanNumber(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, '').trim()
  if (cleaned === '' || cleaned === '-') return NaN

  const negative = cleaned.startsWith('-')
  const digits = cleaned.replace(/-/g, '')

  let normalized: string
  if (digits.includes(',')) {
    // Komma vorhanden -> es ist der Dezimaltrenner, Punkte sind Tausender.
    const lastComma = digits.lastIndexOf(',')
    const whole = digits.slice(0, lastComma).replace(/[,.]/g, '')
    const fraction = digits.slice(lastComma + 1).replace(/[,.]/g, '')
    normalized = `${whole || '0'}.${fraction || '0'}`
  } else {
    const parts = digits.split('.')
    if (parts.length === 1) {
      normalized = parts[0]
    } else if (parts.length > 2 || parts[parts.length - 1].length === 3) {
      // "1.234.567" oder "10.000" -> alles Tausenderpunkte.
      normalized = parts.join('')
    } else {
      normalized = `${parts[0] || '0'}.${parts[1]}`
    }
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return NaN
  return negative ? -value : value
}
