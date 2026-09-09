/**
 * Beschriftung der Zeitachse - und der einzige Ort, der Kalender kennt.
 *
 * Die Projektion rechnet in Jahres-Indizes ab 0. Ob daraus „12", „mit 42" oder
 * „2007" wird, entscheidet sich hier und nirgends sonst; damit ändert ein
 * Umschalten der Anzeige garantiert keine Zahl.
 */
import type { ModelSettings, TimeAxisMode } from './domain/types'

export const MIN_START_AGE = 0
export const MAX_START_AGE = 100
/** Weiter zurück reicht keine brauchbare Kurshistorie. */
export const MIN_START_YEAR = 1900
export const MAX_START_YEAR = 2100

/** Grenzen einhalten und ganzzahlig machen; null bleibt null. */
export function sanitizeStartAge(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Math.round(Math.min(MAX_START_AGE, Math.max(MIN_START_AGE, value)))
}

export function sanitizeStartYear(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Math.round(Math.min(MAX_START_YEAR, Math.max(MIN_START_YEAR, value)))
}

/**
 * Der Modus greift nur, wenn sein Anker gesetzt ist.
 *
 * Sonst stünde „Alter" an der Achse und darunter dieselben Zahlen wie vorher -
 * ein stiller Fehlschlag, den niemand bemerkt.
 */
export function effectiveMode(model: ModelSettings): TimeAxisMode {
  if (model.timeAxis === 'age' && model.startAge !== null) return 'age'
  if (model.timeAxis === 'calendar' && model.startYear !== null) return 'calendar'
  return 'relative'
}

export function yearLabel(year: number, model: ModelSettings): string {
  switch (effectiveMode(model)) {
    case 'age':
      return String((model.startAge ?? 0) + year)
    case 'calendar':
      return String((model.startYear ?? 0) + year)
    default:
      return String(year)
  }
}

export function yearLabels(count: number, model: ModelSettings): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => yearLabel(i, model))
}

/**
 * Um wie viele Monate in die Kurshistorie gesprungen werden muss, damit ihr
 * Monat 0 auf den Januar des Startjahres fällt.
 *
 * `null` bei unbrauchbarem Datum. Ein negativer Wert heißt: das Papier gab es
 * im Startjahr noch nicht - dann gibt es nichts zu zeigen, statt heimlich
 * woanders anzufangen.
 */
export function marketMonthOffset(marketStart: string, startYear: number): number | null {
  const treffer = /^(\d{4})-(\d{2})/.exec(marketStart)
  if (!treffer) return null
  const jahr = Number(treffer[1])
  const monatIndex = Number(treffer[2]) - 1
  if (!Number.isFinite(jahr) || !Number.isFinite(monatIndex)) return null
  return (startYear - jahr) * 12 - monatIndex
}
