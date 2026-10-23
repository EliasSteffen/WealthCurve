import { defineSeries } from '../types.ts'

/** Die Hauptkurve: Depotwert mit Zinseszins. */
export const compoundSeries = defineSeries({
  id: 'compound',
  label: 'Zinseszins',
  description: 'Depotwert inklusive reinvestierter Erträge.',
  colorVar: 'var(--chart-1, #2a78d6)',
  unit: 'currency',
  defaultEnabled: true,
  requiredParams: ['annualRate', 'monthlyContribution', 'contributionGrowth', 'initialCapital'],
  compute: ({ base }) => base.years.map((y) => y.balance),
})
