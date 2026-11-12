/**
 * Firmenprofile für Einzelaktien: Land, Branche, Börsenwert.
 *
 * Gleiche Form wie `holdings.ts`: `fetchProfiles` kennt kein HTTP, erst die
 * Adapter (Vite-Middleware, `scripts/serve.ts`, `api/profile.ts`) tun das.
 *
 * Die Durchschau kannte Aktien bisher nur aus Fondsbeständen. Stand eine Aktie
 * in keinem geladenen Fonds - oder lud gar keiner -, zählte sie als
 * "Unbekannt". Yahoo kennt Sitzland und Branche jeder Notierung, auch der
 * deutschen (NVD.DE): das reicht für Länder, Kontinente, Branchen und Größe.
 *
 * Yahoos Branchen heißen etwas anders als GICS ("Consumer Cyclical" statt
 * "Consumer Discretionary") und werden hier übersetzt. Der Börsenwert kommt in
 * der Handelswährung und wird für die Größenklassen in US-Dollar umgerechnet.
 */
import YahooFinance from 'yahoo-finance2'
import type { StockProfile } from '../src/core/depot/types.ts'

export type ProfilErgebnis =
  | { readonly ok: true; readonly daten: readonly StockProfile[] }
  | { readonly ok: false; readonly fehler: { readonly status: number; readonly error: string } }

const SYMBOL = /^[A-Z0-9.^=-]{1,20}$/
export const MAX_SYMBOLE = 50
/** So viele Profile gleichzeitig - Yahoo drosselt sonst. */
const GLEICHZEITIG = 5

const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

/** Profile ändern sich selten; einen Tag im Edge-Cache wie die Fondsbestände. */
export const CACHE_HEADER = 's-maxage=86400, stale-while-revalidate=604800'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 500
const gemerkt = new Map<string, { readonly bis: number; readonly daten: StockProfile }>()

/** Yahoo-Branche -> GICS-Sektor, wie ihn die Fondsdaten führen. */
export const YAHOO_SEKTOR: Readonly<Record<string, string>> = {
  Technology: 'Information Technology',
  'Communication Services': 'Communication Services',
  'Consumer Cyclical': 'Consumer Discretionary',
  'Consumer Defensive': 'Consumer Staples',
  'Financial Services': 'Financials',
  Healthcare: 'Health Care',
  Industrials: 'Industrials',
  'Basic Materials': 'Materials',
  Energy: 'Energy',
  Utilities: 'Utilities',
  'Real Estate': 'Real Estate',
}

/** Unterwährungen (Pence, Agorot, Cent) -> Währung und Faktor. */
const UNTERWAEHRUNG: Readonly<Record<string, readonly [string, number]>> = {
  GBp: ['GBP', 0.01],
  GBX: ['GBP', 0.01],
  ILA: ['ILS', 0.01],
  ZAc: ['ZAR', 0.01],
}

