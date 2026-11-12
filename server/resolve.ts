/**
 * Kennung (ISIN oder WKN) -> Yahoo-Symbol, für Depots ohne Symbol-Spalte.
 *
 * Broker-Exporte kennen ISIN und Wert, aber kein Yahoo-Symbol - ohne das gibt
 * es keine Kurshistorie und damit keine Kennzahlen. Zwei Quellen:
 *
 *   1. OpenFIGI (offene Zuordnung von Bloomberg): alle Notierungen einer ISIN
 *      oder WKN mit Börse und Ticker. Aus der Börse folgt die Yahoo-Endung.
 *   2. Die Yahoo-Suche, falls OpenFIGI nichts kennt - sie findet meist nur eine
 *      Notierung, oft nicht in Euro, aber besser als keine.
 *
 * Euro-Börsen gehen vor (Xetra zuerst): dort ist die Historie meist lang und
 * die Umrechnung entfällt. Gewählt wird der erste Kandidat, für den Yahoo
 * tatsächlich einen Kurs hat - ein geratenes Symbol wäre schlimmer als keins.
 */
import YahooFinance from 'yahoo-finance2'

export interface Aufloesung {
  readonly id: string
  readonly symbol: string | null
  readonly name: string | null
  readonly currency: string | null
}

export type AufloesungsErgebnis =
  | { readonly ok: true; readonly daten: readonly Aufloesung[] }
  | { readonly ok: false; readonly fehler: { readonly status: number; readonly error: string } }

const OPENFIGI = 'https://api.openfigi.com/v3/mapping'
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/
const WKN = /^[A-Z0-9]{6}$/
const SYMBOL = /^[A-Z0-9.^=-]{1,20}$/
export const MAX_KENNUNGEN = 50
/** Mehr Kandidaten je Kennung bringen kaum Treffer, nur längere Yahoo-Abfragen. */
const KANDIDATEN_JE_KENNUNG = 4

/** Bloomberg-Börsenkürzel -> Yahoo-Endung. */
const BOERSE: Readonly<Record<string, string>> = {
  GY: '.DE',
  GR: '.DE',
  GF: '.F',
  GS: '.SG',
  GD: '.DU',
  GM: '.MU',
  GB: '.BE',
  GH: '.HM',
  GI: '.HA',
  FP: '.PA',
  NA: '.AS',
  IM: '.MI',
  SW: '.SW',
  SE: '.SW',
  LN: '.L',
  US: '',
}
/** Deutsche Plätze: der Ticker gilt meist auch auf Xetra, auch wenn OpenFIGI Xetra nicht nennt. */
const DEUTSCH = new Set(['GY', 'GR', 'GF', 'GS', 'GD', 'GM', 'GB', 'GH', 'GI'])
const VORRANG = ['.DE', '.F', '.SG', '.PA', '.AS', '.MI', '.DU', '.MU', '.BE', '.HM', '.HA', '.SW', '.L', '']

const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

/** Zuordnungen ändern sich selten - eine Woche im Edge-Cache. */
export const CACHE_HEADER = 's-maxage=604800, stale-while-revalidate=2592000'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_MAX = 500
const gemerkt = new Map<string, { readonly bis: number; readonly daten: Aufloesung }>()

export function normalizeIds(roh: unknown): string[] {
  const werte = (Array.isArray(roh) ? roh : [roh]).filter((w): w is string => typeof w === 'string')
  const ids = werte
    .flatMap((w) => w.split(','))
    .map((w) => w.trim().toUpperCase())
    .filter((w) => ISIN.test(w) || WKN.test(w))
  return [...new Set(ids)].slice(0, MAX_KENNUNGEN)
}

const endung = (symbol: string) => /\.[A-Z]{1,3}$/.exec(symbol)?.[0] ?? ''

/** Kandidaten nach Börsenvorrang, bei Gleichstand in der Reihenfolge der Quelle. */
export function ordne(kandidaten: readonly string[]): string[] {
  const rang = (s: string) => {
    const i = VORRANG.indexOf(endung(s))
    return i === -1 ? VORRANG.length : i
  }
  return [...new Set(kandidaten)]
    .filter((s) => SYMBOL.test(s))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rang(a.s) - rang(b.s) || a.i - b.i)
    .map((x) => x.s)
}

interface FigiTreffer {
  readonly ticker?: string
  readonly exchCode?: string
}

async function openFigi(ids: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  // Ohne Schlüssel nimmt OpenFIGI zehn Kennungen je Anfrage.
  for (let i = 0; i < ids.length; i += 10) {
    const teil = ids.slice(i, i + 10)
    try {
      const antwort = await fetch(OPENFIGI, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          teil.map((id) => ({ idType: ISIN.test(id) ? 'ID_ISIN' : 'ID_WERTPAPIER', idValue: id })),
        ),
      })
      if (!antwort.ok) continue
      const json = (await antwort.json()) as readonly { readonly data?: readonly FigiTreffer[] }[]
      json.forEach((eintrag, k) => {
        const kandidaten: string[] = []
        for (const d of eintrag.data ?? []) {
          if (!d.ticker || !d.exchCode || BOERSE[d.exchCode] === undefined) continue
          const ticker = d.ticker.trim().toUpperCase().replace('/', '-')
          if (DEUTSCH.has(d.exchCode)) kandidaten.push(`${ticker}.DE`)
          kandidaten.push(ticker + BOERSE[d.exchCode])
        }
        const id = teil[k]
        if (id !== undefined) out.set(id, kandidaten)
      })
    } catch {
      // OpenFIGI ist eine von zwei Quellen - ohne sie bleibt die Yahoo-Suche.
    }
  }
  return out
}

