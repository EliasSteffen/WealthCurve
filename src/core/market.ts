/**
 * Kursreihen - die reine Umrechnung, ohne Netz und ohne Datei.
 *
 * Zwei Wege führen zu denselben Daten: der Abruf über eine Serverfunktion und
 * der Import einer Datei im Browser. Beide enden hier, damit eine importierte
 * Reihe exakt so gerechnet wird wie eine abgerufene - sonst hinge die Aussage
 * eines Videos davon ab, woher die Kurse kamen.
 */
import type { MarketSeries } from './domain/types.ts'

/** Eng gefasst: nur Zeichen, die in Tickern vorkommen. */
const SYMBOL_MUSTER = /^[A-Z0-9.^=-]{1,20}$/

/**
 * Prüft ein Symbol, bevor es in eine URL an einen fremden Dienst wandert.
 *
 * Nimmt auch `string[]`, weil Query-Parameter mehrfach vorkommen können.
 */
export function normalizeSymbol(roh: unknown): string | null {
  const wert = Array.isArray(roh) ? roh[0] : roh
  if (typeof wert !== 'string') return null
  const symbol = wert.trim().toUpperCase()
  return SYMBOL_MUSTER.test(symbol) ? symbol : null
}

/** Kurse in Monatsrenditen umrechnen; Lücken werden übersprungen. */
export function toMonthlyReturns(kurse: readonly (number | null)[]): number[] {
  const renditen: number[] = []
  let vorher: number | null = null
  for (const kurs of kurse) {
    if (typeof kurs !== 'number' || !Number.isFinite(kurs) || kurs <= 0) continue
    if (vorher !== null) renditen.push(kurs / vorher - 1)
    vorher = kurs
  }
  return renditen
}

/** Unter einem Jahr ist keine sinnvolle Aussage möglich. */
export const MIN_MONATE = 12

export interface PreisPunkt {
  /** ISO-Datum, z. B. "1994-01-01". */
  readonly date: string
  readonly price: number | null
}

export interface MarketMeta {
  readonly symbol: string
  readonly name?: string
  readonly currency?: string
}

const MONAT = /^(\d{4}-\d{2})/
const brauchbar = (kurs: number | null): boolean =>
  typeof kurs === 'number' && Number.isFinite(kurs) && kurs > 0

/**
 * Ein Kurs pro Kalendermonat - der letzte brauchbare.
 *
 * Yahoo hängt an die Monatszeilen eine für heute an, im selben Monat wie die
 * letzte (`…-10-01` und `…-10-22`). Doppelt gezählt wäre das ein Monat mit 0 %
 * Rendite, und jede Kurve liefe einen Monat zu lang. Tageskurse aus einer Datei
 * werden so ebenfalls zu Monatskursen. Zeilen ohne lesbares Datum bleiben, wie
 * sie sind.
 */
export function einKursProMonat(punkte: readonly PreisPunkt[]): PreisPunkt[] {
  const ergebnis: PreisPunkt[] = []
  for (const punkt of punkte) {
    const monat = MONAT.exec(punkt.date)?.[1]
    const vorher = ergebnis[ergebnis.length - 1]
    if (monat === undefined || vorher === undefined || MONAT.exec(vorher.date)?.[1] !== monat) {
      ergebnis.push(punkt)
    } else if (brauchbar(punkt.price)) {
      // Ein späterer Kurs ersetzt den früheren, eine spätere Lücke nicht.
      ergebnis[ergebnis.length - 1] = punkt
    }
  }
  return ergebnis
}

export function marketFromPrices(
  roh: readonly PreisPunkt[],
  meta: MarketMeta,
): MarketSeries | null {
  const punkte = einKursProMonat(roh)
  const monthlyReturns = toMonthlyReturns(punkte.map((p) => p.price))
  if (monthlyReturns.length < MIN_MONATE) return null

  // Der Start ist der erste BRAUCHBARE Kurs, nicht die erste Zeile: führende
  // Lücken zählen nicht als Historie.
  const ersterGueltiger = punkte.find(
    (p) => typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0,
  )
  return {
    symbol: meta.symbol,
    name: meta.name?.trim() || meta.symbol,
    currency: meta.currency ?? 'USD',
    start: ersterGueltiger?.date || 'unbekannt',
    monthlyReturns,
  }
}

/* ------------------------------------------------------------------- Import */

const ZAHL = /^-?\d+(?:[.,]\d+)?$/

