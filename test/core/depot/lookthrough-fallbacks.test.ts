import { describe, expect, it } from 'vitest'
import {
  computeLookThrough,
  holdingFixes,
  issuerKey,
  kindFromName,
  leverageFromName,
  lookThroughIsins,
  matchIndex,
  parseDepotText,
  withResolvedSymbols,
  WORLD_PROXY,
  type DepotHolding,
  type FundHoldings,
  type StockProfile,
} from '../../../src/core/depot/index'

const holding = (over: Partial<DepotHolding> & { id: string }): DepotHolding => ({
  name: over.id,
  symbol: '',
  weight: 0,
  ter: 0,
  leverage: 1,
  kind: 'etf',
  lookThrough: '',
  ...over,
})

const value = (list: readonly { key: string; value: number }[], key: string) =>
  list.find((s) => s.key === key)?.value ?? 0

describe('Name -> Typ und Hebel', () => {
  it('erkennt Rohstoff-Produkte, aber keine Rohstoff-Aktien', () => {
    expect(kindFromName('WisdomTree Silver 3x Daily Leveraged')).toBe('etc')
    expect(kindFromName('Xetra-Gold')).toBe('etc')
    expect(kindFromName('iShares Physical Gold ETC')).toBe('etc')
    expect(kindFromName('Barrick Gold Corp')).toBeNull()
    expect(kindFromName('iShares Gold Producers UCITS ETF')).toBe('etf')
    expect(kindFromName('Apple Inc.')).toBeNull()
  })

  it('liest den Hebel nur, wo der Name ihn meint', () => {
    expect(leverageFromName('WisdomTree Silver 3x Daily Leveraged')).toBe(3)
    expect(leverageFromName('Xtrackers S&P 500 2x Leveraged Daily Swap UCITS ETF 1C')).toBe(2)
    expect(leverageFromName('Xtrackers MSCI World UCITS ETF 1C')).toBeNull()
    expect(leverageFromName('WisdomTree NASDAQ 100 3x Daily Short')).toBeNull()
  })

  it('setzt den Hebel beim Import aus dem Namen, wenn die Spalte fehlt', () => {
    const { holdings } = parseDepotText(
      'ISIN\tName\tAnteil\nIE00BLRPRL42\tWisdomTree Silver 3x Daily Leveraged\t50%\nLU0411078552\tXtrackers S&P 500 2x Leveraged Daily Swap UCITS ETF\t50%',
    )
    expect(holdings.map((h) => [h.kind, h.leverage, h.lookThrough])).toEqual([
      ['etc', 3, 'Silver'],
      ['etf', 2, 'LU0411078552'],
    ])
  })

  it('ordnet nach der Symbolsuche Typ und Hebel neu, wenn der Import keinen Namen kannte', () => {
    // Broker-Export mit WKN und TER: ohne Namen wird aus der TER "ETF" oder "Aktie" geraten.
    const { holdings } = parseDepotText('WKN\tWert\tTER\nA2PJ2C\t500\t0,98\n918422\t300\t0\nA0RPWH\t200\t0')
    expect(holdings.map((h) => h.kind)).toEqual(['etf', 'stock', 'stock'])
    const gefunden = new Map([
      ['A2PJ2C', { symbol: 'LSIL.DE', name: 'WisdomTree Silver 3x Daily Leveraged', type: null }],
      ['918422', { symbol: 'NVD.DE', name: 'NVIDIA Corporation', type: 'stock' as const }],
      ['A0RPWH', { symbol: 'EUNL.DE', name: 'iShares Core MSCI World UCITS ETF', type: 'etf' as const }],
    ])
    const neu = withResolvedSymbols(holdings, gefunden)
    expect(neu.map((h) => [h.kind, h.leverage, h.symbol])).toEqual([
      ['etc', 3, 'LSIL.DE'],
      ['stock', 1, 'NVD.DE'],
      ['etf', 1, 'EUNL.DE'],
    ])
  })

  it('schlägt Korrekturen für schon gespeicherte Depots vor', () => {
    const fixes = holdingFixes([
      holding({ id: 'A', name: 'WisdomTree Gold 3x Daily Leveraged', kind: 'etf' }),
      holding({ id: 'B', name: 'Xtrackers S&P 500 2x Leveraged Daily Swap', kind: 'etf' }),
      holding({ id: 'C', name: 'Vanguard FTSE All-World', kind: 'etf' }),
    ])
    expect(fixes).toEqual([
      { id: 'A', patch: { kind: 'etc', lookThrough: 'Gold', leverage: 3 } },
      { id: 'B', patch: { leverage: 2 } },
    ])
  })
})

