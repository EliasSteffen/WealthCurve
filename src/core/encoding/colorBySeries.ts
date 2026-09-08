import { defineEncoding, reportCapacity } from './types'

/**
 * Farbe trägt die Serie, alle Linien durchgezogen.
 *
 * Richtig, solange nur ein Szenario sichtbar ist - dann gibt es keine zweite
 * Dimension zu kodieren, und die Serien bekommen die volle Farbpalette.
 */
export const colorBySeries = defineEncoding({
  id: 'colorBySeries',
  label: 'Farbe = Serie',
  describe: () => 'Farbe = Serie',
  style: (line) => ({ colorVar: line.seriesColorVar, opacity: 1 }),
  capacity: reportCapacity,
})
