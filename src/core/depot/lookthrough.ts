/**
 * Durchschau: was in den Fonds steckt, über alle Positionen zusammengezählt.
 *
 * Jede Position wird in ihre Bestandteile zerlegt - ein ETF in seine Aktien,
 * eine Aktie in sich selbst, ein ETC in seinen Rohstoff - und mit Anteil und
 * Hebel gewichtet. Daraus folgen Länder, Kontinente, Märkte, Branchen, Größen,
 * Währungen und die größten Einzelfirmen.
 *
 * Woher die Zerlegung kommt, in absteigender Güte:
 *
 *   ETF:   eigener Fondsbestand -> Bestand eines ähnlichen Fonds (Stellvertreter)
 *          -> typische Indexgewichte laut Name -> unbekannt
 *   Aktie: Eintrag in einem Fondsbestand (ISIN, sonst Firmenname) -> Yahoo-Profil
 *          -> Land aus dem ISIN-Präfix -> unbekannt
 *
 * Alles nach der ersten Stufe ist eine Schätzung und steht in `estimated`.
 *
 * Der Hebel zählt beim Engagement (ein 2x-ETF bewegt doppelt so viel Markt),
 * nicht bei den Währungen: ein gehebeltes Produkt leiht in der Währung, in der
 * es anlegt, das Währungsrisiko trägt nur das eingesetzte Geld.
 */
import { indexTemplate, matchIndex, normalized, type IndexId, type IndexMatch, type IndexTemplate } from './indices.ts'
import type { DepotHolding, FundHoldings, FundPosition, StockProfile } from './types.ts'

export type Continent = 'northAmerica' | 'southAmerica' | 'europe' | 'asia' | 'oceania' | 'africa'
/** Klassifizierung nach MSCI. */
export type Market = 'developed' | 'emerging'

export interface CountryInfo {
  /** ISO-3166-Code - die Oberfläche übersetzt ihn mit Intl.DisplayNames. */
  readonly code: string
  readonly continent: Continent
  readonly market: Market
  /** Währung, in der die Aktien dieses Landes überwiegend notieren. */
  readonly currency: string
}

const country = (code: string, continent: Continent, market: Market, currency: string): CountryInfo => ({
  code,
  continent,
  market,
  currency,
})