describe('Index aus dem Fondsnamen', () => {
  it.each([
    ['Xtrackers S&P 500 2x Leveraged Daily Swap UCITS ETF 1C', 'sp500', null],
    ['Vanguard FTSE Developed Europe UCITS ETF EUR Accumulation', 'europe', null],
    ['Amundi MSCI Semiconductors ESG Screened UCITS ETF', 'semis', 'Information Technology'],
    ['Vanguard FTSE All-World UCITS ETF', 'acwi', null],
    ['Xtrackers MSCI Emerging Markets UCITS ETF', 'em', null],
    ['iShares MSCI World Health Care Sector', 'world', 'Health Care'],
    ['iShares Core EURO STOXX 50', 'emu', null],
    ['iShares Core DAX', 'germany', null],
    ['iShares Core Euro Government Bond', 'bonds', null],
    ['Xtrackers II EUR Overnight Rate Swap', 'moneyMarket', null],
    ['WisdomTree Silver 3x Daily Leveraged', 'commodities', null],
  ])('%s -> %s', (name, index, sector) => {
    const match = matchIndex(name)
    expect(match?.template?.id).toBe(index)
    expect(match?.sector ?? null).toBe(sector)
  })

  it('erkennt Nebenwerte und nichts in einer bloßen Kennung', () => {
    expect(matchIndex('iShares MSCI World Small Cap')?.size).toBe('small')
    expect(matchIndex('ETF146')).toBeNull()
  })
})

