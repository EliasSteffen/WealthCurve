import { defineSeries } from '../types'

/**
 * Kaufkraft: derselbe Depotwert, abgezinst auf heutiges Geld.
 * Reine Projektion von `base` - simuliert bewusst NICHT selbst nach, damit die
 * Zinslogik an genau einer Stelle lebt.
 */
export const purchasingPowerSeries = defineSeries({
  id: 'purchasingPower',
  label: 'Kaufkraft',
  description: 'Depotwert inflationsbereinigt, in heutigem Geld.',
  colorVar: 'var(--chart-3, #1baf7a)',
  unit: 'currency',
  defaultEnabled: false,
  requiredParams: ['annualRate', 'monthlyContribution', 'initialCapital', 'inflationRate'],
  compute: ({ base, params }) => {
    const factor = 1 + params.inflationRate / 100
    return base.years.map((y) => y.balance / factor ** y.year)
  },
})
