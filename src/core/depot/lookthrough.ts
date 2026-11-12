/**
 * Durchschau: was in den Fonds steckt, über alle Positionen zusammengezählt.
 *
 * Jede Position wird in ihre Bestandteile zerlegt - ein ETF in seine Aktien,
 * eine Aktie in sich selbst, ein ETC in seinen Rohstoff - und mit Anteil und
 * Hebel gewichtet. Daraus folgen Länder, Kontinente, Märkte, Branchen, Größen,
 * Währungen und die größten Einzelfirmen.
 *
 * Der Hebel zählt beim Engagement (ein 2x-ETF bewegt doppelt so viel Markt),
 * nicht bei den Währungen: ein gehebeltes Produkt leiht in der Währung, in der
 * es anlegt, das Währungsrisiko trägt nur das eingesetzte Geld.
 */
import type { DepotHolding, FundHoldings, FundPosition } from './types.ts'

export type Continent = 'northAmerica' | 'southAmerica' | 'europe' | 'asia' | 'oceania' | 'africa'
/** Klassifizierung nach MSCI. */
export type Market = 'developed' | 'emerging'

export interface CountryInfo {
  /** ISO-3166-Code - die Oberfläche übersetzt ihn mit Intl.DisplayNames. */
  readonly code: string
  readonly continent: Continent
  readonly market: Market
}

const country = (code: string, continent: Continent, market: Market): CountryInfo => ({
  code,
  continent,
  market,
})

/** Ländernamen, wie die Fondsgesellschaft sie liefert. */
export const COUNTRIES: Readonly<Record<string, CountryInfo>> = {
  'United States': country('US', 'northAmerica', 'developed'),
  Canada: country('CA', 'northAmerica', 'developed'),
  Mexico: country('MX', 'northAmerica', 'emerging'),
  Brazil: country('BR', 'southAmerica', 'emerging'),
  'United Kingdom': country('GB', 'europe', 'developed'),
  France: country('FR', 'europe', 'developed'),
  Germany: country('DE', 'europe', 'developed'),
  Switzerland: country('CH', 'europe', 'developed'),
  Sweden: country('SE', 'europe', 'developed'),
  Netherlands: country('NL', 'europe', 'developed'),
  Italy: country('IT', 'europe', 'developed'),
  Spain: country('ES', 'europe', 'developed'),
  Denmark: country('DK', 'europe', 'developed'),
  Finland: country('FI', 'europe', 'developed'),
  Belgium: country('BE', 'europe', 'developed'),
  Norway: country('NO', 'europe', 'developed'),
  Austria: country('AT', 'europe', 'developed'),
  Ireland: country('IE', 'europe', 'developed'),
  Portugal: country('PT', 'europe', 'developed'),
  Luxembourg: country('LU', 'europe', 'developed'),
  Poland: country('PL', 'europe', 'emerging'),
  Japan: country('JP', 'asia', 'developed'),
  'Hong Kong': country('HK', 'asia', 'developed'),
  Singapore: country('SG', 'asia', 'developed'),
  Israel: country('IL', 'asia', 'developed'),
  China: country('CN', 'asia', 'emerging'),
  Taiwan: country('TW', 'asia', 'emerging'),
  'South Korea': country('KR', 'asia', 'emerging'),
  India: country('IN', 'asia', 'emerging'),
  UAE: country('AE', 'asia', 'emerging'),
  'United Arab Emirates': country('AE', 'asia', 'emerging'),
  'Saudi Arabia': country('SA', 'asia', 'emerging'),
  Australia: country('AU', 'oceania', 'developed'),
  'New Zealand': country('NZ', 'oceania', 'developed'),
  'South Africa': country('ZA', 'africa', 'emerging'),
}

/** GICS-Sektor (englisch) -> stabile ID für die Übersetzung. */
export const SECTORS: Readonly<Record<string, string>> = {
  'Information Technology': 'it',
  Financials: 'financials',
  Industrials: 'industrials',
  'Health Care': 'healthCare',
  'Consumer Discretionary': 'consumerDiscretionary',
  'Communication Services': 'communication',
  'Consumer Staples': 'consumerStaples',
  Energy: 'energy',
  Materials: 'materials',
  Utilities: 'utilities',
  'Real Estate': 'realEstate',
}

export type SizeId = 'mega' | 'large' | 'mid' | 'small'
export const SIZE_LIMITS_USD: readonly (readonly [number, SizeId])[] = [
  [200e9, 'mega'],
  [10e9, 'large'],
  [2e9, 'mid'],
  [0, 'small'],
]

/** Schlüssel für alles, was kein Land, keine Branche und keine Größe hat. */
export type SpecialKey = 'commodity' | 'cash' | 'unknown'

export interface Share {
  readonly key: string
  /** Anteil am Depotwert; beim Engagement inklusive Hebel. */
  readonly value: number
}

