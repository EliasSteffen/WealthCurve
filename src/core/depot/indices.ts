/**
 * Indizes, die ein Fondsname verrät - als Ersatz-Durchschau und als Bausteine.
 *
 * Vollständige Bestände veröffentlicht nur Amundi über eine offene
 * Schnittstelle. Für alle anderen ETFs sagt der Name meist genug: "S&P 500"
 * heißt USA, "FTSE Developed Europe" heißt Europa. Dafür gibt es zwei Stufen:
 *
 *   1. `proxy` - ein Amundi-Fonds auf einen sehr ähnlichen Index, dessen
 *      echter Bestand geladen wird (MSCI World, nur der US-Teil, für S&P 500).
 *   2. `countries`/`sectors` - gerundete, typische Indexgewichte als Schätzung,
 *      wenn auch der Stellvertreter fehlt (kein Server, Anbieter nicht erreichbar).
 *
 * Beides ist als Schätzung gekennzeichnet. Die Gewichte driften mit den
 * Märkten; für die Frage "wie viel Schwellenländer, wie viel Europa?" genügen
 * sie, für Nachkommastellen nicht.
 *
 * Länder stehen mit englischem Namen wie in den Fondsdaten, Branchen als
 * GICS-Sektor - so laufen Schätzung und echter Bestand durch dieselbe Rechnung.
 */
import { kindFromName } from './classify.ts'

export type IndexId =
  | 'moneyMarket'
  | 'bonds'
  | 'commodities'
  | 'semis'
  | 'nasdaq100'
  | 'sp500'
  | 'acwi'
  | 'em'
  | 'worldExUs'
  | 'emu'
  | 'europe'
  | 'pacificExJapan'
  | 'japan'
  | 'germany'
  | 'uk'
  | 'switzerland'
  | 'france'
  | 'china'
  | 'india'
  | 'korea'
  | 'taiwan'
  | 'brazil'
  | 'canada'
  | 'australia'
  | 'usa'
  | 'world'

export type IndexAsset = 'equity' | 'bond' | 'cash' | 'commodity'

export interface IndexTemplate {
  readonly id: IndexId
  /** Name des Index - ein Eigenname, wird nicht übersetzt. */
  readonly label: string
  readonly match: RegExp
  readonly asset: IndexAsset
  /** Länder (englischer Name) -> typisches Gewicht; wird auf 1 normiert. */
  readonly countries?: Readonly<Record<string, number>>
  /** GICS-Sektor (englisch) -> typisches Gewicht; wird auf 1 normiert. */
  readonly sectors?: Readonly<Record<string, number>>
  /** Amundi-Fonds mit ähnlichem Index, "ISIN[:Filter]". */
  readonly proxy?: string
  /** Zusammengesetzte Indizes, z. B. ACWI = World + Schwellenländer. */
  readonly parts?: readonly { readonly id: IndexId; readonly weight: number }[]
}

/** Amundi Core MSCI World - veröffentlicht seinen vollen Bestand. */
export const WORLD_PROXY = 'IE000BI8OT95'

const WORLD_COUNTRIES = {
  'United States': 72,
  Japan: 5.5,
  'United Kingdom': 3.5,
  Canada: 3.2,
  France: 2.6,
  Switzerland: 2.3,
  Germany: 2.3,
  Australia: 1.6,
  Netherlands: 1.2,
  Sweden: 0.9,
  Italy: 0.8,
  Spain: 0.8,
  Denmark: 0.6,
  'Hong Kong': 0.5,
  Singapore: 0.4,
  Finland: 0.3,
  Belgium: 0.25,
  Israel: 0.2,
  Norway: 0.15,
  Ireland: 0.15,
  'New Zealand': 0.05,
  Austria: 0.05,
  Portugal: 0.05,
}

const WORLD_SECTORS = {
  'Information Technology': 27,
  Financials: 16.5,
  Industrials: 11,
  'Consumer Discretionary': 10,
  'Health Care': 9.5,
  'Communication Services': 8.5,
  'Consumer Staples': 5.5,
  Energy: 3.5,
  Materials: 3,
  Utilities: 2.7,
  'Real Estate': 2,
}

const EM_COUNTRIES = {
  China: 27,
  Taiwan: 19,
  India: 18,
  'South Korea': 10,
  Brazil: 4.5,
  'Saudi Arabia': 3.5,
  'South Africa': 3.2,
  Mexico: 2,
  'United Arab Emirates': 1.5,
  Malaysia: 1.4,
  Thailand: 1.3,
  Indonesia: 1.3,
  Poland: 1,
  Qatar: 0.8,
  Kuwait: 0.8,
  Turkey: 0.6,
  Greece: 0.5,
  Chile: 0.5,
  Philippines: 0.5,
}

