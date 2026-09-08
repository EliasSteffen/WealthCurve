import { simulate } from '../math'
import { defineSeries } from '../types'

/**
 * Dasselbe Szenario ohne jede Rendite.
 *
 * Beantwortet: "Was, wenn du das Geld einfach nur sammelst?" - gleiche
 * Einzahlungen, gleiche Entnahmen, nur 0 % Verzinsung. In der Entnahmephase
 * faellt die Kurve deshalb und ist deutlich frueher aufgebraucht als das
 * verzinste Depot. Genau dieser Abstand ist die Aussage der App.
 *
 * Fruehere Fassung war eine blosse Summe der Einzahlungen und blieb in der
 * Entnahmephase flach - das verglich einen Auszahlplan mit einem Sparkonto,
 * von dem nie etwas abging.
 */
export const contributionsSeries = defineSeries({
  id: 'contributions',
  label: 'Ohne Rendite',
  description: 'Gleiche Ein- und Auszahlungen bei 0 % Rendite.',
  colorVar: 'var(--chart-2, #eb6834)',
  unit: 'currency',
  defaultEnabled: true,
  requiredParams: ['monthlyContribution', 'initialCapital'],
  compute: ({ base, params, model }) =>
    simulate({
      annualRatePercent: 0,
      monthlyContribution: params.monthlyContribution,
      initialCapital: params.initialCapital,
      // Derselbe Entnahmebetrag wie im Hauptszenario. Ohne das wuerde die
      // Prozentregel aus dem viel kleineren 0-%-Kapital eine viel kleinere
      // Entnahme ableiten - und wir vergleichen zwei Auszahlplaene statt
      // zweier Renditen.
      monthlyWithdrawalOverride: base.monthlyWithdrawal,
      params,
      model,
    }).years.map((y) => y.balance),
})