export interface CompanyExposure {
  readonly name: string
  readonly exposure: number
  /** Davon direkt als Einzelaktie gehalten. */
  readonly direct: number
  /** Positions-IDs, über die die Firma im Depot steckt. */
  readonly via: readonly string[]
}

export interface LookThrough {
  readonly exposure: number
  /** Stichtage der verwendeten Fondsbestände. */
  readonly dates: readonly string[]
  /** Positionen ohne (vollständige) Durchschau. */
  readonly missing: readonly string[]
  readonly assets: readonly Share[]
  readonly continents: readonly Share[]
  readonly markets: readonly Share[]
  readonly countries: readonly Share[]
  readonly sectors: readonly Share[]
  readonly sizes: readonly Share[]
  /** Auf das eingesetzte Geld, ohne Hebel. */
  readonly currencies: readonly Share[]
  /** Produktarten als "art|hebel", auf das eingesetzte Geld. */
  readonly products: readonly Share[]
  readonly companies: readonly CompanyExposure[]
}

type Asset = 'equity' | 'cash' | 'commodity' | 'unknown'

interface Row {
  readonly holdingId: string
  readonly issuer: string
  readonly asset: Asset
  readonly sector: string
  readonly country: string
  readonly currency: string
  readonly capital: number
  readonly exposure: number
  readonly direct: boolean
}

const SHARE_CLASS = /(\s+|\s*-\s*)(CL(ASS)?[ -]?[A-Z]|[A-Z]( SHS)?|(VOR-)?PFD|ADR|ORD)$/

