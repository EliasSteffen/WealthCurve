/**
 * Fondsbestände für die Depot-Durchschau - einmal geschrieben, überall einhängbar.
 *
 * Gleiche Form wie `quotes.ts`: `fetchFundHoldings` kennt kein HTTP, erst die
 * Adapter (Vite-Middleware, `scripts/serve.ts`, `api/holdings.ts`) tun das.
 *
 * Quelle ist die Produkt-Schnittstelle von Amundi, die ihre Bestände je ETF
 * veröffentlicht - mit ISIN, Gewicht, GICS-Sektor, Land und Währung. Der
 * Browser kann sie nicht direkt fragen (kein CORS), deshalb dieser Umweg.
 *
 * Die Marktkapitalisierung steht nicht darin. Sie wird geschätzt: in einem
 * nach Börsenwert gewichteten Index ist Gewicht x Indexsumme = Börsenwert. Die
 * Indexsumme folgt aus wenigen großen US-Werten, deren Börsenwert Yahoo kennt.
 */
import YahooFinance from 'yahoo-finance2'
import type { FundHoldings, FundPosition } from '../src/core/depot/types.ts'

export interface HoldingsFehler {
  readonly status: number
  readonly error: string
}

export type HoldingsErgebnis =
  | { readonly ok: true; readonly daten: FundHoldings }
  | { readonly ok: false; readonly fehler: HoldingsFehler }

const AMUNDI_API = 'https://www.amundietf.de/mapi/ProductAPI/getProductsData'
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/
/** Bloomberg-Kürzel einer US-Notierung, z. B. "AAPL UW" oder "BRK/B UN". */
const US_NOTIERUNG = /^([A-Z][A-Z0-9./]*) (UW|UN|UQ|UR|UA|UP|UV|US)$/
/** So viele große US-Werte eichen die Indexsumme; der Median dämpft gedeckelte Gewichte. */
const ANKER = 8

const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

/** Fondsbestände ändern sich täglich, nicht stündlich - wie bei den Kursen. */
export const CACHE_HEADER = 's-maxage=86400, stale-while-revalidate=604800'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 50
const gemerkt = new Map<string, { readonly bis: number; readonly daten: FundHoldings }>()
const laufend = new Map<string, Promise<HoldingsErgebnis>>()

export function normalizeIsin(roh: unknown): string | null {
  const wert = Array.isArray(roh) ? roh[0] : roh
  if (typeof wert !== 'string') return null
  const isin = wert.trim().toUpperCase()
  return ISIN.test(isin) ? isin : null
}

interface AmundiZeile {
  readonly date?: string | null
  readonly type?: string | null
  readonly isin?: string | null
  readonly name?: string | null
  readonly bbg?: string | null
  readonly weight?: number | null
  readonly currency?: string | null
  readonly sector?: string | null
  readonly countryOfRisk?: string | null
}

interface AmundiAntwort {
  readonly products?: readonly {
    readonly composition?: {
      readonly compositionData?: readonly { readonly compositionCharacteristics?: AmundiZeile }[]
    }
  }[]
}

