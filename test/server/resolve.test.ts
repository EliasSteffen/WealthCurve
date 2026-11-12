// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { productId, withResolvedSymbols } from '../../src/core/depot/parse'
import type { DepotHolding } from '../../src/core/depot/types'

const quote = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => vi.fn())

vi.mock('yahoo-finance2', () => ({
  default: class {
    quote = quote
    search = search
  },
}))

const figi = (eintraege: unknown[]) =>
  new Response(JSON.stringify(eintraege), { status: 200, headers: { 'content-type': 'application/json' } })

describe('resolveIds', () => {
  let resolveIds: typeof import('../../server/resolve.ts').resolveIds
  let handleResolveRequest: typeof import('../../server/resolve.ts').handleResolveRequest
  const fetchMock = vi.fn()

  beforeEach(async () => {
    quote.mockReset()
    search.mockReset()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    ;({ resolveIds, handleResolveRequest } = await import('../../server/resolve.ts'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('wählt die Euro-Notierung, die Yahoo kennt, und merkt sie sich', async () => {
    fetchMock.mockResolvedValue(
      figi([
        // Frankfurt genannt, Xetra nicht - Xetra wird trotzdem zuerst probiert.
        { data: [{ ticker: 'IWDA', exchCode: 'NA' }, { ticker: 'EUNL', exchCode: 'GF' }, { ticker: 'SWDA', exchCode: 'LN' }] },
        { data: [{ ticker: 'AAPL', exchCode: 'US' }, { ticker: 'APC', exchCode: 'GY' }] },
      ]),
    )
    quote.mockImplementation(async (symbole: string[]) =>
      symbole
        .filter((s) => ['EUNL.DE', 'APC.DE', 'AAPL'].includes(s))
        .map((s) => ({
          symbol: s,
          regularMarketPrice: 100,
          longName: `Name ${s}`,
          currency: 'EUR',
          quoteType: s === 'EUNL.DE' ? 'ETF' : 'EQUITY',
        })),
    )

    const ergebnis = await resolveIds('ie00b4l5y983,865985')
    expect(ergebnis.ok && ergebnis.daten.map((d) => [d.id, d.symbol, d.type])).toEqual([
      ['IE00B4L5Y983', 'EUNL.DE', 'etf'],
      ['865985', 'APC.DE', 'stock'],
    ])
    // Je Kennung nur die besten Kandidaten, in Vorrang-Reihenfolge.
    expect(quote.mock.calls[0][0]).toEqual(['EUNL.DE', 'EUNL.F', 'IWDA.AS', 'SWDA.L', 'APC.DE', 'AAPL'])

    await resolveIds(['865985'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fragt die Yahoo-Suche, wenn OpenFIGI eine ISIN nicht kennt', async () => {
    fetchMock.mockResolvedValue(figi([{ warning: 'No identifier found.' }, { warning: 'No identifier found.' }]))
    search.mockResolvedValue({ quotes: [{ symbol: 'WRDU.AS', isYahooFinance: true }, { name: 'News' }] })
    quote.mockResolvedValue([{ symbol: 'WRDU.AS', regularMarketPrice: 9, shortName: 'World', currency: 'EUR' }])

    const ergebnis = await resolveIds('IE000BI8OT95,ETF146')
    expect(ergebnis.ok && ergebnis.daten).toEqual([
      { id: 'IE000BI8OT95', symbol: 'WRDU.AS', name: 'World', currency: 'EUR', type: null },
      // Eine WKN lässt sich bei Yahoo nicht suchen.
      { id: 'ETF146', symbol: null, name: null, currency: null, type: null },
    ])
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('übersteht Ausfälle beider Dienste und lehnt Unsinn ab', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    search.mockRejectedValue(new Error('429'))
    quote.mockRejectedValue(new Error('429'))
    expect(await handleResolveRequest('/?ids=US0378331005')).toMatchObject({
      status: 200,
      body: { results: [{ id: 'US0378331005', symbol: null }] },
    })
    expect(await handleResolveRequest('/?ids=<script>')).toMatchObject({ status: 400, cache: false })
  })
})

describe('Symbole ins Depot eintragen', () => {
  const h = (over: Partial<DepotHolding> & { id: string }): DepotHolding => ({
    name: over.id,
    symbol: '',
    weight: 0.5,
    ter: 0,
    leverage: 1,
    kind: 'etf',
    lookThrough: '',
    ...over,
  })

  it('nimmt die Kennung des Produkts, nie einen Stellvertreter-Fonds', () => {
    expect(productId(h({ id: '865985' }))).toBe('865985')
    expect(productId(h({ id: 'MEINE-POS', lookThrough: 'IE000BI8OT95' }))).toBe('IE000BI8OT95')
    expect(productId(h({ id: 'MEINE-POS', lookThrough: 'IE000BI8OT95:US' }))).toBeNull()
  })

  it('füllt nur fehlende Symbole und ersetzt nur Namen, die bloß die Kennung waren', () => {
    const found = new Map([
      ['865985', { symbol: 'APC.DE', name: 'Apple Inc.' }],
      ['A1B2C3', { symbol: 'XXX.DE', name: 'Anders' }],
    ])
    const neu = withResolvedSymbols(
      [h({ id: '865985' }), h({ id: 'A1B2C3', name: 'Mein Name', symbol: 'EIGEN.DE' })],
      found,
    )
    expect(neu.map((x) => [x.symbol, x.name])).toEqual([
      ['APC.DE', 'Apple Inc.'],
      ['EIGEN.DE', 'Mein Name'],
    ])
  })
})