/** Firmenname ohne Aktiengattung, damit Alphabet A und C zusammen zählen. */
export function issuerName(name: string): string {
  const base = name.replace(SHARE_CLASS, '').trim().toLowerCase()
  return base.replace(
    /(^|[\s(&./-])(\p{L})/gu,
    (_, before: string, letter: string) => before + letter.toUpperCase(),
  )
}

/** Länderfilter einer Durchschau: "EU" = Europa (Industrieländer), sonst ein ISO-Code. */
export function filterCountries(code: string): readonly string[] {
  const c = code.trim().toUpperCase()
  return Object.entries(COUNTRIES)
    .filter(([, info]) =>
      c === 'EU' ? info.continent === 'europe' && info.market === 'developed' : info.code === c,
    )
    .map(([name]) => name)
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Marktkapitalisierung je ISIN, über alle Fonds auf einen Maßstab gebracht.
 *
 * Der Server schätzt sie je Fonds aus den Indexgewichten. Ein Fonds mit
 * gedeckelten Gewichten liegt dabei daneben - deshalb wird jeder Fonds an
 * dem mit den meisten Positionen ausgerichtet, über die gemeinsamen Firmen.
 */
function calibratedCaps(funds: readonly FundHoldings[]): Map<string, number> {
  const sorted = [...funds].sort((a, b) => b.positions.length - a.positions.length)
  const caps = new Map<string, number>()
  sorted.forEach((fund, index) => {
    const ratios =
      index === 0
        ? []
        : fund.positions.flatMap((p) => {
            const ref = p.isin ? caps.get(p.isin) : undefined
            return ref && p.capUsd ? [ref / p.capUsd] : []
          })
    const factor = ratios.length >= 5 ? median(ratios) : 1
    for (const p of fund.positions) {
      if (p.isin && p.capUsd && p.asset === 'equity' && !caps.has(p.isin)) {
        caps.set(p.isin, p.capUsd * factor)
      }
    }
  })
  return caps
}

function sizeOf(cap: number | undefined): SizeId | 'unknown' {
  if (cap === undefined || !(cap > 0)) return 'unknown'
  return SIZE_LIMITS_USD.find(([limit]) => cap >= limit)?.[1] ?? 'small'
}

function group(rows: readonly Row[], pick: (r: Row) => string, value: 'capital' | 'exposure'): Share[] {
  const sums = new Map<string, number>()
  for (const r of rows) sums.set(pick(r), (sums.get(pick(r)) ?? 0) + r[value])
  return [...sums]
    .map(([key, v]) => ({ key, value: v }))
    .filter((s) => Math.abs(s.value) > 1e-9)
    .sort((a, b) => b.value - a.value)
}

export function computeLookThrough(
  holdings: readonly DepotHolding[],
  funds: ReadonlyMap<string, FundHoldings>,
): LookThrough {
  const allFunds = [...funds.values()]
  const meta = new Map<string, FundPosition>()
  for (const fund of [...allFunds].sort((a, b) => b.positions.length - a.positions.length)) {
    for (const p of fund.positions) {
      if (p.isin && p.asset === 'equity' && !meta.has(p.isin)) meta.set(p.isin, p)
    }
  }
  const caps = calibratedCaps(allFunds)
  const issuerCaps = new Map<string, number>()
  for (const [isin, cap] of caps) {
    const p = meta.get(isin)
    if (p) issuerCaps.set(issuerName(p.name), (issuerCaps.get(issuerName(p.name)) ?? 0) + cap)
  }

  const total = holdings.reduce((s, h) => s + Math.max(0, h.weight), 0)
  const rows: Row[] = []
  const missing: string[] = []
  const dates = new Set<string>()

  const unknownRow = (h: DepotHolding, w: number, lev: number): Row => ({
    holdingId: h.id,
    issuer: h.name || h.id,
    asset: 'unknown',
    sector: '',
    country: '',
    currency: '',
    capital: w,
    exposure: w * lev,
    direct: false,
  })

  for (const h of holdings) {
    const w = total > 0 ? Math.max(0, h.weight) / total : 0
    const lev = h.leverage > 0 ? h.leverage : 1
    if (w === 0) continue

    if (h.kind === 'etf') {
      const [isin = '', filter = ''] = h.lookThrough.split(':')
      const fund = funds.get(isin.trim().toUpperCase())
      let positions = fund?.positions ?? []
      if (filter) {
        const names = filterCountries(filter)
        positions = positions.filter((p) => p.asset === 'equity' && names.includes(p.country))
      }
      const sum = positions.reduce((s, p) => s + p.weight, 0)
      if (!fund || !(sum > 0)) {
        missing.push(h.id)
        rows.push(unknownRow(h, w, lev))
        continue
      }
      dates.add(fund.date)
      for (const p of positions) {
        const share = p.weight / sum
        rows.push({
          holdingId: h.id,
          issuer: p.asset === 'equity' ? issuerName(p.name) : 'cash',
          asset: p.asset,
          sector: p.sector,
          country: p.country,
          currency: p.currency,
          capital: w * share,
          exposure: w * lev * share,
          direct: false,
        })
      }
    } else if (h.kind === 'stock') {
      const p = meta.get(h.lookThrough.trim().toUpperCase())
      if (!p) missing.push(h.id)
      rows.push({
        holdingId: h.id,
        issuer: p ? issuerName(p.name) : h.name || h.id,
        asset: 'equity',
        sector: p?.sector ?? '',
        country: p?.country ?? '',
        currency: p?.currency ?? '',
        capital: w,
        exposure: w * lev,
        direct: true,
      })
    } else {
      rows.push({
        holdingId: h.id,
        issuer: h.lookThrough || h.name || h.id,
        asset: 'commodity',
        sector: '',
        country: '',
        // Rohstoffe werden in US-Dollar gehandelt.
        currency: 'USD',
        capital: w,
        exposure: w * lev,
        direct: false,
      })
    }
  }

  const equityOr = (r: Row, key: (r: Row) => string | undefined): string =>
    r.asset === 'equity' ? (key(r) ?? 'unknown') : r.asset
  const exposure = rows.reduce((s, r) => s + r.exposure, 0)

  const assets = group(rows, (r) => r.asset, 'exposure')
  if (total > 0 && Math.abs(exposure - 1) > 1e-9) assets.push({ key: 'financing', value: 1 - exposure })

  const products = new Map<string, number>()
  for (const h of holdings) {
    const w = total > 0 ? Math.max(0, h.weight) / total : 0
    if (w === 0) continue
    const key = `${h.kind}|${h.leverage > 0 ? h.leverage : 1}`
    products.set(key, (products.get(key) ?? 0) + w)
  }

  const companies = new Map<string, { exposure: number; direct: number; via: string[] }>()
  for (const r of rows) {
    if (r.asset !== 'equity') continue
    const c = companies.get(r.issuer) ?? { exposure: 0, direct: 0, via: [] }
    c.exposure += r.exposure
    if (r.direct) c.direct += r.exposure
    if (!c.via.includes(r.holdingId)) c.via.push(r.holdingId)
    companies.set(r.issuer, c)
  }

  return {
    exposure,
    dates: [...dates].sort(),
    missing,
    assets,
    continents: group(rows, (r) => equityOr(r, (x) => COUNTRIES[x.country]?.continent), 'exposure'),
    markets: group(rows, (r) => equityOr(r, (x) => COUNTRIES[x.country]?.market), 'exposure'),
    countries: group(
      rows,
      (r) => equityOr(r, (x) => COUNTRIES[x.country]?.code ?? (x.country || undefined)),
      'exposure',
    ),
    sectors: group(
      rows,
      (r) => equityOr(r, (x) => SECTORS[x.sector] ?? (x.sector || undefined)),
      'exposure',
    ),
    sizes: group(rows, (r) => equityOr(r, (x) => sizeOf(issuerCaps.get(x.issuer))), 'exposure'),
    currencies: group(rows, (r) => r.currency || 'unknown', 'capital'),
    products: [...products].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value),
    companies: [...companies]
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.exposure - a.exposure),
  }
}