describe('Durchschau ohne eigenen Fondsbestand', () => {
  const welt: FundHoldings = {
    isin: WORLD_PROXY,
    date: '2026-11-09',
    positions: [
      { isin: 'US67066G1040', name: 'NVIDIA CORP', asset: 'equity', sector: 'Information Technology', country: 'United States', currency: 'USD', weight: 0.6, capUsd: 4e12 },
      { isin: 'DE0007030033', name: 'RHEINMETALL AG', asset: 'equity', sector: 'Industrials', country: 'Germany', currency: 'EUR', weight: 0.3, capUsd: 90e9 },
      { isin: 'JP0000000001', name: 'TOYOTA MOTOR CORP', asset: 'equity', sector: 'Consumer Discretionary', country: 'Japan', currency: 'JPY', weight: 0.1, capUsd: 250e9 },
    ],
  }

  it('lädt für Indexfonds den Bestand des Stellvertreters mit', () => {
    const isins = lookThroughIsins([
      holding({ id: 'SP', name: 'Xtrackers S&P 500 Swap', lookThrough: 'LU0490618542' }),
      holding({ id: 'EM', name: 'Xtrackers MSCI Emerging Markets' }),
      holding({ id: 'TEC', name: 'Xtrackers MSCI World Information Technology' }),
    ])
    // Der S&P-500-Fonds braucht seinen eigenen Bestand und den Welt-Stellvertreter;
    // Schwellenländer haben keinen, Branchenfonds bekommen keinen.
    expect(isins).toEqual([WORLD_PROXY, 'LU0490618542'].sort())
  })

  it('nimmt den US-Teil des Welt-Fonds für einen S&P-500-ETF und zählt den Hebel', () => {
    const look = computeLookThrough(
      [holding({ id: 'SP2', name: 'Xtrackers S&P 500 2x Leveraged', weight: 1, leverage: 2 })],
      new Map([[WORLD_PROXY, welt]]),
    )
    expect(look.sources.SP2).toEqual({ kind: 'proxy', index: 'sp500', isin: WORLD_PROXY, date: '2026-11-09' })
    expect(look.estimated).toEqual(['SP2'])
    expect(look.missing).toEqual([])
    expect(value(look.countries, 'US')).toBeCloseTo(2)
    expect(look.companies[0]).toMatchObject({ name: 'Nvidia Corp', exposure: 2 })
  })

  it('schätzt aus Indexgewichten, wenn kein Bestand lädt - ohne erfundene Firmen', () => {
    const look = computeLookThrough(
      [
        holding({ id: 'EU', name: 'Vanguard FTSE Developed Europe', weight: 0.5 }),
        holding({ id: 'EM', name: 'iShares Core MSCI EM IMI', weight: 0.3 }),
        holding({ id: 'GOV', name: 'iShares Core Euro Government Bond', weight: 0.2 }),
      ],
      new Map(),
    )
    expect(look.sources.EU).toEqual({ kind: 'index', index: 'europe', sector: null })
    expect(value(look.continents, 'europe')).toBeGreaterThan(0.5)
    expect(value(look.markets, 'emerging')).toBeCloseTo(0.3)
    expect(value(look.assets, 'bond')).toBeCloseTo(0.2)
    expect(value(look.currencies, 'EUR')).toBeGreaterThan(0.2)
    expect(look.companies).toEqual([])
    expect(look.missing).toEqual([])
  })

  it('kennt Einzelaktien über Firmenprofil, Fondsdaten oder ISIN-Präfix', () => {
    const profile: StockProfile = {
      symbol: 'NVD.DE',
      name: 'NVIDIA Corporation',
      country: 'United States',
      sector: 'Information Technology',
      currency: 'EUR',
      capUsd: 4.2e12,
    }
    const holdings = [
      holding({ id: '918422', name: 'NVIDIA Corporation', symbol: 'NVD.DE', kind: 'stock', weight: 0.4 }),
      holding({ id: 'DE0007030033', name: 'Rheinmetall', kind: 'stock', weight: 0.3 }),
      holding({ id: 'CH0012005267', name: 'Novartis', kind: 'stock', weight: 0.3 }),
    ]

    const ohneFonds = computeLookThrough(holdings, new Map(), new Map([['NVD.DE', profile]]))
    expect(ohneFonds.sources).toEqual({
      '918422': { kind: 'profile' },
      DE0007030033: { kind: 'isin', country: 'Germany' },
      CH0012005267: { kind: 'isin', country: 'Switzerland' },
    })
    expect(ohneFonds.missing).toEqual([])
    expect(value(ohneFonds.countries, 'US')).toBeCloseTo(0.4)
    expect(value(ohneFonds.countries, 'DE')).toBeCloseTo(0.3)
    expect(value(ohneFonds.sectors, 'it')).toBeCloseTo(0.4)
    expect(value(ohneFonds.sizes, 'mega')).toBeCloseTo(0.4)
    // In Euro gekauft, trotzdem ein Dollar-Risiko.
    expect(value(ohneFonds.currencies, 'USD')).toBeCloseTo(0.4)

    // Mit Fondsbestand: dieselbe Firma unter anderem Namen wird erkannt - auch als doppelt gehalten.
    const mitFonds = computeLookThrough(
      [...holdings, holding({ id: 'W', name: 'MSCI World', weight: 1, lookThrough: WORLD_PROXY })],
      new Map([[WORLD_PROXY, welt]]),
      new Map([['NVD.DE', profile]]),
    )
    expect(mitFonds.sources['918422']).toEqual({ kind: 'stockFund' })
    const nvidia = mitFonds.companies.find((c) => c.via.includes('918422'))
    expect(nvidia?.via).toEqual(['918422', 'W'])
  })

  it('führt Rechtsformen auf denselben Firmenschlüssel zurück', () => {
    expect(issuerKey('NVIDIA Corporation')).toBe(issuerKey('NVIDIA CORP'))
    expect(issuerKey('Alphabet Inc.')).toBe(issuerKey('ALPHABET INC CL A'))
    expect(issuerKey('ASML Holding N.V.')).toBe(issuerKey('ASML HOLDING NV'))
    expect(issuerKey('Taiwan Semiconductor Manufacturing Company Limited')).toBe(
      issuerKey('TAIWAN SEMICONDUCTOR MANUFACTURING CO LTD'),
    )
  })

  it('lässt "Keine" als ausdrücklich unbekannt stehen und nimmt gewählte Indexgewichte', () => {
    const look = computeLookThrough(
      [
        holding({ id: 'A', name: 'MSCI World', weight: 0.5, lookThrough: '-' }),
        holding({ id: 'B', name: 'ETF146', weight: 0.5, lookThrough: 'idx:em' }),
      ],
      new Map(),
    )
    expect(look.missing).toEqual(['A'])
    expect(look.sources.B).toEqual({ kind: 'index', index: 'em', sector: null })
    expect(value(look.markets, 'emerging')).toBeCloseTo(0.5)
  })
})