/** Ländernamen, wie Fondsgesellschaft und Yahoo sie liefern. */
export const COUNTRIES: Readonly<Record<string, CountryInfo>> = {
  'United States': country('US', 'northAmerica', 'developed', 'USD'),
  Canada: country('CA', 'northAmerica', 'developed', 'CAD'),
  Mexico: country('MX', 'northAmerica', 'emerging', 'MXN'),
  Brazil: country('BR', 'southAmerica', 'emerging', 'BRL'),
  Chile: country('CL', 'southAmerica', 'emerging', 'CLP'),
  Peru: country('PE', 'southAmerica', 'emerging', 'USD'),
  Colombia: country('CO', 'southAmerica', 'emerging', 'COP'),
  'United Kingdom': country('GB', 'europe', 'developed', 'GBP'),
  France: country('FR', 'europe', 'developed', 'EUR'),
  Germany: country('DE', 'europe', 'developed', 'EUR'),
  Switzerland: country('CH', 'europe', 'developed', 'CHF'),
  Sweden: country('SE', 'europe', 'developed', 'SEK'),
  Netherlands: country('NL', 'europe', 'developed', 'EUR'),
  Italy: country('IT', 'europe', 'developed', 'EUR'),
  Spain: country('ES', 'europe', 'developed', 'EUR'),
  Denmark: country('DK', 'europe', 'developed', 'DKK'),
  Finland: country('FI', 'europe', 'developed', 'EUR'),
  Belgium: country('BE', 'europe', 'developed', 'EUR'),
  Norway: country('NO', 'europe', 'developed', 'NOK'),
  Austria: country('AT', 'europe', 'developed', 'EUR'),
  Ireland: country('IE', 'europe', 'developed', 'EUR'),
  Portugal: country('PT', 'europe', 'developed', 'EUR'),
  Luxembourg: country('LU', 'europe', 'developed', 'EUR'),
  Poland: country('PL', 'europe', 'emerging', 'PLN'),
  Greece: country('GR', 'europe', 'emerging', 'EUR'),
  Hungary: country('HU', 'europe', 'emerging', 'HUF'),
  'Czech Republic': country('CZ', 'europe', 'emerging', 'CZK'),
  Czechia: country('CZ', 'europe', 'emerging', 'CZK'),
  Turkey: country('TR', 'europe', 'emerging', 'TRY'),
  Japan: country('JP', 'asia', 'developed', 'JPY'),
  'Hong Kong': country('HK', 'asia', 'developed', 'HKD'),
  Singapore: country('SG', 'asia', 'developed', 'SGD'),
  Israel: country('IL', 'asia', 'developed', 'ILS'),
  China: country('CN', 'asia', 'emerging', 'HKD'),
  Taiwan: country('TW', 'asia', 'emerging', 'TWD'),
  'South Korea': country('KR', 'asia', 'emerging', 'KRW'),
  Korea: country('KR', 'asia', 'emerging', 'KRW'),
  'Korea (South)': country('KR', 'asia', 'emerging', 'KRW'),
  India: country('IN', 'asia', 'emerging', 'INR'),
  Indonesia: country('ID', 'asia', 'emerging', 'IDR'),
  Thailand: country('TH', 'asia', 'emerging', 'THB'),
  Malaysia: country('MY', 'asia', 'emerging', 'MYR'),
  Philippines: country('PH', 'asia', 'emerging', 'PHP'),
  UAE: country('AE', 'asia', 'emerging', 'AED'),
  'United Arab Emirates': country('AE', 'asia', 'emerging', 'AED'),
  'Saudi Arabia': country('SA', 'asia', 'emerging', 'SAR'),
  Qatar: country('QA', 'asia', 'emerging', 'QAR'),
  Kuwait: country('KW', 'asia', 'emerging', 'KWD'),
  Australia: country('AU', 'oceania', 'developed', 'AUD'),
  'New Zealand': country('NZ', 'oceania', 'developed', 'NZD'),
  'South Africa': country('ZA', 'africa', 'emerging', 'ZAR'),
  Egypt: country('EG', 'africa', 'emerging', 'EGP'),
}

/** ISO-Code -> Ländername wie in COUNTRIES, für das ISIN-Präfix. */
const NAME_ZU_CODE = new Map<string, string>()
for (const [name, info] of Object.entries(COUNTRIES)) if (!NAME_ZU_CODE.has(info.code)) NAME_ZU_CODE.set(info.code, name)

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
export type SpecialKey = 'commodity' | 'cash' | 'bond' | 'unknown'
/** Schlüssel, die in Länder-, Branchen- und Größenlisten keine Aktien sind. */
export const NON_EQUITY_KEYS: ReadonlySet<string> = new Set(['commodity', 'cash', 'bond', 'unknown', 'financing'])

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

/** Woher die Zerlegung einer Position stammt - für Hinweise und den Bestands-Editor. */
export type LookSource =
  | { readonly kind: 'fund'; readonly isin: string; readonly date: string }
  | { readonly kind: 'proxy'; readonly index: IndexId; readonly isin: string; readonly date: string }
  | { readonly kind: 'index'; readonly index: IndexId | null; readonly sector: string | null }
  | { readonly kind: 'stockFund' }
  | { readonly kind: 'profile' }
  | { readonly kind: 'isin'; readonly country: string }
  | { readonly kind: 'commodity'; readonly name: string }
  | { readonly kind: 'none' }

