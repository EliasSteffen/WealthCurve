import type { SeriesDefinition } from '../types.ts'
import { compoundSeries } from './compound.ts'
import { contributionsSeries } from './contributions.ts'
import { marketReturnSeries } from './marketReturn.ts'
import { purchasingPowerSeries } from './purchasingPower.ts'
import { savingsAccountSeries } from './savingsAccount.ts'
import { withdrawnSeries } from './withdrawn.ts'

/**
 * Das Series-Registry - der einzige Ort, den eine neue Serie anfassen muss.
 *
 * Reihenfolge = Anzeigereihenfolge in Panel, Legende und Tabelle. Die
 * Zeichenreihenfolge im Chart ist die umgekehrte (SVG kennt kein z-index),
 * damit die Hauptkurve oben liegt - siehe GrowthChart.
 */
export const SERIES: readonly SeriesDefinition[] = [
  compoundSeries,
  contributionsSeries,
  purchasingPowerSeries,
  savingsAccountSeries,
  withdrawnSeries,
  marketReturnSeries,
]

export type SeriesId = (typeof SERIES)[number]['id']

export const SERIES_BY_ID = new Map(SERIES.map((s) => [s.id, s]))

export const DEFAULT_ENABLED_SERIES: readonly string[] = SERIES.filter(
  (s) => s.defaultEnabled,
).map((s) => s.id)
