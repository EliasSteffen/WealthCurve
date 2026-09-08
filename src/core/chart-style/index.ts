import { bold } from './bold'
import { clean } from './clean'
import { minimal } from './minimal'
import { presentation } from './presentation'
import { sketch } from './sketch'
import type { ChartStyle } from './types'

/** Registry - ein neuer Stil ist eine Datei plus eine Zeile hier. */
export const CHART_STYLES: readonly ChartStyle[] = [clean, sketch, minimal, bold, presentation]

export const DEFAULT_CHART_STYLE_ID = clean.id

export function resolveChartStyle(id: string): ChartStyle {
  return CHART_STYLES.find((style) => style.id === id) ?? clean
}

export { bold, clean, minimal, presentation, sketch }
export type { ChartStyle } from './types'
export { defineChartStyle } from './types'
