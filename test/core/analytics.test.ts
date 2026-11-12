import { describe, expect, it } from 'vitest'
import {
  marketPriceIndex,
  marketStats,
  monthKeyToUtc,
  monthToUtc,
  monthsBetween,
  scenarioFigures,
  timeAnchor,
  yearIndexTime,
  yearOverYear,
} from '@/core/analytics'
import { DEFAULT_MODEL } from '@/core/domain/math'
import type { MarketSeries } from '@/core/domain/types'
import { buildProjection } from '@/core/projection'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'

const markt = (monthlyReturns: number[], extra: Partial<MarketSeries> = {}): MarketSeries => ({
  symbol: 'TEST',
  name: 'Test',
  currency: 'USD',
  start: '2020-01-01',
  monthlyReturns,
  ...extra,
})

const iso = (sekunden: number) => new Date(sekunden * 1000).toISOString().slice(0, 10)

describe('Zeitachse in Kalenderdaten', () => {
  it('hängt Jahr 0 an Startjahr und -monat', () => {
    const anker = timeAnchor({ ...DEFAULT_MODEL, startYear: 2010, startMonth: 4 })
    expect(anker).toEqual({ year: 2010, month: 4 })
    expect(iso(yearIndexTime(anker, 0))).toBe('2010-04-01')
    expect(iso(yearIndexTime(anker, 25))).toBe('2035-04-01')
  })

  it('beginnt ohne Startjahr heute', () => {
    const anker = timeAnchor({ ...DEFAULT_MODEL, startYear: null }, new Date(Date.UTC(2026, 10, 12)))
    expect(anker).toEqual({ year: 2026, month: 11 })
  })

  it('liest Monatsschlüssel mit und ohne Tag, verwirft Unsinn', () => {
    expect(monthKeyToUtc('2020-03')).toBe(monthToUtc(2020, 3))
    expect(monthKeyToUtc('2020-03-17')).toBe(monthToUtc(2020, 3))
    expect(monthKeyToUtc('2020-13')).toBeNull()
    expect(monthKeyToUtc('unbekannt')).toBeNull()
  })

  it('zählt Monate über Jahresgrenzen', () => {
    expect(monthsBetween(monthToUtc(2019, 11), monthToUtc(2021, 2))).toBe(15)
  })
})

describe('Kursindex', () => {
  it('verkettet Renditen ab 100 und öffnet beim Vormonatsschluss', () => {
    const index = marketPriceIndex(markt([0.1, -0.5, 1]))!
    expect(index.startTime).toBe(monthToUtc(2020, 1))
    expect(index.bars.map((b) => iso(b.time))).toEqual(['2020-02-01', '2020-03-01', '2020-04-01'])
    expect(index.bars.map((b) => b.close)).toEqual([110, 55, 110].map((x) => expect.closeTo(x, 10)))
    expect(index.bars[1].open).toBeCloseTo(110, 10)
    expect(index.bars.map((b) => b.drawdown)).toEqual([0, -0.5, 0].map((x) => expect.closeTo(x, 10)))
  })

  it('nimmt die Monate der Reihe, wenn sie aufsteigen - auch über eine Lücke', () => {
    const index = marketPriceIndex(markt([0.01, 0.02], { months: ['2020-02', '2020-05'] }))!
    expect(index.bars.map((b) => iso(b.time))).toEqual(['2020-02-01', '2020-05-01'])
  })

  it('zählt ab Start, wenn die Monate nicht aufsteigen', () => {
    const index = marketPriceIndex(markt([0.01, 0.02], { months: ['2020-03', '2020-02'] }))!
    expect(index.bars.map((b) => iso(b.time))).toEqual(['2020-02-01', '2020-03-01'])
  })

  it('zählt über den Jahreswechsel', () => {
    const index = marketPriceIndex(markt([0, 0], { start: '2019-12-01' }))!
    expect(index.bars.map((b) => iso(b.time))).toEqual(['2020-01-01', '2020-02-01'])
  })

  it('liefert nichts ohne lesbaren Start oder bei Totalverlust', () => {
    expect(marketPriceIndex(markt([0.1], { start: 'unbekannt' }))).toBeNull()
    expect(marketPriceIndex(markt([0.1, -1]))).toBeNull()
    expect(marketPriceIndex(markt([]))).toBeNull()
  })
})

