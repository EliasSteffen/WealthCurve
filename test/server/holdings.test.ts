// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const quote = vi.hoisted(() => vi.fn())

// Die Instanz entsteht beim Laden des Moduls - der Mock muss davor stehen.
vi.mock('yahoo-finance2', () => ({
  default: class {
    quote = quote
  },
}))

const zeile = (over: Record<string, unknown>) => ({
  compositionCharacteristics: {
    date: '2026-11-09',
    type: 'EQUITY_ORDINARY',
    currency: 'USD',
    sector: 'Information Technology',
    countryOfRisk: 'United States',
    ...over,
  },
})

function amundi(zeilen: unknown[]) {
  return new Response(JSON.stringify({ products: [{ composition: { compositionData: zeilen } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchFundHoldings', () => {
  let fetchFundHoldings: typeof import('../../server/holdings.ts').fetchFundHoldings
  let handleHoldingsRequest: typeof import('../../server/holdings.ts').handleHoldingsRequest
  const fetchMock = vi.fn()

  beforeEach(async () => {
    quote.mockReset()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    ;({ fetchFundHoldings, handleHoldingsRequest } = await import('../../server/holdings.ts'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('liefert Positionen mit geschätztem Börsenwert und merkt sie sich', async () => {
    fetchMock.mockResolvedValue(
      amundi([
        zeile({ isin: 'US0378331005', name: 'APPLE INC', bbg: 'AAPL UW', weight: 0.5 }),
        zeile({ isin: 'US0846707026', name: 'BERKSHIRE HATHAWAY INC-CL B', bbg: 'BRK/B UN', weight: 0.25 }),
        zeile({ isin: 'DE0007030009', name: 'RHEINMETALL ORD', bbg: 'RHM GY', weight: 0.24, countryOfRisk: 'Germany', currency: 'EUR', sector: 'Industrials' }),
        zeile({ isin: null, name: null, type: 'CASH', weight: 0.01, sector: null, countryOfRisk: null }),
      ]),
    )
    quote.mockImplementation(async (symbol: string) => ({ marketCap: symbol === 'AAPL' ? 4000e9 : 2000e9 }))

    const ergebnis = await fetchFundHoldings('ie000bi8ot95')
    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.daten.isin).toBe('IE000BI8OT95')
    expect(ergebnis.daten.date).toBe('2026-11-09')
    // Nur US-Notierungen eichen, "BRK/B" wird zu Yahoos "BRK-B".
    expect(quote.mock.calls.map((c) => c[0])).toEqual(['AAPL', 'BRK-B'])
    // Beide Anker ergeben 8000 Mrd. Indexsumme.
    const [apple, , rheinmetall, cash] = ergebnis.daten.positions
    expect(apple.capUsd).toBeCloseTo(4000e9)
    expect(rheinmetall).toMatchObject({ country: 'Germany', sector: 'Industrials', currency: 'EUR' })
    expect(rheinmetall.capUsd).toBeCloseTo(0.24 * 8000e9)
    expect(cash).toMatchObject({ asset: 'cash', capUsd: null, country: '', sector: '' })

    await fetchFundHoldings('IE000BI8OT95')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('bleibt ohne Börsenwerte nutzbar', async () => {
    fetchMock.mockResolvedValue(amundi([zeile({ isin: 'US1', name: 'X', bbg: 'X UW', weight: 1 })]))
    quote.mockRejectedValue(new Error('429'))
    const ergebnis = await fetchFundHoldings('IE000BI8OT95')
    expect(ergebnis.ok && ergebnis.daten.positions[0].capUsd).toBeNull()
  })

  it('meldet ungültige ISINs, leere Fonds und Netzfehler', async () => {
    expect(await handleHoldingsRequest('/?isin=abc')).toMatchObject({ status: 400, cache: false })

    fetchMock.mockResolvedValueOnce(amundi([]))
    expect(await handleHoldingsRequest('/?isin=LU1900066033')).toMatchObject({ status: 404 })

    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect(await handleHoldingsRequest('/?isin=LU1900066033')).toMatchObject({ status: 502 })
  })
})