async function amundiZeilen(isin: string): Promise<AmundiZeile[]> {
  const antwort = await fetch(AMUNDI_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      context: { countryCode: 'DEU', languageCode: 'en', userProfileName: 'INSTIT' },
      productIds: [isin],
      productType: 'PRODUCT',
      composition: {
        compositionFields: ['date', 'type', 'isin', 'name', 'bbg', 'weight', 'currency', 'sector', 'countryOfRisk'],
      },
    }),
  })
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`)
  const json = (await antwort.json()) as AmundiAntwort
  const daten = json.products?.[0]?.composition?.compositionData ?? []
  return daten
    .map((d) => d.compositionCharacteristics ?? {})
    .filter((z) => typeof z.weight === 'number' && Number.isFinite(z.weight))
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Indexsumme in USD aus den größten US-Positionen; null, wenn Yahoo nichts liefert. */
async function indexSumme(zeilen: readonly AmundiZeile[]): Promise<number | null> {
  const anker = zeilen
    .flatMap((z) => {
      const treffer = US_NOTIERUNG.exec(z.bbg ?? '')
      return treffer && z.weight && z.weight > 0 ? [{ symbol: treffer[1].replace('/', '-'), weight: z.weight }] : []
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, ANKER)
  const antworten = await Promise.allSettled(anker.map((a) => yahoo.quote(a.symbol)))
  const verhaeltnisse = antworten.flatMap((r, i) => {
    if (r.status !== 'fulfilled') return []
    const cap = (r.value as unknown as { marketCap?: number }).marketCap
    return typeof cap === 'number' && cap > 0 ? [cap / anker[i].weight] : []
  })
  return verhaeltnisse.length > 0 ? median(verhaeltnisse) : null
}

async function ladeBestand(isin: string): Promise<HoldingsErgebnis> {
  let zeilen: AmundiZeile[]
  try {
    zeilen = await amundiZeilen(isin)
  } catch {
    return { ok: false, fehler: { status: 502, error: 'Der Fondsanbieter ist nicht erreichbar.' } }
  }
  if (zeilen.length === 0) {
    return { ok: false, fehler: { status: 404, error: `Keine Bestände für "${isin}" (nur Amundi-ETFs).` } }
  }

  let summe: number | null = null
  try {
    summe = await indexSumme(zeilen)
  } catch {
    // Ohne Börsenwerte bleibt die Größenklasse offen - der Rest der Durchschau nicht.
  }

  const positions = zeilen.map((z): FundPosition => {
    const bar = z.type === 'CASH' || z.type === 'FUTURE'
    const weight = z.weight as number
    return {
      isin: z.isin?.trim() || null,
      name: bar ? 'Cash' : z.name?.trim() || z.isin || '?',
      asset: bar ? 'cash' : 'equity',
      sector: bar ? '' : z.sector?.trim() || '',
      country: bar ? '' : z.countryOfRisk?.trim() || '',
      currency: z.currency?.trim() || '',
      weight,
      capUsd: !bar && summe !== null && weight > 0 ? weight * summe : null,
    }
  })
  const date = zeilen.find((z) => z.date)?.date ?? ''
  return { ok: true, daten: { isin, date, positions } }
}

function ausCache(isin: string): FundHoldings | undefined {
  const eintrag = gemerkt.get(isin)
  if (!eintrag) return undefined
  if (eintrag.bis <= Date.now()) {
    gemerkt.delete(isin)
    return undefined
  }
  return eintrag.daten
}

function inCache(isin: string, daten: FundHoldings): void {
  gemerkt.delete(isin)
  gemerkt.set(isin, { bis: Date.now() + CACHE_TTL_MS, daten })
  while (gemerkt.size > CACHE_MAX) {
    const aeltester = gemerkt.keys().next().value
    if (aeltester === undefined) break
    gemerkt.delete(aeltester)
  }
}

export async function fetchFundHoldings(rohIsin: unknown): Promise<HoldingsErgebnis> {
  const isin = normalizeIsin(rohIsin)
  if (!isin) return { ok: false, fehler: { status: 400, error: 'Ungültige ISIN.' } }

  const treffer = ausCache(isin)
  if (treffer) return { ok: true, daten: treffer }

  const unterwegs = laufend.get(isin)
  if (unterwegs) return unterwegs

  const abruf = ladeBestand(isin)
    .then((ergebnis) => {
      if (ergebnis.ok) inCache(isin, ergebnis.daten)
      return ergebnis
    })
    .finally(() => laufend.delete(isin))
  laufend.set(isin, abruf)
  return abruf
}

export interface HoldingsAntwort {
  readonly status: number
  readonly body: unknown
  readonly cache: boolean
}

/** Für Adapter, die nur den angefragten Pfad kennen. */
export async function handleHoldingsRequest(url: string): Promise<HoldingsAntwort> {
  const isin = new URL(url, 'http://localhost').searchParams.get('isin')
  const ergebnis = await fetchFundHoldings(isin)
  return ergebnis.ok
    ? { status: 200, body: ergebnis.daten, cache: true }
    : { status: ergebnis.fehler.status, body: { error: ergebnis.fehler.error }, cache: false }
}