describe('Kurs-Kennzahlen', () => {
  it('findet Rückgang, Hoch, Tief und Erholung', () => {
    const stats = marketStats(marketPriceIndex(markt([0.1, -0.5, 1]))!)!
    expect(stats.months).toBe(3)
    expect(stats.totalReturn).toBeCloseTo(0.1, 10)
    expect(stats.maxDrawdown).toBeCloseTo(-0.5, 10)
    expect(iso(stats.drawdownPeak)).toBe('2020-02-01')
    expect(iso(stats.drawdownTrough)).toBe('2020-03-01')
    expect(iso(stats.recoveredAt!)).toBe('2020-04-01')
    expect(stats.bestMonth.change).toBe(1)
    expect(stats.worstMonth.change).toBe(-0.5)
    expect(stats.positiveShare).toBeCloseTo(2 / 3, 10)
  })

  it('rechnet die Jahresrendite über die Kalenderspanne', () => {
    // Zwölf Monate mit je 1 %: genau ein Jahr, also 1,01^12 - 1.
    const stats = marketStats(marketPriceIndex(markt(Array(12).fill(0.01)))!)!
    expect(stats.cagr).toBeCloseTo(1.01 ** 12 - 1, 10)
    expect(stats.volatility).toBeCloseTo(0, 12)
    expect(stats.maxDrawdown).toBe(0)
    expect(stats.recoveredAt).toBeNull()
  })

  it('meldet einen Rückgang ohne Erholung als offen', () => {
    const stats = marketStats(marketPriceIndex(markt([0.2, -0.1, 0.05]))!)!
    expect(stats.maxDrawdown).toBeCloseTo(-0.1, 10)
    expect(stats.recoveredAt).toBeNull()
  })

  it('annualisiert die Schwankung mit √12', () => {
    const r = [0.02, -0.02, 0.02, -0.02]
    const stats = marketStats(marketPriceIndex(markt(r))!)!
    const sd = Math.sqrt(r.reduce((s, x) => s + x ** 2, 0) / (r.length - 1))
    expect(stats.volatility).toBeCloseTo(sd * Math.sqrt(12), 10)
  })
})

describe('Szenario-Kennzahlen', () => {
  const projektion = buildProjection({
    scenarios: [{ id: 'a', label: 'A', colorSlot: 1, params: { ...DEFAULT_PARAMS, initialCapital: 1000 } }],
    seriesIds: ['compound'],
    model: { ...DEFAULT_MODEL, accumulationYears: 20, withdrawalYears: 0 },
  })
  const zahlen = scenarioFigures(projektion.summaries[0], projektion.rows.length - 1)

  it('setzt Ertrag, Vervielfachung und Kaufkraft aus dem Endstand zusammen', () => {
    const { balance, contributions } = projektion.summaries[0].final
    expect(zahlen.finalValue).toBe(balance)
    expect(zahlen.gain).toBeCloseTo(balance - contributions, 6)
    expect(zahlen.multiple).toBeCloseTo(balance / contributions, 10)
    expect(zahlen.realFinalValue).toBeCloseTo(balance / 1.02 ** 20, 6)
    expect(zahlen.years).toBe(20)
  })

  it('nennt die Verdopplungszeit des festen Zinses', () => {
    expect(zahlen.doublingYears).toBeCloseTo(Math.log(2) / Math.log(1.07), 10)
  })

  it('hat ohne Wachstum und ohne Einzahlung keine Kennzahl, statt durch null zu teilen', () => {
    const leer = buildProjection({
      scenarios: [
        {
          id: 'b',
          label: 'B',
          colorSlot: 1,
          params: { ...DEFAULT_PARAMS, annualRate: 0, initialCapital: 0, monthlyContribution: 0 },
        },
      ],
      seriesIds: ['compound'],
      model: { ...DEFAULT_MODEL, accumulationYears: 5, withdrawalYears: 0 },
    })
    const z = scenarioFigures(leer.summaries[0], 5)
    expect(z.doublingYears).toBeNull()
    expect(z.multiple).toBeNull()
    expect(z.gainRatio).toBeNull()
  })
})

describe('Veränderung zum Vorjahr', () => {
  it('lässt Lücken Lücken sein', () => {
    expect(yearOverYear([100, 150, null, 120, 100])).toEqual([null, 50, null, null, -20])
  })
})