const EM_SECTORS = {
  'Information Technology': 24,
  Financials: 23,
  'Consumer Discretionary': 13,
  'Communication Services': 10,
  Industrials: 7,
  Materials: 6,
  'Consumer Staples': 4.5,
  Energy: 4,
  'Health Care': 3.5,
  Utilities: 2.5,
  'Real Estate': 1.5,
}

const EUROPE_COUNTRIES = {
  'United Kingdom': 23,
  France: 16,
  Switzerland: 15,
  Germany: 14.5,
  Netherlands: 7,
  Sweden: 5.5,
  Italy: 4.5,
  Spain: 4.5,
  Denmark: 3.5,
  Finland: 1.5,
  Belgium: 1.5,
  Norway: 1,
  Ireland: 0.8,
  Austria: 0.3,
  Portugal: 0.3,
}

const EUROPE_SECTORS = {
  Financials: 22,
  Industrials: 18,
  'Health Care': 14,
  'Consumer Staples': 9,
  'Consumer Discretionary': 9,
  'Information Technology': 7,
  Materials: 5.5,
  Energy: 4.5,
  Utilities: 4.5,
  'Communication Services': 4,
  'Real Estate': 1,
}

const US_SECTORS = {
  'Information Technology': 33,
  Financials: 13,
  'Communication Services': 10,
  'Consumer Discretionary': 10,
  'Health Care': 9,
  Industrials: 8.5,
  'Consumer Staples': 5,
  Energy: 3,
  Utilities: 2.5,
  'Real Estate': 2,
  Materials: 1.8,
}

const ohne = (land: string, quelle: Readonly<Record<string, number>>) =>
  Object.fromEntries(Object.entries(quelle).filter(([k]) => k !== land))

const nurLand = (land: string) => ({ [land]: 1 })

/**
 * Reihenfolge ist Vorrang: das Speziellere zuerst. "FTSE Developed Europe"
 * soll Europa treffen, nicht "Developed" = Welt; "MSCI World Health Care"
 * trifft Welt und bekommt die Branche vom Namen dazu.
 */
