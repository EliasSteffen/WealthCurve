import type { CapacityReport } from '../core/encoding'
import type { ProjectionLine } from '../core/projection'
import type { Translate } from '../i18n'

/*
 * Texte zur Kodierung und zur Linienzahl.
 *
 * `buildProjection` liefert dazu deutsche Sätze mit (`encodingDescription`,
 * `capacity.message`), weil es auch im MCP-Server und im Node-Skript läuft.
 * Die Oberfläche setzt sie hier aus den IDs und Zahlen selbst zusammen, statt
 * den fertigen deutschen Satz zu übersetzen. Der Kern-Text bleibt als
 * Rückfall für eine Kodierung, die noch keine Übersetzung hat.
 */

/** Wie viele Serien je Szenario im Chart stehen (Varianten zählen einzeln). */
export function seriesCountOf(lines: readonly ProjectionLine[]): number {
  return new Set(lines.map((l) => `${l.seriesId}|${l.variantLabel ?? ''}`)).size
}

export function encodingText(
  t: Translate,
  encodingId: string,
  seriesCount: number,
  fallback: string,
): string {
  if (encodingId === 'colorBySeries') return t('encoding.colorBySeries', 'Farbe = Serie')
  if (encodingId === 'colorByScenario') {
    return seriesCount > 1
      ? t('encoding.colorByScenarioWithStyle', 'Farbe = Szenario · Strich = Serie')
      : t('encoding.colorByScenario', 'Farbe = Szenario')
  }
  return fallback
}

/** `null`, wenn die Linienzahl unbedenklich ist. */
export function capacityText(t: Translate, capacity: CapacityReport): string | null {
  const count = capacity.lineCount
  if (capacity.level === 'crowded') {
    return t(
      'capacity.crowded',
      `${count} Linien im Chart. Weniger Szenarien oder Serien lesen sich leichter.`,
      { count },
    )
  }
  if (capacity.level === 'over') {
    return t(
      'capacity.over',
      `${count} Linien sind kaum noch unterscheidbar. Blende Szenarien oder Serien aus – die Tabelle zeigt weiterhin alle Werte.`,
      { count },
    )
  }
  return capacity.message
}
