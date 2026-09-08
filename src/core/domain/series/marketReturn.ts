import { simulate } from '../math'
import { defineSeries } from '../types'

/**
 * Dasselbe Sparverhalten, aber mit dem tatsaechlichen Verlauf eines Wertpapiers
 * statt einer festen Jahresrendite.
 *
 * Zeigt, was die Glaettung auf "8 % pro Jahr" verschweigt: echte Kurse fallen
 * zwischendurch, und wann sie das tun, aendert das Ergebnis erheblich.
 */
export const marketReturnSeries = defineSeries({
  id: 'marketReturn',
  label: 'Kursverlauf',
  description: 'Echte Monatsrenditen des gewaehlten Wertpapiers.',
  colorVar: 'var(--chart-7, #4a3aa7)',
  unit: 'currency',
  defaultEnabled: false,
  requiredParams: ['monthlyContribution', 'initialCapital'],
  compute: ({ base, params, model, market }) => {
    // Ohne geladenen Kurs gibt es nichts zu zeichnen. Eine erfundene Kurve
    // waere schlimmer als eine fehlende.
    if (!market || market.monthlyReturns.length === 0) {
      return base.years.map(() => null)
    }

    const renditen = market.monthlyReturns
    const proJahr = model.compounding === 'annual' ? 1 : 12
    const gedeckteJahre = Math.floor(renditen.length / proJahr)

    const werte = simulate({
      annualRatePercent: 0,
      monthlyContribution: params.monthlyContribution,
      initialCapital: params.initialCapital,
      monthlyWithdrawalOverride: base.monthlyWithdrawal,
      params,
      model,
      rateAt: (i) => renditen[i] ?? 0,
    }).years.map((y) => y.balance)

    // Jenseits der Historie endet die Kurve, statt fortgeschrieben zu werden -
    // erfundene Renditen waeren eine Behauptung, keine Auskunft.
    return werte.map((wert, jahr) => (jahr <= gedeckteJahre ? wert : null))
  },
})
