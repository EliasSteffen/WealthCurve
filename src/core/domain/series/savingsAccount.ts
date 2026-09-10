import { simulate } from '../math'
import { defineSeries } from '../types'

/**
 * Tagesgeld: gleiche Sparrate, aber eigener (niedrigerer) Zins.
 *
 * Keine Projektion von `base`, sondern eine eigene Simulation - der Notausgang
 * für Serien mit abweichender Dynamik. `simulateMonthly` steht jeder Serie offen;
 * nur der Standardweg ist die Projektion.
 */
export const savingsAccountSeries = defineSeries({
  id: 'savingsAccount',
  label: 'Tagesgeld',
  description: 'Gleiche Sparrate zum niedrigeren Tagesgeldzins.',
  colorVar: 'var(--chart-4, #eda100)',
  unit: 'currency',
  defaultEnabled: false,
  requiredParams: ['savingsRate', 'monthlyContribution', 'contributionGrowth', 'initialCapital'],
  compute: ({ params, model }) =>
    simulate({
      annualRatePercent: params.savingsRate,
      monthlyContribution: params.monthlyContribution,
      initialCapital: params.initialCapital,
      params,
      model,
    }).years.map((y) => y.balance),
})