export const INDEX_TEMPLATES: readonly IndexTemplate[] = [
  {
    id: 'moneyMarket',
    label: 'Geldmarkt',
    match: /MONEY MARKET|GELDMARKT|OVERNIGHT|€STR|\bESTR\b|\bSOFR\b|\bEONIA\b|T-BILL|TREASURY BILL/i,
    asset: 'cash',
  },
  {
    id: 'bonds',
    label: 'Anleihen',
    match:
      /\bBONDS?\b|ANLEIHE|RENTEN|TREASURY|TREASURIES|\bGOVT\b|GOVERNMENT|AGGREGATE|CORPORATE|\bGILTS?\b|INFLATION[\s-]LINKED|HIGH YIELD|FIXED INCOME|COVERED BOND|PFANDBRIEF/i,
    asset: 'bond',
  },
  {
    id: 'commodities',
    label: 'Rohstoffe',
    match: /COMMODIT|ROHSTOFF(?!.*AKTIEN)/i,
    asset: 'commodity',
  },
  {
    id: 'semis',
    label: 'MSCI ACWI Semiconductors',
    match: /SEMICONDUCTOR|HALBLEITER/i,
    asset: 'equity',
    countries: {
      'United States': 72,
      Taiwan: 12,
      Netherlands: 7,
      Japan: 4,
      'South Korea': 3,
      'United Kingdom': 1,
      Germany: 1,
    },
    sectors: { 'Information Technology': 1 },
  },
  {
    id: 'nasdaq100',
    label: 'Nasdaq-100',
    match: /NASDAQ/i,
    asset: 'equity',
    countries: { 'United States': 96, 'United Kingdom': 1.5, Netherlands: 1.2, China: 0.8, Canada: 0.5 },
    sectors: {
      'Information Technology': 51,
      'Communication Services': 16,
      'Consumer Discretionary': 13,
      'Health Care': 6,
      'Consumer Staples': 5,
      Industrials: 5,
      Utilities: 1.5,
      Materials: 1,
      Energy: 0.5,
      Financials: 0.5,
    },
  },
  {
    id: 'sp500',
    label: 'S&P 500',
    match: /S\s?&\s?P\s?500|\bSP\s?500\b/i,
    asset: 'equity',
    countries: nurLand('United States'),
    sectors: US_SECTORS,
    proxy: `${WORLD_PROXY}:US`,
  },
  {
    id: 'acwi',
    label: 'MSCI ACWI',
    match: /ALL[\s-]?COUNTRY|\bACWI\b|ALL[\s-]?WORLD|GLOBAL ALL[\s-]?CAP|TOTAL WORLD|\bFTSE GLOBAL\b/i,
    asset: 'equity',
    parts: [
      { id: 'world', weight: 0.89 },
      { id: 'em', weight: 0.11 },
    ],
  },
  {
    id: 'em',
    label: 'MSCI Emerging Markets',
    match: /EMERGING|SCHWELLENL|\bEM\b|\bEM IMI\b/i,
    asset: 'equity',
    countries: EM_COUNTRIES,
    sectors: EM_SECTORS,
  },
  {
    id: 'worldExUs',
    label: 'MSCI World ex USA',
    match: /\bEX[\s-]?(USA|US)\b/i,
    asset: 'equity',
    countries: ohne('United States', WORLD_COUNTRIES),
  },
  {
    id: 'emu',
    label: 'MSCI EMU',
    match: /EURO\s?STOXX|EUROZONE|EURO AREA|\bEMU\b|EUROLAND/i,
    asset: 'equity',
    countries: {
      France: 33,
      Germany: 28,
      Netherlands: 15,
      Spain: 9,
      Italy: 8,
      Finland: 2.5,
      Belgium: 2.5,
      Ireland: 1.5,
      Austria: 0.6,
      Portugal: 0.5,
    },
    sectors: EUROPE_SECTORS,
    proxy: `${WORLD_PROXY}:EMU`,
  },
  {
    id: 'europe',
    label: 'MSCI Europe',
    match: /EUROPE|EUROPA|STOXX\s?600|EUROPEAN/i,
    asset: 'equity',
    countries: EUROPE_COUNTRIES,
    sectors: EUROPE_SECTORS,
    proxy: `${WORLD_PROXY}:EU`,
  },
  {
    id: 'pacificExJapan',
    label: 'MSCI Pacific ex Japan',
    match: /PACIFIC EX[\s-]?JAPAN|PAZIFIK EX[\s-]?JAPAN/i,
    asset: 'equity',
    countries: { Australia: 62, 'Hong Kong': 20, Singapore: 15, 'New Zealand': 3 },
  },
  {
    id: 'japan',
    label: 'MSCI Japan',
    match: /JAPAN|NIKKEI|TOPIX/i,
    asset: 'equity',
    countries: nurLand('Japan'),
    proxy: `${WORLD_PROXY}:JP`,
  },
  {
    id: 'germany',
    label: 'DAX',
    match: /\b(M|S|TEC)?DAX\b|GERMANY|DEUTSCHLAND/i,
    asset: 'equity',
    countries: nurLand('Germany'),
    proxy: `${WORLD_PROXY}:DE`,
  },
  {
    id: 'uk',
    label: 'FTSE 100',
    match: /FTSE\s?(100|250)|\bUK\b|UNITED KINGDOM|GREAT BRITAIN|GROSSBRITANNIEN|GROßBRITANNIEN/i,
    asset: 'equity',
    countries: nurLand('United Kingdom'),
    proxy: `${WORLD_PROXY}:GB`,
  },
  {
    id: 'switzerland',
    label: 'SMI',
    match: /\bSMI\b|SWITZERLAND|SCHWEIZ|\bSWISS\b/i,
    asset: 'equity',
    countries: nurLand('Switzerland'),
    proxy: `${WORLD_PROXY}:CH`,
  },
  {
    id: 'france',
    label: 'CAC 40',
    match: /\bCAC\s?40\b|\bFRANCE\b|FRANKREICH/i,
    asset: 'equity',
    countries: nurLand('France'),
    proxy: `${WORLD_PROXY}:FR`,
  },
  { id: 'china', label: 'MSCI China', match: /\bCHINA\b|CSI\s?300/i, asset: 'equity', countries: nurLand('China') },
  { id: 'india', label: 'MSCI India', match: /\bINDIA\b|INDIEN|NIFTY/i, asset: 'equity', countries: nurLand('India') },
  { id: 'korea', label: 'MSCI Korea', match: /\bKOREA\b/i, asset: 'equity', countries: nurLand('South Korea') },
  { id: 'taiwan', label: 'MSCI Taiwan', match: /\bTAIWAN\b/i, asset: 'equity', countries: nurLand('Taiwan') },
  { id: 'brazil', label: 'MSCI Brazil', match: /\bBRAZIL\b|BRASILIEN/i, asset: 'equity', countries: nurLand('Brazil') },
  {
    id: 'canada',
    label: 'MSCI Canada',
    match: /\bCANADA\b|KANADA|\bTSX\b/i,
    asset: 'equity',
    countries: nurLand('Canada'),
    proxy: `${WORLD_PROXY}:CA`,
  },
  {
    id: 'australia',
    label: 'MSCI Australia',
    match: /AUSTRALIA|AUSTRALIEN|\bASX\b/i,
    asset: 'equity',
    countries: nurLand('Australia'),
    proxy: `${WORLD_PROXY}:AU`,
  },
  {
    id: 'usa',
    label: 'MSCI USA',
    match: /\bUSA\b|\bU\.S\.|\bUS\b|UNITED STATES|AMERICA|RUSSELL|DOW JONES/i,
    asset: 'equity',
    countries: nurLand('United States'),
    sectors: US_SECTORS,
    proxy: `${WORLD_PROXY}:US`,
  },
  {
    id: 'world',
    label: 'MSCI World',
    match: /\bWORLD\b|\bWELT\b|DEVELOPED|\bGLOBAL\b|INTERNATIONAL/i,
    asset: 'equity',
    countries: WORLD_COUNTRIES,
    sectors: WORLD_SECTORS,
    proxy: WORLD_PROXY,
  },
]