export function normalizeSymbols(roh: unknown): string[] {
  const werte = (Array.isArray(roh) ? roh : [roh]).filter((w): w is string => typeof w === 'string')
  const symbole = werte
    .flatMap((w) => w.split(','))
    .map((w) => w.trim().toUpperCase())
    .filter((w) => SYMBOL.test(w))
  return [...new Set(symbole)].slice(0, MAX_SYMBOLE)
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const zahl = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
const feld = (o: unknown, key: string): unknown =>
  typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[key] : undefined

interface Roh {
  readonly symbol: string
  readonly name: string | null
  readonly country: string | null
  readonly sector: string | null
  readonly currency: string | null
  readonly cap: number | null
}

async function rohprofil(symbol: string): Promise<Roh | null> {
  try {
    const antwort = await yahoo.quoteSummary(
      symbol,
      { modules: ['assetProfile', 'price'] },
      { validateResult: false },
    )
    const profil = feld(antwort, 'assetProfile')
    const preis = feld(antwort, 'price')
    const sektor = text(feld(profil, 'sector'))
    return {
      symbol,
      name: text(feld(preis, 'longName')) ?? text(feld(preis, 'shortName')),
      country: text(feld(profil, 'country')),
      sector: sektor ? (YAHOO_SEKTOR[sektor] ?? sektor) : null,
      currency: text(feld(preis, 'currency')),
      cap: zahl(feld(preis, 'marketCap')),
    }
  } catch {
    return null
  }
}

/** Kurs Währung -> US-Dollar; fehlt er, bleibt die Größe offen, der Rest nicht. */
async function dollarKurse(waehrungen: readonly string[]): Promise<Map<string, number>> {
  const kurse = new Map<string, number>([['USD', 1]])
  const offen = waehrungen.filter((w) => w !== 'USD')
  if (offen.length === 0) return kurse
  try {
    const antwort = (await yahoo.quote(offen.map((w) => `${w}USD=X`))) as unknown
    for (const q of Array.isArray(antwort) ? antwort : [antwort]) {
      const symbol = text(feld(q, 'symbol'))
      const kurs = zahl(feld(q, 'regularMarketPrice'))
      if (symbol && kurs) kurse.set(symbol.slice(0, 3), kurs)
    }
  } catch {
    // Ohne Devisenkurse keine Größenklasse für diese Aktien - Land und Branche bleiben.
  }
  return kurse
}

async function ladeProfile(symbole: readonly string[]): Promise<StockProfile[]> {
  const roh: Roh[] = []
  for (let i = 0; i < symbole.length; i += GLEICHZEITIG) {
    const teil = await Promise.all(symbole.slice(i, i + GLEICHZEITIG).map(rohprofil))
    for (const r of teil) if (r) roh.push(r)
  }
  const waehrung = (c: string | null) => (c ? (UNTERWAEHRUNG[c] ?? [c, 1]) : null)
  const kurse = await dollarKurse([
    ...new Set(roh.flatMap((r) => (r.cap ? [waehrung(r.currency)?.[0] ?? 'USD'] : []))),
  ])
  return roh.map((r) => {
    const [cur, faktor] = waehrung(r.currency) ?? ['USD', 1]
    const kurs = kurse.get(cur)
    return {
      symbol: r.symbol,
      name: r.name,
      country: r.country,
      sector: r.sector,
      currency: cur,
      capUsd: r.cap && kurs ? r.cap * faktor * kurs : null,
    }
  })
}

function ausCache(symbol: string): StockProfile | undefined {
  const eintrag = gemerkt.get(symbol)
  if (!eintrag) return undefined
  if (eintrag.bis <= Date.now()) {
    gemerkt.delete(symbol)
    return undefined
  }
  return eintrag.daten
}

function inCache(daten: StockProfile): void {
  gemerkt.delete(daten.symbol)
  gemerkt.set(daten.symbol, { bis: Date.now() + CACHE_TTL_MS, daten })
  while (gemerkt.size > CACHE_MAX) {
    const aeltester = gemerkt.keys().next().value
    if (aeltester === undefined) break
    gemerkt.delete(aeltester)
  }
}

/** Profile je Symbol; Symbole, zu denen Yahoo nichts weiß, fehlen in der Antwort. */
export async function fetchProfiles(roh: unknown): Promise<ProfilErgebnis> {
  const symbole = normalizeSymbols(roh)
  if (symbole.length === 0) return { ok: false, fehler: { status: 400, error: 'Kein gültiges Symbol.' } }

  const gefunden = new Map<string, StockProfile>()
  const offen = symbole.filter((s) => {
    const treffer = ausCache(s)
    if (treffer) gefunden.set(s, treffer)
    return !treffer
  })
  for (const p of await ladeProfile(offen)) {
    gefunden.set(p.symbol, p)
    // Nur Brauchbares merken: ein leeres Profil kann morgen gefüllt sein.
    if (p.country || p.sector) inCache(p)
  }
  return { ok: true, daten: symbole.flatMap((s) => gefunden.get(s) ?? []) }
}

export interface ProfilAntwort {
  readonly status: number
  readonly body: unknown
  readonly cache: boolean
}

/** Für Adapter, die nur den angefragten Pfad kennen: `/api/profile?symbols=NVD.DE,AAPL`. */
export async function handleProfileRequest(url: string): Promise<ProfilAntwort> {
  const symbole = new URL(url, 'http://localhost').searchParams.getAll('symbols')
  const ergebnis = await fetchProfiles(symbole)
  return ergebnis.ok
    ? { status: 200, body: { results: ergebnis.daten }, cache: true }
    : { status: ergebnis.fehler.status, body: { error: ergebnis.fehler.error }, cache: false }
}
