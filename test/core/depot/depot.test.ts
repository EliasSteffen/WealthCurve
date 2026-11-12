import { describe, expect, it } from 'vitest'
import {
  computeDepotStats,
  computeLookThrough,
  depotFlags,
  isWindowStats,
  issuerName,
  parseDepotText,
  sanitizeDepot,
  scenarioRate,
  serializeDepot,
  withWeights,
  type DepotHolding,
  type FundHoldings,
} from '../../../src/core/depot/index'
import type { MarketSeries } from '../../../src/core/domain/types'
import { marketFromPrices } from '../../../src/core/market'
import { actions, createInitialState, deserialize, reducer, serialize } from '../../../src/core/state'

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

const series = (symbol: string, returns: number[], currency = 'EUR', start = '2020-01-01'): MarketSeries => ({
  symbol,
  name: symbol,
  currency,
  start,
  monthlyReturns: returns,
})

describe('parseDepotText', () => {
  it('liest aus Excel kopierte Zeilen mit deutschen Prozentzahlen und Summenzeile', () => {
    const text = [
      'Depot',
      'WKN\tAnteil\tTER\tSymbol\tHebel\tTyp\tDurchschau',
      'AAA111\t60,5%\t0,12%\tAAA.DE\t1\tETF\tIE0000000001',
      'BBB222\t39,5%\t0%\tbbb.de\t\tAktie\tUS0000000002',
      'Summe\t100%\t0,12%',
    ].join('\n')
    const { holdings, issues } = parseDepotText(text)
    expect(issues).toEqual([])
    expect(holdings).toHaveLength(2)
    expect(holdings[0]).toMatchObject({ id: 'AAA111', weight: 0.605, ter: 0.0012, symbol: 'AAA.DE', kind: 'etf' })
    expect(holdings[1]).toMatchObject({ id: 'BBB222', weight: 0.395, kind: 'stock', symbol: 'BBB.DE', leverage: 1 })
  })

  it('liest Anteile ohne Prozentzeichen über die Summe als Prozentpunkte', () => {
    const { holdings } = parseDepotText('ISIN;Gewicht;Kosten\nX1;60;0,2\nX2;40;0')
    expect(holdings.map((h) => h.weight)).toEqual([0.6, 0.4])
    // 0,2 ohne Zeichen ist keine TER von 20 %.
    expect(holdings[0].ter).toBeCloseTo(0.002)
  })

  it('meldet fehlenden Kopf, kaputte Anteile und doppelte IDs', () => {
    expect(parseDepotText('foo\tbar').issues).toEqual([{ code: 'noHeader' }])
    const { issues } = parseDepotText('WKN,Anteil\nA,abc\nB,50%\nB,50%')
    expect(issues.map((i) => i.code)).toEqual(['badWeight', 'duplicate'])
  })

  it('rechnet Anteile aus Positionswerten eines Broker-Exports', () => {
    const text = [
      'Name;ISIN;quantity;price;netValue',
      'iShares Core MSCI World UCITS ETF;IE00B4L5Y983;10;100;"7.500,00 €"',
      'Apple Inc.;US0378331005;5;200;"2.500,00 €"',
    ].join('\n')
    const { holdings, issues } = parseDepotText(text)
    expect(issues).toEqual([])
    expect(holdings.map((h) => [h.id, h.weight, h.kind, h.lookThrough])).toEqual([
      ['IE00B4L5Y983', 0.75, 'etf', 'IE00B4L5Y983'],
      ['US0378331005', 0.25, 'stock', 'US0378331005'],
    ])
  })

  it('nimmt die ISIN-Spalte als Durchschau und erkennt Typen am Namen', () => {
    const { holdings, totalValue } = parseDepotText(
      'WKN\tISIN\tName\tWert\nA0S9GB\tDE000A0S9GB0\tXetra-Gold\t1,234.50 USD\n918422\tUS67066G1040\tNVIDIA\t765.50',
    )
    // Beim ETC zählt der Rohstoff aus dem Namen, nicht die ISIN des Papiers.
    expect(holdings.map((h) => [h.kind, h.lookThrough])).toEqual([
      ['etc', 'Gold'],
      ['stock', 'US67066G1040'],
    ])
    expect(holdings[0].weight).toBeCloseTo(1234.5 / 2000)
    // Der Depotwert bleibt für Beträge in Euro erhalten.
    expect(totalValue).toBeCloseTo(2000)
  })

  it('übersteht den Weg zurück in eine Tabelle', () => {
    const { holdings } = parseDepotText('WKN\tAnteil\tTER\tHebel\tTyp\tDurchschau\nA\t70%\t0.6%\t2\tETF\tIE0000000001:US\nG\t30%\t0.99%\t3\tETC\tgold')
    expect(holdings[1].lookThrough).toBe('Gold')
    expect(parseDepotText(serializeDepot(holdings)).holdings).toEqual(holdings)
  })
})

