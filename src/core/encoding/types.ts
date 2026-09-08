/** Woraus eine Chart-Linie ihre Identität bezieht. */
export interface LineIdentity {
  readonly scenarioId: string
  readonly scenarioColorSlot: number
  readonly seriesId: string
  /** Position im aktiven Serien-Set - bestimmt den Linienstil. */
  readonly seriesIndex: number
  readonly seriesColorVar: string
}

export interface LineStyle {
  readonly colorVar: string
  /** SVG stroke-dasharray; undefined = durchgezogen. */
  readonly dash?: string
  readonly opacity: number
}

export interface EncodingInput {
  readonly scenarioCount: number
  readonly seriesCount: number
}

export type CapacityLevel = 'ok' | 'crowded' | 'over'

export interface CapacityReport {
  readonly level: CapacityLevel
  readonly lineCount: number
  readonly message: string | null
}

/**
 * Wie Farbe und Linienstil auf Szenario und Serie verteilt werden.
 *
 * Eine neue Kodierung ist eine Datei plus eine Zeile im Registry - dasselbe
 * Muster wie bei Serien und Entnahmeregeln.
 */
export interface EncodingStrategy {
  readonly id: string
  readonly label: string
  /** Erklärt dem Leser, was Farbe und was Strich bedeutet. */
  describe(input: EncodingInput): string
  style(line: LineIdentity, input: EncodingInput): LineStyle
  capacity(input: EncodingInput): CapacityReport
}

/**
 * Bewusst OHNE const-Generic: sonst behält die Konstante die enge Signatur
 * ihrer Implementierung (etwa ohne `dash`), und Aufrufer der Schnittstelle
 * bekommen Typfehler für Felder, die es laut Interface gibt.
 */
export const defineEncoding = (encoding: EncodingStrategy): EncodingStrategy => encoding

/**
 * Linienstile für Serien. Vier sind das Maximum, das sich zuverlässig
 * unterscheiden lässt - danach trägt die Legende, nicht mehr der Strich.
 */
export const DASH_PATTERNS: readonly (string | undefined)[] = [
  undefined, // durchgezogen
  '6 4', // gestrichelt
  '1 5', // gepunktet (mit rundem Linienende)
  '10 4 2 4', // Strichpunkt
]

export const dashFor = (index: number): string | undefined =>
  DASH_PATTERNS[index % DASH_PATTERNS.length]

/**
 * Sichtbare Linien = Szenarien × Serien. Jenseits von acht trägt die Farbe
 * nicht mehr; jenseits von zwölf ist der Chart nur noch Dekoration. Wir
 * blockieren nie - die Tabelle bleibt immer der vollständige Weg zu den Zahlen.
 */
export function reportCapacity(input: EncodingInput): CapacityReport {
  const lineCount = input.scenarioCount * input.seriesCount
  if (lineCount <= 8) return { level: 'ok', lineCount, message: null }
  if (lineCount <= 12) {
    return {
      level: 'crowded',
      lineCount,
      message: `${lineCount} Linien im Chart. Weniger Szenarien oder Serien lesen sich leichter.`,
    }
  }
  return {
    level: 'over',
    lineCount,
    message: `${lineCount} Linien sind kaum noch unterscheidbar. Blende Szenarien oder Serien aus – die Tabelle zeigt weiterhin alle Werte.`,
  }
}
