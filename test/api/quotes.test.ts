import { describe, expect, it } from 'vitest'
import { normalise, toMonthlyReturns } from '../../api/quotes'

describe('toMonthlyReturns', () => {
  it('rechnet Kurse in Renditen um', () => {
    // 100 -> 110 -> 99 sind +10 % und -10 %.
    // Fliesskomma: 110/100-1 ist nicht exakt 0.1, deshalb toBeCloseTo.
    const renditen = toMonthlyReturns([100, 110, 99])
    expect(renditen).toHaveLength(2)
    expect(renditen[0]).toBeCloseTo(0.1, 10)
    expect(renditen[1]).toBeCloseTo(-0.1, 10)
  })

  it('liefert bei einem einzelnen Kurs nichts', () => {
    expect(toMonthlyReturns([100])).toEqual([])
  })

  it('überspringt Lücken, statt sie als Absturz zu werten', () => {
    // Yahoo liefert null für Monate ohne Handel. Als 0 gelesen ergäbe das
    // eine Rendite von -100 % und danach eine unbrauchbare Kurve.
    const renditen = toMonthlyReturns([100, null, 121])
    expect(renditen).toHaveLength(1)
    expect(renditen[0]).toBeCloseTo(0.21, 10)
  })

  it('ignoriert unbrauchbare Werte', () => {
    expect(toMonthlyReturns([100, 0, -5, NaN, 200])).toEqual([1])
  })
})

describe('normalise', () => {
  const antwort = (kurse: (number | null)[]) => ({
    chart: {
      result: [
        {
          meta: { symbol: 'TEST', longName: 'Test AG', currency: 'EUR' },
          timestamp: [946684800],
          indicators: { adjclose: [{ adjclose: kurse }] },
        },
      ],
    },
  })

  it('normalisiert eine vollständige Antwort', () => {
    const daten = normalise(antwort(Array.from({ length: 24 }, (_, i) => 100 + i)), 'X')
    expect(daten).not.toBeNull()
    expect(daten!.symbol).toBe('TEST')
    expect(daten!.name).toBe('Test AG')
    expect(daten!.currency).toBe('EUR')
    expect(daten!.start).toBe('2000-01-01')
    expect(daten!.monthlyReturns).toHaveLength(23)
  })

  it('lehnt zu kurze Reihen ab', () => {
    // Unter einem Jahr ist keine sinnvolle Aussage möglich.
    expect(normalise(antwort([100, 101, 102]), 'X')).toBeNull()
  })

  it('lehnt eine leere Antwort ab', () => {
    expect(normalise({}, 'X')).toBeNull()
    expect(normalise({ chart: { result: [] } }, 'X')).toBeNull()
  })

  it('fällt auf das angefragte Symbol zurück', () => {
    const ohneMeta = {
      chart: {
        result: [{ indicators: { adjclose: [{ adjclose: Array(20).fill(100) }] } }],
      },
    }
    expect(normalise(ohneMeta, 'FALLBACK')!.symbol).toBe('FALLBACK')
  })
})