async function yahooSuche(isin: string): Promise<string[]> {
  try {
    const ergebnis = await yahoo.search(isin, { quotesCount: 6, newsCount: 0 })
    return (ergebnis.quotes as readonly unknown[]).flatMap((q) => {
      const treffer = q as { symbol?: unknown; isYahooFinance?: unknown }
      return typeof treffer.symbol === 'string' && treffer.isYahooFinance === true ? [treffer.symbol] : []
    })
  } catch {
    return []
  }
}

interface Kurs {
  readonly symbol?: string
  readonly regularMarketPrice?: number
  readonly longName?: string
  readonly shortName?: string
  readonly currency?: string
}

/** Welche Kandidaten Yahoo wirklich kennt - unbekannte fehlen in der Antwort. */
async function pruefe(symbole: readonly string[]): Promise<Map<string, Kurs>> {
  const gueltig = new Map<string, Kurs>()
  for (let i = 0; i < symbole.length; i += 50) {
    try {
      const kurse = (await yahoo.quote(symbole.slice(i, i + 50))) as unknown as readonly Kurs[]
      for (const k of kurse) {
        if (k.symbol && typeof k.regularMarketPrice === 'number' && k.regularMarketPrice > 0) {
          gueltig.set(k.symbol, k)
        }
      }
    } catch {
      // Ein Fehler hier heißt nur: diese Kandidaten bleiben unbestätigt.
    }
  }
  return gueltig
}

function ausCache(id: string): Aufloesung | undefined {
  const eintrag = gemerkt.get(id)
  if (!eintrag) return undefined
  if (eintrag.bis <= Date.now()) {
    gemerkt.delete(id)
    return undefined
  }
  return eintrag.daten
}

function inCache(daten: Aufloesung): void {
  gemerkt.delete(daten.id)
  gemerkt.set(daten.id, { bis: Date.now() + CACHE_TTL_MS, daten })
  while (gemerkt.size > CACHE_MAX) {
    const aeltester = gemerkt.keys().next().value
    if (aeltester === undefined) break
    gemerkt.delete(aeltester)
  }
}

export async function resolveIds(roh: unknown): Promise<AufloesungsErgebnis> {
  const ids = normalizeIds(roh)
  if (ids.length === 0) {
    return { ok: false, fehler: { status: 400, error: 'Keine gültige ISIN oder WKN.' } }
  }

  const ergebnis = new Map<string, Aufloesung>()
  const offen = ids.filter((id) => {
    const treffer = ausCache(id)
    if (treffer) ergebnis.set(id, treffer)
    return !treffer
  })

  if (offen.length > 0) {
    const figi = await openFigi(offen)
    const kandidaten = new Map<string, string[]>()
    for (const id of offen) {
      let liste = figi.get(id) ?? []
      if (liste.length === 0 && ISIN.test(id)) liste = await yahooSuche(id)
      kandidaten.set(id, ordne(liste).slice(0, KANDIDATEN_JE_KENNUNG))
    }
    const gueltig = await pruefe([...new Set([...kandidaten.values()].flat())])
    for (const id of offen) {
      const symbol = kandidaten.get(id)?.find((s) => gueltig.has(s)) ?? null
      const kurs = symbol ? gueltig.get(symbol) : undefined
      const daten: Aufloesung = {
        id,
        symbol,
        name: kurs?.longName ?? kurs?.shortName ?? null,
        currency: kurs?.currency ?? null,
      }
      ergebnis.set(id, daten)
      // Nur Treffer merken: ein heute unbekanntes Symbol kann morgen gelistet sein.
      if (symbol) inCache(daten)
    }
  }

  return { ok: true, daten: ids.map((id) => ergebnis.get(id) as Aufloesung) }
}

export interface AufloesungsAntwort {
  readonly status: number
  readonly body: unknown
  readonly cache: boolean
}

/** Für Adapter, die nur den angefragten Pfad kennen: `/api/resolve?ids=ISIN,WKN,…`. */
export async function handleResolveRequest(url: string): Promise<AufloesungsAntwort> {
  const ids = new URL(url, 'http://localhost').searchParams.getAll('ids')
  const ergebnis = await resolveIds(ids)
  return ergebnis.ok
    ? { status: 200, body: { results: ergebnis.daten }, cache: true }
    : { status: ergebnis.fehler.status, body: { error: ergebnis.fehler.error }, cache: false }
}
