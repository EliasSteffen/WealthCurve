import { defineSeries } from '../types'

/**
 * Kumuliert entnommenes Geld. Macht die Entnahmephase im Chart lesbar: die
 * Kurve bleibt bis Rentenbeginn bei null und steigt danach linear an.
 */
export const withdrawnSeries = defineSeries({
  id: 'withdrawn',
  label: 'Entnommen',
  description: 'Summe der bisherigen Entnahmen.',
  colorVar: 'var(--chart-5, #e87ba4)',
  unit: 'currency',
  defaultEnabled: false,
  requiredParams: ['monthlyWithdrawal', 'withdrawalRate'],
  compute: ({ base }) => base.years.map((y) => y.withdrawals),
})