/** "1.234,56" und "1234.56" meinen dasselbe - je nach Herkunft der Datei. */
function zuZahl(roh: string): number | null {
  const text = roh.trim().replace(/["']/g, '')
  if (!text) return null
  // Deutsches Format erkennen: Komma als Dezimaltrenner, Punkt als Tausender.
  const normalisiert = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  if (!ZAHL.test(normalisiert)) return null
  const wert = Number(normalisiert)
  return Number.isFinite(wert) ? wert : null
}

const DATUM_SPALTEN = ['date', 'datum', 'zeit', 'time', 'monat']
const KURS_SPALTEN = ['adjclose', 'adj close', 'close', 'kurs', 'price', 'preis', 'schluss']

function spalteFinden(kopf: readonly string[], kandidaten: readonly string[]): number {
  for (const kandidat of kandidaten) {
    const index = kopf.indexOf(kandidat)
    if (index !== -1) return index
  }
  return -1
}

/**
 * CSV mit Datums- und Kursspalte.
 *
 * Bewusst nachsichtig bei Trennzeichen und Spaltennamen: die Datei kommt aus
 * einem fremden Werkzeug, und eine Fehlermeldung über ein Semikolon hilft
 * niemandem weiter.
 */
function ausCsv(text: string, symbol: string): MarketSeries | null {
  const zeilen = text.split(/\r?\n/).filter((z) => z.trim().length > 0)
  if (zeilen.length < 2) return null

  const semikolon = zeilen[0].match(/;/g)?.length ?? 0
  const komma = zeilen[0].match(/,/g)?.length ?? 0
  const trenner = semikolon > komma ? ';' : ','

  const kopf = zeilen[0].split(trenner).map((s) => s.trim().toLowerCase().replace(/["']/g, ''))
  const datumIndex = spalteFinden(kopf, DATUM_SPALTEN)
  const kursIndex = spalteFinden(kopf, KURS_SPALTEN)
  if (kursIndex === -1) return null

  const punkte: PreisPunkt[] = zeilen.slice(1).map((zeile) => {
    const felder = zeile.split(trenner)
    return {
      date: datumIndex === -1 ? '' : (felder[datumIndex] ?? '').trim().replace(/["']/g, ''),
      price: zuZahl(felder[kursIndex] ?? ''),
    }
  })
  return marketFromPrices(punkte, { symbol })
}

interface RohPunkt {
  readonly date?: unknown
  readonly adjclose?: unknown
  readonly close?: unknown
  readonly price?: unknown
}

function ausJson(text: string, symbol: string): MarketSeries | null {
  let geparst: unknown
  try {
    geparst = JSON.parse(text)
  } catch {
    return null
  }

  // Eine bereits fertige Reihe - so, wie die Serverfunktion sie ausliefert.
  if (
    geparst !== null &&
    typeof geparst === 'object' &&
    Array.isArray((geparst as MarketSeries).monthlyReturns)
  ) {
    const reihe = geparst as MarketSeries
    const renditen = reihe.monthlyReturns.filter(
      (r): r is number => typeof r === 'number' && Number.isFinite(r),
    )
    if (renditen.length < MIN_MONATE) return null
    return {
      symbol: typeof reihe.symbol === 'string' ? reihe.symbol : symbol,
      name: typeof reihe.name === 'string' ? reihe.name : symbol,
      currency: typeof reihe.currency === 'string' ? reihe.currency : 'USD',
      start: typeof reihe.start === 'string' ? reihe.start : 'unbekannt',
      monthlyReturns: renditen,
    }
  }

  if (!Array.isArray(geparst)) return null
  const punkte = (geparst as RohPunkt[]).map((p) => {
    const roh = p?.adjclose ?? p?.close ?? p?.price
    const preis = typeof roh === 'number' ? roh : typeof roh === 'string' ? zuZahl(roh) : null
    return { date: typeof p?.date === 'string' ? p.date.slice(0, 10) : '', price: preis }
  })
  return marketFromPrices(punkte, { symbol })
}

/**
 * Liest eine Kursdatei.
 *
 * Der Dateiname liefert das Symbol - er ist das Einzige, was über die Herkunft
 * bekannt ist, und "AAPL.csv" ist die naheliegende Benennung.
 */
export function parseMarketFile(text: string, dateiname: string): MarketSeries | null {
  const basis = dateiname.replace(/\.[^.]+$/, '').split(/[/\\]/).pop() ?? ''
  const symbol = normalizeSymbol(basis) ?? 'IMPORT'
  const getrimmt = text.trimStart()
  return getrimmt.startsWith('{') || getrimmt.startsWith('[')
    ? ausJson(text, symbol)
    : ausCsv(text, symbol)
}
