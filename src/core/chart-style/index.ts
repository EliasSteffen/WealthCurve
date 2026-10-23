import { bold } from './bold.ts'
import { clean } from './clean.ts'
import { minimal } from './minimal.ts'
import { presentation } from './presentation.ts'
import { sketch } from './sketch.ts'
import type { ChartStyle } from './types.ts'

/** Registry - ein neuer Stil ist eine Datei plus eine Zeile hier. */
export const CHART_STYLES: readonly ChartStyle[] = [clean, sketch, minimal, bold, presentation]

export const DEFAULT_CHART_STYLE_ID = clean.id

export function resolveChartStyle(id: string): ChartStyle {
  return CHART_STYLES.find((style) => style.id === id) ?? clean
}

export { bold, clean, minimal, presentation, sketch }
export type { ChartStyle } from './types.ts'
export { defineChartStyle } from './types.ts'
