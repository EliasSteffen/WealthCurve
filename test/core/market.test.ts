import { describe, expect, it } from 'vitest'
import { marketFromPrices, normalizeSymbol, parseMarketFile, toMonthlyReturns } from '@/core/market'

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

describe('normalizeSymbol', () => {
  it('räumt auf und schreibt groß', () => {
    expect(normalizeSymbol('  aapl ')).toBe('AAPL')
  })

  it('lässt Indexschreibweisen durch', () => {
    expect(normalizeSymbol('^GDAXI')).toBe('^GDAXI')
  })

  it('weist alles ab, was nicht wie ein Ticker aussieht', () => {
    // Der Wert wandert in eine URL an einen fremden Dienst.
    expect(normalizeSymbol('a/../b')).toBeNull()
    expect(normalizeSymbol('')).toBeNull()
    expect(normalizeSymbol(undefined)).toBeNull()
    expect(normalizeSymbol('X'.repeat(21))).toBeNull()
  })

  it('nimmt den ersten Wert, wenn ein Parameter mehrfach kam', () => {
    expect(normalizeSymbol(['msft', 'aapl'])).toBe('MSFT')
  })
})

const punkte = (kurse: readonly (number | null)[]) =>
  kurse.map((price, i) => ({ date: `2000-${String((i % 12) + 1).padStart(2, '0')}-01`, price }))

describe('marketFromPrices', () => {
  it('baut eine vollständige Reihe', () => {
    const reihe = marketFromPrices(punkte(Array.from({ length: 24 }, (_, i) => 100 + i)), {
      symbol: 'TEST',
      name: 'Test AG',
      currency: 'EUR',
    })
    expect(reihe).not.toBeNull()
    expect(reihe!.symbol).toBe('TEST')
    expect(reihe!.name).toBe('Test AG')
    expect(reihe!.currency).toBe('EUR')
    expect(reihe!.start).toBe('2000-01-01')
    expect(reihe!.monthlyReturns).toHaveLength(23)
  })

  it('lehnt zu kurze Reihen ab', () => {
    // Unter einem Jahr ist keine sinnvolle Aussage möglich.
    expect(marketFromPrices(punkte([100, 101, 102]), { symbol: 'X' })).toBeNull()
  })

  it('fällt beim Namen auf das Symbol zurück', () => {
    const reihe = marketFromPrices(punkte(Array(20).fill(100)), { symbol: 'FALLBACK' })
    expect(reihe!.name).toBe('FALLBACK')
    expect(reihe!.currency).toBe('USD')
  })

  it('nimmt als Start den ersten brauchbaren Kurs, nicht die erste Zeile', () => {
    // Führende Lücken sind keine Historie.
    const reihe = marketFromPrices(punkte([null, null, ...Array(20).fill(100)]), { symbol: 'X' })
    expect(reihe!.start).toBe('2000-03-01')
  })
})

describe('parseMarketFile', () => {
  it('liest CSV mit Komma', () => {
    const zeilen = Array.from({ length: 20 }, (_, i) => `2000-01-01,${100 + i}`).join('\n')
    const reihe = parseMarketFile(`date,close\n${zeilen}`, 'AAPL.csv')
    expect(reihe).not.toBeNull()
    expect(reihe!.symbol).toBe('AAPL')
    expect(reihe!.monthlyReturns).toHaveLength(19)
  })

  it('liest CSV mit Semikolon und deutschem Dezimalkomma', () => {
    // Genau das Format, das die eigene CSV-Ausgabe erzeugt - ein Export soll
    // wieder importierbar sein.
    const zeilen = Array.from({ length: 20 }, (_, i) => `2000-01-01;${100 + i},50`).join('\n')
    const reihe = parseMarketFile(`Datum;Kurs\n${zeilen}`, 'dax.csv')
    expect(reihe).not.toBeNull()
    expect(reihe!.monthlyReturns).toHaveLength(19)
  })

  it('liest eine gespeicherte Serverantwort zurück', () => {
    const antwort = JSON.stringify({
      symbol: 'URTH',
      name: 'MSCI World',
      currency: 'USD',
      start: '2012-01-01',
      monthlyReturns: Array(30).fill(0.005),
    })
    const reihe = parseMarketFile(antwort, 'urth.json')
    expect(reihe!.symbol).toBe('URTH')
    expect(reihe!.name).toBe('MSCI World')
    expect(reihe!.monthlyReturns).toHaveLength(30)
  })

  it('liest ein JSON-Array von Kurspunkten', () => {
    const roh = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({ date: '2000-01-01', close: 100 + i })),
    )
    expect(parseMarketFile(roh, 'x.json')!.monthlyReturns).toHaveLength(19)
  })

  it('gibt null statt einer erfundenen Reihe zurück', () => {
    // Lieber nichts als eine Kurve, die etwas behauptet.
    expect(parseMarketFile('völliger Unsinn', 'x.csv')).toBeNull()
    expect(parseMarketFile('{kaputt', 'x.json')).toBeNull()
    expect(parseMarketFile('date,close\n2000-01-01,100', 'x.csv')).toBeNull()
    expect(parseMarketFile('date,volume\n2000-01-01,100', 'x.csv')).toBeNull()
  })
})
