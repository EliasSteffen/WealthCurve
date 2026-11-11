import { marketMonthOffset } from '../../timeAxis.ts'
import { simulate } from '../math.ts'
import { defineSeries } from '../types.ts'

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
  requiredParams: ['monthlyContribution', 'contributionGrowth', 'initialCapital'],
  // Mehrere geladene Wertpapiere ergeben mehrere Kurven - jede rechnet mit
  // ihrem eigenen Verlauf, das Sparverhalten bleibt dasselbe.
  fanOut: 'markets',
  compute: ({ base, params, model, market }) => {
    const leer = () => base.years.map(() => null)

    // Ohne geladenen Kurs gibt es nichts zu zeichnen. Eine erfundene Kurve
    // waere schlimmer als eine fehlende.
    if (!market || market.monthlyReturns.length === 0) return leer()

    /*
     * Ohne Startjahr ebenfalls nichts.
     *
     * Echte Monatsrenditen haengen an echten Monaten. Ohne Kalenderanker hiesse
     * "Apple als Vergleich" stillschweigend "ab dem Monat, in dem die Historie
     * zufaellig beginnt" - und vorwaerts laesst sich ein Kurs ohnehin nicht
     * fortschreiben. Die Frage muss lauten: haette man AB WANN gehalten?
     */
    if (model.startYear === null) return leer()

    const versatz = marketMonthOffset(market.start, model.startYear, model.startMonth)
    // Negativ heisst: das Papier gab es zum Start noch nicht.
    if (versatz === null || versatz < 0) return leer()

    const renditen = market.monthlyReturns
    if (versatz >= renditen.length) return leer()

    // Gedeckt sind immer volle Jahre à 12 Monate - auch bei jährlicher
    // Verzinsung, die pro Jahr einen Schritt macht.
    const gedeckteJahre = Math.floor((renditen.length - versatz) / 12)
    const jaehrlich = model.compounding === 'annual'

    /*
     * `runPhase` zählt Perioden: Monate, bei jährlicher Verzinsung aber Jahre.
     * Ein Jahresschritt braucht deshalb die verkettete Rendite der zwölf
     * Monate, nicht den Wert eines einzelnen Monats.
     */
    const rateAt = (i: number): number => {
      if (!jaehrlich) return renditen[versatz + i] ?? 0
      let faktor = 1
      for (let m = 0; m < 12; m += 1) faktor *= 1 + (renditen[versatz + i * 12 + m] ?? 0)
      return faktor - 1
    }

    const werte = simulate({
      annualRatePercent: 0,
      monthlyContribution: params.monthlyContribution,
      initialCapital: params.initialCapital,
      monthlyWithdrawalOverride: base.monthlyWithdrawal,
      params,
      model,
      rateAt,
    }).years.map((y) => y.balance)

    // Jenseits der Historie endet die Kurve, statt fortgeschrieben zu werden -
    // erfundene Renditen waeren eine Behauptung, keine Auskunft.
    return werte.map((wert, jahr) => (jahr <= gedeckteJahre ? wert : null))
  },
})
