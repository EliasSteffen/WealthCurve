import { describe, expect, it } from 'vitest'
import { marketPriceIndex } from '../../../src/core/analytics'
import { depotHistory, type DepotHolding } from '../../../src/core/depot/index'
import type { MarketSeries } from '../../../src/core/domain/types'

const holding = (id: string, symbol: string, weight: number): DepotHolding => ({
  id,
  name: id,
  symbol,
  weight,
  ter: 0,
  leverage: 1,
  kind: 'etf',
  lookThrough: '',
})

const reihe = (symbol: string, returns: number[], start = '2020-01-01', currency = 'EUR'): MarketSeries => ({
  symbol,
  name: symbol,
  currency,
  start,
  monthlyReturns: returns,
})

describe('depotHistory', () => {
  it('gewichtet die Monatsrenditen mit den heutigen Anteilen', () => {
    const a = reihe('A', Array(12).fill(0.02))
    const b = reihe('B', Array(12).fill(-0.01))
    const verlauf = depotHistory(
      [holding('a', 'A', 75), holding('b', 'B', 25)],
      new Map([
        ['A', a],
        ['B', b],
      ]),
      new Map(),
    )!
    expect(verlauf.currency).toBe('EUR')
    expect(verlauf.monthlyReturns).toHaveLength(12)
    for (const r of verlauf.monthlyReturns) expect(r).toBeCloseTo(0.75 * 0.02 + 0.25 * -0.01, 12)
    expect(verlauf.start).toBe('2020-01-01')
    expect(verlauf.months?.[0]).toBe('2020-02')
  })

  it('beginnt erst, wenn jede Position Kurse hat', () => {
    // B startet zwölf Monate später - vorher wäre ein Viertel des Depots unbekannt.
    const a = reihe('A', Array(24).fill(0.01), '2019-01-01')
    const b = reihe('B', Array(12).fill(0.03), '2020-01-01')
    const verlauf = depotHistory(
      [holding('a', 'A', 1), holding('b', 'B', 1)],
      new Map([
        ['A', a],
        ['B', b],
      ]),
      new Map(),
    )!
    expect(verlauf.monthlyReturns).toHaveLength(12)
    expect(verlauf.months?.[0]).toBe('2020-02')
    // Und der Chart kann sie als Kurs darstellen.
    expect(marketPriceIndex(verlauf)!.bars).toHaveLength(12)
  })

  it('rechnet Fremdwährung in Euro um', () => {
    const usd = reihe('U', Array(12).fill(0.1), '2020-01-01', 'USD')
    // Der Euro steigt jeden Monat um 10 % gegen den Dollar: in Euro bleibt nichts übrig.
    const fx = reihe('EURUSD=X', Array(12).fill(0.1))
    const verlauf = depotHistory([holding('u', 'U', 1)], new Map([['U', usd]]), new Map([['EURUSD=X', fx]]))!
    for (const r of verlauf.monthlyReturns) expect(r).toBeCloseTo(0, 12)
  })

  it('liefert nichts ohne Kurse, ohne Anteile oder unter einem Jahr', () => {
    const a = reihe('A', Array(12).fill(0.01))
    expect(depotHistory([holding('a', 'A', 1), holding('b', '', 1)], new Map([['A', a]]), new Map())).toBeNull()
    expect(depotHistory([holding('a', 'A', 0)], new Map([['A', a]]), new Map())).toBeNull()
    expect(depotHistory([holding('a', 'A', 1)], new Map([['A', reihe('A', Array(6).fill(0.01))]]), new Map())).toBeNull()
    expect(depotHistory([], new Map(), new Map())).toBeNull()
  })
})