const NACH_ID: ReadonlyMap<IndexId, IndexTemplate> = new Map(INDEX_TEMPLATES.map((t) => [t.id, t]))

export function indexTemplate(id: string): IndexTemplate | null {
  return NACH_ID.get(id as IndexId) ?? null
}

/** Branchen-Fonds: der Name nennt die Branche, der Index die Region. */
const BRANCHEN: readonly (readonly [RegExp, string])[] = [
  [/SEMICONDUCTOR|HALBLEITER|INFORMATION TECHNOLOGY|\bTECHNOLOGY\b|\bSOFTWARE\b|CYBER\s?SECURITY/i, 'Information Technology'],
  [/HEALTH\s?CARE|GESUNDHEIT|PHARMA|BIOTECH/i, 'Health Care'],
  [/FINANCIALS|\bBANKS?\b|\bBANKEN\b|INSURANCE|VERSICHERUNG/i, 'Financials'],
  [/(?<!CLEAN |RENEWABLE |NEW )\bENERGY\b|\bENERGIE\b|OIL & GAS/i, 'Energy'],
  [/UTILITIES|VERSORGER/i, 'Utilities'],
  [/REAL ESTATE|\bREITS?\b|PROPERTY|IMMOBILIEN/i, 'Real Estate'],
  [/CONSUMER DISCRETIONARY/i, 'Consumer Discretionary'],
  [/CONSUMER STAPLES/i, 'Consumer Staples'],
  [/INDUSTRIALS|DEFEN[CS]E|AEROSPACE|RÜSTUNG/i, 'Industrials'],
  [/MATERIALS|GRUNDSTOFF|\bMINERS?\b|\bMINING\b/i, 'Materials'],
  [/COMMUNICATION SERVICES|TELECOM/i, 'Communication Services'],
]

export type SizeHint = 'small' | 'mid'

export interface IndexMatch {
  /** null: nur eine Branche erkannt, keine Region. */
  readonly template: IndexTemplate | null
  /** GICS-Sektor aus dem Namen - ersetzt die Branchenmischung des Index. */
  readonly sector: string | null
  /** Nebenwerte-Fonds: die Größe steht im Namen, nicht im Index. */
  readonly size: SizeHint | null
}

/**
 * Index, Branche und Größe aus einem Fondsnamen; null, wenn nichts davon passt.
 *
 * Rohstoff-Produkte, die als ETF geführt werden ("Silver 3x"), landen beim
 * Rohstoff-Index - sie sind kein Aktienfonds, auch wenn der Typ es sagt.
 */
export function matchIndex(name: string): IndexMatch | null {
  const size: SizeHint | null = /SMALL[\s-]?CAP/i.test(name) ? 'small' : /MID[\s-]?CAP/i.test(name) ? 'mid' : null
  if (kindFromName(name) === 'etc') return { template: NACH_ID.get('commodities') ?? null, sector: null, size: null }
  const template = INDEX_TEMPLATES.find((t) => t.match.test(name)) ?? null
  const sector =
    template && template.asset !== 'equity' ? null : (BRANCHEN.find(([muster]) => muster.test(name))?.[1] ?? null)
  if (!template && !sector) return null
  return { template, sector, size }
}

/** Gewichte auf 1 normieren - die Tabellen sind gerundet und summieren nicht genau. */
export function normalized(weights: Readonly<Record<string, number>>): [string, number][] {
  const summe = Object.values(weights).reduce((s, v) => s + Math.max(0, v), 0)
  return summe > 0 ? Object.entries(weights).map(([k, v]) => [k, Math.max(0, v) / summe]) : []
}