export interface LookThrough {
  readonly exposure: number
  /** Stichtage der verwendeten Fondsbestände. */
  readonly dates: readonly string[]
  /** Positionen ohne (vollständige) Durchschau. */
  readonly missing: readonly string[]
  /** Positionen, deren Zerlegung geschätzt ist (Stellvertreter, Indexgewichte, ISIN-Land). */
  readonly estimated: readonly string[]
  readonly sources: Readonly<Record<string, LookSource>>
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

type Asset = 'equity' | 'cash' | 'commodity' | 'bond' | 'unknown'

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
  /** Aus Indexgewichten geschätzt: keine echte Firma, zählt nicht bei den Firmen. */
  readonly synthetic?: boolean
  /** Größenklasse, wenn sie nicht aus einem Börsenwert folgt (Nebenwerte-Fonds). */
  readonly size?: SizeId
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

const RECHTSFORM =
  /[\s,]+(inc|corp|corporation|co|company|ag|se|sa|s\.a|plc|ltd|limited|n\.?v|holdings?|a\/s|asa|ab|oyj|spa|s\.p\.a|kgaa|& co)\.?$/

/**
 * Schlüssel, unter dem eine Firma zählt - ohne Rechtsform und Gattung.
 *
 * Fonds schreiben "NVIDIA CORP", Yahoo "NVIDIA Corporation": dieselbe Firma,
 * und nur zusammen fällt auf, dass sie direkt und im ETF steckt.
 */
export function issuerKey(name: string): string {
  let key = issuerName(name).toLowerCase().replace(/[.,]+$/, '')
  for (let alt = ''; alt !== key; ) {
    alt = key
    key = key.replace(RECHTSFORM, '').replace(/[.,]+$/, '').trim()
  }
  return key || name.toLowerCase()
}

/** Länderfilter einer Durchschau: "EU" = Europa (Industrieländer), "EMU" = Euroraum, sonst ein ISO-Code. */
export function filterCountries(code: string): readonly string[] {
  const c = code.trim().toUpperCase()
  return Object.entries(COUNTRIES)
    .filter(([, info]) =>
      c === 'EU'
        ? info.continent === 'europe' && info.market === 'developed'
        : c === 'EMU'
          ? info.continent === 'europe' && info.market === 'developed' && info.currency === 'EUR'
          : info.code === c,
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

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/
/** Ausdrücklich keine Durchschau - auch keine Schätzung aus dem Namen. */
export const NO_LOOKTHROUGH = '-'
/** Präfix für eine ausdrücklich gewählte Index-Schätzung, z. B. "idx:em". */
export const INDEX_PREFIX = 'idx:'

/** Bestand eines Fonds, optional auf einen Länderausschnitt gefiltert ("ISIN:US"). */
function fundSlice(
  source: string,
  funds: ReadonlyMap<string, FundHoldings>,
): { readonly fund: FundHoldings; readonly positions: readonly FundPosition[]; readonly sum: number } | null {
  const [isin = '', filter = ''] = source.split(':')
  const fund = funds.get(isin.trim().toUpperCase())
  if (!fund) return null
  let positions = fund.positions
  if (filter) {
    const names = filterCountries(filter)
    positions = positions.filter((p) => p.asset === 'equity' && names.includes(p.country))
  }
  const sum = positions.reduce((s, p) => s + p.weight, 0)
  return sum > 0 ? { fund, positions, sum } : null
}

/** Welcher Index für eine ETF-Position gilt: ausdrücklich gewählt oder aus dem Namen. */
export function indexMatchFor(h: DepotHolding): IndexMatch | null {
  if (h.lookThrough === NO_LOOKTHROUGH) return null
  if (h.lookThrough.startsWith(INDEX_PREFIX)) {
    const template = indexTemplate(h.lookThrough.slice(INDEX_PREFIX.length))
    return template ? { template, sector: null, size: null } : null
  }
  return matchIndex(h.name)
}

/**
 * Welche Fondsbestände eine Position braucht: der eigene und - als Ersatz -
 * der Stellvertreter ihres Index. Für den Abruf, bevor gerechnet wird.
 */
export function lookThroughIsins(holdings: readonly DepotHolding[]): string[] {
  const isins = new Set<string>()
  for (const h of holdings) {
    if (h.kind !== 'etf') continue
    const eigene = h.lookThrough.split(':')[0].trim().toUpperCase()
    if (ISIN.test(eigene)) isins.add(eigene)
    const match = indexMatchFor(h)
    if (!match?.template || match.sector || match.size) continue
    const teile = match.template.parts?.map((p) => indexTemplate(p.id)) ?? [match.template]
    for (const t of teile) {
      const proxy = t?.proxy?.split(':')[0]
      if (proxy) isins.add(proxy)
    }
  }
  return [...isins].sort()
}

export function computeLookThrough(
  holdings: readonly DepotHolding[],
  funds: ReadonlyMap<string, FundHoldings>,
  profiles: ReadonlyMap<string, StockProfile> = new Map(),
): LookThrough {
  const allFunds = [...funds.values()]
  const meta = new Map<string, FundPosition>()
  const metaByIssuer = new Map<string, FundPosition>()
  for (const fund of [...allFunds].sort((a, b) => b.positions.length - a.positions.length)) {
    for (const p of fund.positions) {
      if (p.asset !== 'equity') continue
      if (p.isin && !meta.has(p.isin)) meta.set(p.isin, p)
      const key = issuerKey(p.name)
      if (!metaByIssuer.has(key)) metaByIssuer.set(key, p)
    }
  }
  const caps = calibratedCaps(allFunds)
  const issuerCaps = new Map<string, number>()
  for (const [isin, cap] of caps) {
    const p = meta.get(isin)
    if (p) issuerCaps.set(issuerKey(p.name), (issuerCaps.get(issuerKey(p.name)) ?? 0) + cap)
  }

  const total = holdings.reduce((s, h) => s + Math.max(0, h.weight), 0)
  const rows: Row[] = []
  const missing: string[] = []
  const estimated: string[] = []
  const sources: Record<string, LookSource> = {}
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

  const fundRows = (h: DepotHolding, slice: NonNullable<ReturnType<typeof fundSlice>>, w: number, lev: number) =>
    slice.positions.map((p): Row => {
      const share = p.weight / slice.sum
      return {
        holdingId: h.id,
        issuer: p.asset === 'equity' ? p.name : 'cash',
        asset: p.asset,
        sector: p.sector,
        country: p.country,
        currency: p.currency,
        capital: w * share,
        exposure: w * lev * share,
        direct: false,
      }
    })

  /** Schätzung aus Indexgewichten: Länder x Branchen, als gäbe es keinen Zusammenhang. */
  const staticRows = (h: DepotHolding, t: IndexTemplate | null, match: IndexMatch, w: number, lev: number): Row[] => {
    const asset: Asset = t?.asset ?? 'equity'
    if (asset !== 'equity') {
      const euro = /\bEUR(O)?\b/i.test(h.name)
      return [
        {
          holdingId: h.id,
          issuer: '',
          asset,
          sector: '',
          country: '',
          // Rohstoffe notieren in US-Dollar; Euro-Anleihen und -Geldmarkt in Euro.
          currency: asset === 'commodity' ? 'USD' : euro ? 'EUR' : '',
          capital: w,
          exposure: w * lev,
          direct: false,
          synthetic: true,
        },
      ]
    }
    const laender: [string, number][] = t?.countries ? normalized(t.countries) : [['', 1]]
    const branchen: [string, number][] = match.sector
      ? [[match.sector, 1]]
      : t?.sectors
        ? normalized(t.sectors)
        : [['', 1]]
    return laender.flatMap(([land, wl]) =>
      branchen.map(([branche, wb]): Row => ({
        holdingId: h.id,
        issuer: '',
        asset: 'equity',
        sector: branche,
        country: land,
        currency: COUNTRIES[land]?.currency ?? '',
        capital: w * wl * wb,
        exposure: w * lev * wl * wb,
        direct: false,
        synthetic: true,
        size: match.size ?? undefined,
      })),
    )
  }

  /**
   * ETF ohne eigenen Bestand: je Teil-Index erst der Stellvertreter, dann die
   * Indexgewichte. Branchen- und Nebenwerte-Fonds bekommen keinen
   * Stellvertreter - der Welt-Bestand hätte die falsche Branche und Größe.
   */
  const indexRows = (h: DepotHolding, match: IndexMatch, w: number, lev: number) => {
    const t = match.template
    const teile = t?.parts
      ? t.parts.flatMap((p) => {
          const teil = indexTemplate(p.id)
          return teil ? [{ t: teil, weight: p.weight }] : []
        })
      : [{ t, weight: 1 }]
    const out: Row[] = []
    let proxy: { isin: string; date: string } | null = null
    for (const teil of teile) {
      const slice =
        teil.t?.proxy && !match.sector && !match.size ? fundSlice(teil.t.proxy, funds) : null
      if (slice) {
        proxy = { isin: slice.fund.isin, date: slice.fund.date }
        dates.add(slice.fund.date)
        out.push(...fundRows(h, slice, w * teil.weight, lev))
      } else {
        out.push(...staticRows(h, teil.t, match, w * teil.weight, lev))
      }
    }
    const source: LookSource =
      proxy && t
        ? { kind: 'proxy', index: t.id, isin: proxy.isin, date: proxy.date }
        : { kind: 'index', index: t?.id ?? null, sector: match.sector }
    return { rows: out, source }
  }

  for (const h of holdings) {
    const w = total > 0 ? Math.max(0, h.weight) / total : 0
    const lev = h.leverage > 0 ? h.leverage : 1
    if (w === 0) continue

    if (h.kind === 'etf') {
      const eigene = h.lookThrough.startsWith(INDEX_PREFIX) ? null : fundSlice(h.lookThrough, funds)
      if (eigene) {
        dates.add(eigene.fund.date)
        rows.push(...fundRows(h, eigene, w, lev))
        sources[h.id] = { kind: 'fund', isin: eigene.fund.isin, date: eigene.fund.date }
        continue
      }
      const match = indexMatchFor(h)
      if (!match) {
        missing.push(h.id)
        rows.push(unknownRow(h, w, lev))
        sources[h.id] = { kind: 'none' }
        continue
      }
      const { rows: geschaetzt, source } = indexRows(h, match, w, lev)
      rows.push(...geschaetzt)
      estimated.push(h.id)
      sources[h.id] = source
    } else if (h.kind === 'stock') {
      const kennung = h.lookThrough.trim().toUpperCase()
      const isin = ISIN.test(kennung) ? kennung : ISIN.test(h.id) ? h.id : ''
      const profile = h.symbol ? profiles.get(h.symbol) : undefined
      const p =
        (kennung ? meta.get(kennung) : undefined) ??
        meta.get(h.id) ??
        metaByIssuer.get(issuerKey(profile?.name ?? h.name))
      const isinLand = isin ? NAME_ZU_CODE.get(isin.slice(0, 2)) : undefined
      const land = p?.country || profile?.country || isinLand || ''
      const quelle: LookSource = p
        ? { kind: 'stockFund' }
        : profile?.country || profile?.sector
          ? { kind: 'profile' }
          : isinLand
            ? { kind: 'isin', country: isinLand }
            : { kind: 'none' }
      sources[h.id] = quelle
      if (quelle.kind === 'none') missing.push(h.id)
      if (quelle.kind === 'isin') estimated.push(h.id)
      const issuer = p ? p.name : profile?.name || h.name || h.id
      if (!p && profile?.capUsd && profile.capUsd > 0 && !issuerCaps.has(issuerKey(issuer))) {
        issuerCaps.set(issuerKey(issuer), profile.capUsd)
      }
      rows.push({
        holdingId: h.id,
        issuer,
        asset: 'equity',
        sector: p?.sector || profile?.sector || '',
        country: land,
        // Das Währungsrisiko folgt dem Land der Firma, nicht dem Börsenplatz:
        // NVIDIA auf Xetra in Euro gekauft bleibt ein Dollar-Wert.
        currency: COUNTRIES[land]?.currency || p?.currency || profile?.currency || '',
        capital: w,
        exposure: w * lev,
        direct: true,
      })
    } else {
      const name = h.lookThrough && !ISIN.test(h.lookThrough) ? h.lookThrough : h.name || h.id
      sources[h.id] = { kind: 'commodity', name }
      rows.push({
        holdingId: h.id,
        issuer: name,
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

  const companies = new Map<string, { name: string; exposure: number; direct: number; via: string[] }>()
  for (const r of rows) {
    if (r.asset !== 'equity' || r.synthetic) continue
    const key = issuerKey(r.issuer)
    const c = companies.get(key) ?? { name: issuerName(r.issuer), exposure: 0, direct: 0, via: [] }
    c.exposure += r.exposure
    if (r.direct) c.direct += r.exposure
    if (!c.via.includes(r.holdingId)) c.via.push(r.holdingId)
    companies.set(key, c)
  }

  return {
    exposure,
    dates: [...dates].sort(),
    missing,
    estimated,
    sources,
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
    sizes: group(
      rows,
      (r) => equityOr(r, (x) => x.size ?? (x.synthetic ? 'unknown' : sizeOf(issuerCaps.get(issuerKey(x.issuer))))),
      'exposure',
    ),
    currencies: group(rows, (r) => r.currency || 'unknown', 'capital'),
    products: [...products].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value),
    companies: [...companies.values()].sort((a, b) => b.exposure - a.exposure),
  }
}
