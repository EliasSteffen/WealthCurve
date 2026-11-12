// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const quote = vi.hoisted(() => vi.fn())
const quoteSummary = vi.hoisted(() => vi.fn())

// Die Instanz entsteht beim Laden des Moduls - der Mock muss davor stehen.
vi.mock('yahoo-finance2', () => ({
  default: class {
    quote = quote
    quoteSummary = quoteSummary
  },
}))

const profile = (country: string, sector: string, currency: string, marketCap: number, longName: string) => ({
  assetProfile: { country, sector },
  price: { currency, marketCap, longName },
})

describe('fetchProfiles', () => {
  let fetchProfiles: typeof import('../../server/profile.ts').fetchProfiles
  let handleProfileRequest: typeof import('../../server/profile.ts').handleProfileRequest

  beforeEach(async () => {
    quote.mockReset()
    quoteSummary.mockReset()
    vi.resetModules()
    ;({ fetchProfiles, handleProfileRequest } = await import('../../server/profile.ts'))
  })

  it('übersetzt Yahoo-Branchen in GICS und rechnet den Börsenwert in Dollar um', async () => {
    quoteSummary.mockImplementation(async (symbol: string) => {
      if (symbol === 'NVD.DE') return profile('United States', 'Technology', 'EUR', 4e12, 'NVIDIA Corporation')
      if (symbol === 'RR.L') return profile('United Kingdom', 'Industrials', 'GBp', 6e12, 'Rolls-Royce Holdings plc')
      if (symbol === 'AMZN') return profile('United States', 'Consumer Cyclical', 'USD', 2e12, 'Amazon.com, Inc.')
      throw new Error('Not Found')
    })
    quote.mockResolvedValue([
      { symbol: 'EURUSD=X', regularMarketPrice: 1.1 },
      { symbol: 'GBPUSD=X', regularMarketPrice: 1.3 },
    ])

    const ergebnis = await fetchProfiles('nvd.de,RR.L,AMZN,GIBTS.NICHT')
    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.daten.map((p) => [p.symbol, p.country, p.sector, p.currency])).toEqual([
      ['NVD.DE', 'United States', 'Information Technology', 'EUR'],
      ['RR.L', 'United Kingdom', 'Industrials', 'GBP'],
      ['AMZN', 'United States', 'Consumer Discretionary', 'USD'],
    ])
    expect(ergebnis.daten[0].capUsd).toBeCloseTo(4.4e12)
    // Pence: 6 Billionen GBp sind 60 Mrd. GBP.
    expect(ergebnis.daten[1].capUsd).toBeCloseTo(78e9)
    expect(ergebnis.daten[2].capUsd).toBe(2e12)
    expect(quote.mock.calls[0][0].sort()).toEqual(['EURUSD=X', 'GBPUSD=X'])

    // Zweiter Abruf aus dem Speicher.
    await fetchProfiles(['NVD.DE'])
    expect(quoteSummary.mock.calls.filter(([s]) => s === 'NVD.DE')).toHaveLength(1)
  })

  it('behält Land und Branche, wenn die Devisenkurse fehlen', async () => {
    quoteSummary.mockResolvedValue(profile('Germany', 'Industrials', 'EUR', 9e10, 'Rheinmetall AG'))
    quote.mockRejectedValue(new Error('429'))
    const ergebnis = await fetchProfiles('RHM.DE')
    expect(ergebnis.ok && ergebnis.daten[0]).toMatchObject({ country: 'Germany', sector: 'Industrials', capUsd: null })
  })

  it('lehnt Anfragen ohne gültiges Symbol ab', async () => {
    const antwort = await handleProfileRequest('/api/profile?symbols=%3Cscript%3E')
    expect(antwort).toMatchObject({ status: 400, cache: false })
  })
})
