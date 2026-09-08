/*
 * Intl.NumberFormat ist teuer zu konstruieren. Diese Formatter laufen in
 * Achsen-Ticks und Tabellenzeilen - also einmal auf Modulebene bauen,
 * niemals pro Render.
 */

const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const EUR_CENTS = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/*
 * Deutsches Compact kuerzt Tausender NICHT ab: 609985 -> "609.985".
 * Erst ab Millionen greift es: 1234567 -> "1,2 Mio.". Das ist korrektes
 * Deutsch und auf einer Euro-Achse gut lesbar.
 */
const COMPACT = new Intl.NumberFormat('de-DE', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
})

const PERCENT = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const formatEur = (value: number) => EUR.format(value)
export const formatEurCents = (value: number) => EUR_CENTS.format(value)
export const formatEurCompact = (value: number) => `${COMPACT.format(value)} €`

/** Erwartet Prozentpunkte: 7.25 -> "7,25 %". */
export const formatPercent = (percentPoints: number) => PERCENT.format(percentPoints / 100)

export const formatYears = (years: number) => `${years} ${years === 1 ? 'Jahr' : 'Jahre'}`

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
