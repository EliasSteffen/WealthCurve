// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const chart = vi.hoisted(() => vi.fn())

// Die Instanz entsteht beim Laden des Moduls - der Mock muss davor stehen.
vi.mock('yahoo-finance2', () => ({
  default: class {
    chart = chart
  },
}))

/** Genug Monate, damit marketFromPrices eine Reihe liefert. */
function antwort(symbol = 'AAA') {
  const quotes = Array.from({ length: 60 }, (_, i) => ({
    date: new Date(Date.UTC(2020 + Math.floor(i / 12), i % 12, 1)),
    close: 100 + i,
    adjclose: 100 + i,
  }))
  return { quotes, meta: { symbol, currency: 'USD', longName: symbol } }
}

describe('fetchQuotes-Cache', () => {
  let fetchQuotes: typeof import('../../server/quotes.ts').fetchQuotes

  beforeEach(async () => {
    vi.useFakeTimers()
    chart.mockReset()
    // Frisches Modul pro Test, damit der Cache leer startet.
    vi.resetModules()
    ;({ fetchQuotes } = await import('../../server/quotes.ts'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('beantwortet den zweiten Aufruf aus dem Cache', async () => {
    chart.mockResolvedValue(antwort())
    const a = await fetchQuotes('aaa')
    const b = await fetchQuotes(' AAA ')
    expect(a.ok && b.ok).toBe(true)
    expect(chart).toHaveBeenCalledTimes(1)
  })

  it('teilt parallele Aufrufe auf dasselbe Symbol', async () => {
    chart.mockResolvedValue(antwort())
    const [a, b] = await Promise.all([fetchQuotes('AAA'), fetchQuotes('aaa')])
    expect(a).toEqual(b)
    expect(chart).toHaveBeenCalledTimes(1)
  })

  it('cached Fehler nicht', async () => {
    chart.mockRejectedValueOnce(new Error('429 Too Many Requests'))
    const fehler = await fetchQuotes('AAA')
    expect(fehler.ok).toBe(false)
    chart.mockResolvedValueOnce(antwort())
    const erfolg = await fetchQuotes('AAA')
    expect(erfolg.ok).toBe(true)
    expect(chart).toHaveBeenCalledTimes(2)
  })

  it('ruft nach Ablauf der TTL erneut ab', async () => {
    chart.mockResolvedValue(antwort())
    await fetchQuotes('AAA')
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1000)
    await fetchQuotes('AAA')
    expect(chart).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    await fetchQuotes('AAA')
    expect(chart).toHaveBeenCalledTimes(2)
  })

  it('hält höchstens 200 Symbole und verdrängt das älteste', async () => {
    chart.mockImplementation((s: string) => Promise.resolve(antwort(s)))
    for (let i = 0; i < 201; i++) await fetchQuotes(`S${i}`)
    expect(chart).toHaveBeenCalledTimes(201)
    await fetchQuotes('S200')
    expect(chart).toHaveBeenCalledTimes(201)
    await fetchQuotes('S0')
    expect(chart).toHaveBeenCalledTimes(202)
  })
})