describe('computeDepotStats', () => {
  const months = 60

  it('rechnet Rendite, Schwankung und Rückgang über 5/3/1 Jahre', () => {
    const a = Array.from({ length: months }, (_, i) => (i % 2 ? 0.03 : -0.01))
    const b = Array.from({ length: months }, () => 0.005)
    const holdings = [
      holding({ id: 'A', symbol: 'A', weight: 0.5, ter: 0.002 }),
      holding({ id: 'B', symbol: 'B', weight: 0.5 }),
    ]
    const stats = computeDepotStats(holdings, new Map([['A', series('A', a)], ['B', series('B', b)]]), new Map())
    const fuenf = stats.windows[0]
    expect(isWindowStats(fuenf)).toBe(true)
    if (!isWindowStats(fuenf)) return
    expect(fuenf.from).toBe('2020-02')
    expect(fuenf.to).toBe('2025-01')
    expect(fuenf.maxDrawdown).toBeCloseTo(-0.0025, 6)
    expect(fuenf.volPa).toBeGreaterThan(0)
    expect(stats.ter).toBeCloseTo(0.001)
    // B schwankt nicht - das ganze Risiko kommt aus A.
    expect(stats.holdings.map((h) => h.riskShare)).toEqual([expect.closeTo(1, 6), expect.closeTo(0, 6)])
    expect(stats.holdings[0].costShare).toBeCloseTo(1)
    expect(scenarioRate(stats)).toBeCloseTo(Math.round(fuenf.returnPa * 1000) / 10)
  })

  it('rechnet Fremdwährungen über den Devisenkurs in Euro um', () => {
    const usd = series('U', Array.from({ length: 24 }, () => 0), 'USD')
    // Der Euro steigt um 1 % je Monat - in Euro verliert die Position.
    const fx = series('EURUSD=X', Array.from({ length: 24 }, () => 0.01))
    const stats = computeDepotStats(
      [holding({ id: 'U', symbol: 'U', weight: 1 })],
      new Map([['U', usd]]),
      new Map([['EURUSD=X', fx]]),
    )
    const einJahr = stats.windows.find((w) => w.years === 1)
    expect(einJahr && isWindowStats(einJahr) ? einJahr.returnPa : null).toBeCloseTo(1.01 ** -12 - 1, 6)
  })

  it('meldet Positionen ohne Kurse und zu kurze Historien', () => {
    const stats = computeDepotStats(
      [holding({ id: 'A', symbol: 'A', weight: 1 }), holding({ id: 'B', weight: 1 })],
      new Map([['A', series('A', [0.01, 0.02])]]),
      new Map(),
    )
    expect(stats.missing).toEqual(['B'])
    expect(stats.windows.every((w) => !isWindowStats(w))).toBe(true)

    const kurz = computeDepotStats(
      [holding({ id: 'A', symbol: 'A', weight: 1 })],
      new Map([['A', series('A', Array.from({ length: 18 }, () => 0.01))]]),
      new Map(),
    )
    expect(kurz.windows.map((w) => isWindowStats(w))).toEqual([false, false, true])
    expect(kurz.holdingsYears).toBe(1)
  })

  it('richtet Reihen mit Kurslücken über ihre Monate aus', () => {
    // 13 Monatskurse, Juli fehlt: ohne Monatsangabe rutschte alles danach um einen Monat.
    const punkte = Array.from({ length: 14 }, (_, i) => ({
      date: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`,
      price: i === 6 ? null : 100 * 1.01 ** i,
    }))
    const mitLuecke = marketFromPrices(punkte, { symbol: 'L', currency: 'EUR' })
    expect(mitLuecke?.months?.[5]).toBe('2025-08')
    const glatt = series('G', Array.from({ length: 13 }, () => 0.01), 'EUR', '2025-01-01')
    const stats = computeDepotStats(
      [holding({ id: 'L', symbol: 'L', weight: 0.5 }), holding({ id: 'G', symbol: 'G', weight: 0.5 })],
      new Map([['L', mitLuecke as MarketSeries], ['G', glatt]]),
      new Map(),
    )
    const einJahr = stats.windows.find((w) => w.years === 1)
    expect(einJahr && isWindowStats(einJahr) ? [einJahr.from, einJahr.to] : null).toEqual(['2025-03', '2026-02'])
    // Die Lücke kostet keine Rendite: 12 Monate zu 1 % bleiben 12 Monate zu 1 %.
    const allein = computeDepotStats(
      [holding({ id: 'L', symbol: 'L', weight: 1 })],
      new Map([['L', mitLuecke as MarketSeries]]),
      new Map(),
    ).windows.find((w) => w.years === 1)
    expect(allein && isWindowStats(allein) ? allein.returnPa : null).toBeCloseTo(1.01 ** 12 - 1, 6)
  })

  it('zählt den Hebel beim Engagement', () => {
    const stats = computeDepotStats(
      [holding({ id: 'A', weight: 0.8 }), holding({ id: 'L', weight: 0.2, leverage: 2 })],
      new Map(),
      new Map(),
    )
    expect(stats.exposure).toBeCloseTo(1.2)
  })
})

describe('computeLookThrough', () => {
  const world: FundHoldings = {
    isin: 'IE0000000001',
    date: '2026-11-09',
    positions: [
      { isin: 'US1', name: 'ALPHABET INC CL A', asset: 'equity', sector: 'Communication Services', country: 'United States', currency: 'USD', weight: 0.3, capUsd: 300e9 },
      { isin: 'US2', name: 'ALPHABET INC CL C', asset: 'equity', sector: 'Communication Services', country: 'United States', currency: 'USD', weight: 0.2, capUsd: 200e9 },
      { isin: 'DE1', name: 'RHEINMETALL ORD', asset: 'equity', sector: 'Industrials', country: 'Germany', currency: 'EUR', weight: 0.4, capUsd: 40e9 },
      { isin: 'JP1', name: 'KLEINE AG', asset: 'equity', sector: 'Materials', country: 'Japan', currency: 'JPY', weight: 0.1, capUsd: 1e9 },
    ],
  }
  const funds = new Map([[world.isin, world]])

  it('zerlegt Fonds, Ausschnitte, Aktien und Rohstoffe mit Hebel', () => {
    const look = computeLookThrough(
      [
        holding({ id: 'W', weight: 0.5, lookThrough: 'IE0000000001' }),
        holding({ id: 'US2X', weight: 0.25, leverage: 2, lookThrough: 'IE0000000001:US' }),
        holding({ id: 'RHM', weight: 0.2, kind: 'stock', lookThrough: 'DE1' }),
        holding({ id: 'GLD', weight: 0.05, kind: 'etc', leverage: 3, lookThrough: 'Gold' }),
      ],
      funds,
    )
    expect(look.exposure).toBeCloseTo(0.5 + 0.5 + 0.2 + 0.15)
    expect(look.missing).toEqual([])
    expect(look.dates).toEqual(['2026-11-09'])

    const us = look.countries.find((c) => c.key === 'US')?.value
    // Welt: 50 % von 0,5; US-Ausschnitt: 100 % von 0,25 mal 2.
    expect(us).toBeCloseTo(0.25 + 0.5)
    expect(look.continents.find((c) => c.key === 'commodity')?.value).toBeCloseTo(0.15)
    expect(look.assets.find((a) => a.key === 'financing')?.value).toBeCloseTo(-0.35)

    // Währungen ohne Hebel: das eingesetzte Geld summiert sich auf 100 %.
    expect(look.currencies.reduce((s, c) => s + c.value, 0)).toBeCloseTo(1)

    const alphabet = look.companies.find((c) => c.name === 'Alphabet Inc')
    expect(alphabet?.exposure).toBeCloseTo(0.25 + 0.5)
    expect(look.companies.find((c) => c.name === 'Rheinmetall')?.direct).toBeCloseTo(0.2)

    expect(look.sizes.find((s) => s.key === 'mega')?.value).toBeCloseTo(0.75)
    expect(look.sizes.find((s) => s.key === 'small')?.value).toBeCloseTo(0.05)
    expect(look.products.find((p) => p.key === 'etf|2')?.value).toBeCloseTo(0.25)
  })

  it('markiert Positionen ohne Fondsbestand als unbekannt', () => {
    const look = computeLookThrough([holding({ id: 'X', weight: 1, lookThrough: 'IE0000000009' })], funds)
    expect(look.missing).toEqual(['X'])
    expect(look.countries).toEqual([{ key: 'unknown', value: 1 }])
  })

  it('führt Aktiengattungen auf einen Firmennamen zusammen', () => {
    expect(issuerName('BERKSHIRE HATHAWAY INC-CL B')).toBe('Berkshire Hathaway Inc')
    expect(issuerName('AP MOLLER-MAERSK A/S-A')).toBe('Ap Moller-Maersk A/S')
    expect(issuerName('APPLE INC')).toBe('Apple Inc')
  })
})

describe('depotFlags', () => {
  it('meldet Hebel, Klumpen und fehlende Daten ohne Empfehlung', () => {
    const holdings = [
      holding({ id: 'W', name: 'Welt', weight: 0.9, lookThrough: 'IE0000000001' }),
      holding({ id: 'L', name: 'Hebel', weight: 0.1, leverage: 2, lookThrough: 'IE0000000009' }),
    ]
    const world: FundHoldings = {
      isin: 'IE0000000001',
      date: '2026-11-09',
      positions: [
        { isin: 'US1', name: 'GROSS INC', asset: 'equity', sector: 'Information Technology', country: 'United States', currency: 'USD', weight: 1, capUsd: 1e12 },
      ],
    }
    const look = computeLookThrough(holdings, new Map([[world.isin, world]]))
    const stats = computeDepotStats(holdings, new Map(), new Map())
    const flags = depotFlags(holdings, stats, look)
    expect(flags.map((f) => f.id)).toEqual(
      expect.arrayContaining(['company', 'country', 'sector', 'leverage', 'currency', 'data']),
    )
    // Warnungen stehen vor Hinweisen.
    const levels = flags.map((f) => f.level)
    expect(levels.indexOf('info')).toBeGreaterThan(levels.lastIndexOf('warn'))
  })
})

describe('Depot im Zustand', () => {
  const holdings = [holding({ id: 'A', weight: 0.6 }), holding({ id: 'B', weight: 0.4 })]

  it('setzt Was-wäre-wenn vom heutigen Depot aus und verwirft es bei neuen Beständen', () => {
    let state = reducer(createInitialState(), actions.setDepot(holdings))
    state = reducer(state, actions.setDepotWhatIfWeight('A', 0.3))
    expect(state.depot.whatIf).toEqual({ A: 0.3, B: 0.4 })
    expect(withWeights(state.depot.holdings, state.depot.whatIf).map((h) => h.weight)).toEqual([0.3, 0.4])
    expect(reducer(state, actions.setDepotWhatIfWeight('Z', 1))).toBe(state)
    expect(reducer(state, actions.setDepot(holdings)).depot.whatIf).toBeNull()
  })

  it('übersteht Speichern und Laden, Unsinn fällt heraus', () => {
    const state = reducer(createInitialState(), actions.setDepot(holdings))
    expect(deserialize(serialize(state))?.depot).toEqual(state.depot)

    const kaputt = sanitizeDepot({
      holdings: [{ id: 'a', weight: -1, symbol: '<script>', kind: 'hack', leverage: 99 }, { id: 'A' }, 'x'],
      whatIf: { A: 2, B: 1 },
    })
    expect(kaputt.holdings).toEqual([
      { id: 'A', name: 'A', symbol: '', weight: 0, ter: 0, leverage: 10, kind: 'etf', lookThrough: '' },
    ])
    expect(kaputt.whatIf).toEqual({ A: 2 })
  })
})
