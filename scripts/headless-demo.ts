/**
 * Beweis, dass der Kern ohne Oberfläche läuft.
 *
 *     npm run demo
 *
 * Kein React, kein DOM, kein Chart - nur `src/core`. Genau diese Schnittstelle
 * würde ein MCP-Server bedienen.
 */
import {
  actions,
  buildProjection,
  createInitialState,
  createStore,
  projectionToCsv,
  reducer,
  selectProjection,
  serialize,
} from '../src/core/index'

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const line = (label: string, value: string) => `  ${label.padEnd(24)} ${value.padStart(14)}`

// ---------------------------------------------------------------- Variante 1
// Einmalige Rechnung: reines JSON rein, reines JSON raus. Kein Zustand nötig.

const einmalig = buildProjection({
  scenarios: [
    {
      id: 'basis',
      label: 'Basis',
      colorSlot: 1,
      params: {
        monthlyContribution: 500,
        contributionGrowth: 0,
        annualRate: 7,
        initialCapital: 0,
        inflationRate: 2,
        savingsRate: 2,
        monthlyWithdrawal: 2_000,
        withdrawalRate: 4,
      },
    },
  ],
  seriesIds: ['compound', 'contributions'],
  model: {
    compounding: 'monthly-effective',
    timing: 'end',
    accumulationYears: 30,
    withdrawalYears: 25,
    withdrawalStrategyId: 'percentRule',
    amountsInflationAdjusted: false,
    timeAxis: 'relative',
    startAge: null,
    startYear: null,
    startMonth: 1,
  },
})

const basis = einmalig.summaries[0]
console.log('\nbuildProjection() – ein Aufruf, kein Zustand')
console.log(line('Bei Rentenbeginn', eur.format(basis.capitalAtRetirement)))
console.log(line('Monatliche Entnahme', eur.format(basis.monthlyWithdrawal)))
console.log(line('Kapital reicht', basis.depletedAtYear === null ? 'durch' : `bis Jahr ${basis.depletedAtYear}`))
console.log(line('Restkapital', eur.format(basis.final.balance)))

// ---------------------------------------------------------------- Variante 2
// Zustand über den Store - dieselbe Rechnung, aber mit Aktionen und Selektoren.

const store = createStore(reducer, createInitialState())
store.dispatch(actions.addScenario('Aggressiv', { annualRate: 9, monthlyContribution: 500 }))
store.dispatch(actions.addScenario('Sicher', { annualRate: 3, monthlyContribution: 500 }))

const projection = selectProjection(store.getSnapshot())

console.log('\ncreateStore() – drei Szenarien im Vergleich')
for (const summary of projection.summaries) {
  console.log(line(summary.label, eur.format(summary.capitalAtRetirement)))
}
console.log(`\n  Kodierung: ${projection.encodingDescription}`)
console.log(`  Linien:    ${projection.capacity.lineCount} (${projection.capacity.level})`)

// ---------------------------------------------------------------- Ausgabe
const csv = projectionToCsv(projection)
console.log('\nCSV (erste drei Zeilen)')
for (const row of csv.split('\n').slice(0, 3)) console.log(`  ${row}`)

console.log(`\n  Zustand serialisiert: ${serialize(store.getSnapshot()).length} Zeichen JSON`)
console.log('\nOhne React, ohne DOM.\n')
