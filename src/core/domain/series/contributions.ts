import { defineSeries } from '../types'

/**
 * Der "normale Kontostand": nur Einzahlungen, kein Zins.
 * Die Referenzlinie - der Abstand zu `compound` IST der Zinseszins-Effekt.
 */
export const contributionsSeries = defineSeries({
  id: 'contributions',
  label: 'Eingezahlt',
  description: 'Summe aller Einzahlungen ohne jede Verzinsung.',
  colorVar: 'var(--chart-2, #eb6834)',
  unit: 'currency',
  defaultEnabled: true,
  requiredParams: ['monthlyContribution', 'initialCapital'],
  compute: ({ base }) => base.years.map((y) => y.contributions),
})
