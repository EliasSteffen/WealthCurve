/**
 * Depot - die Begriffe.
 *
 * Ein Depot ist hier eine Liste von Positionen mit Anteil, Kosten und Hebel.
 * Woher Kurse und Fondsbestände kommen, weiß dieser Teil nicht: Abruf und
 * Datei enden in denselben Typen, wie bei den Kursreihen.
 */

/** ETF/Fonds, Einzelaktie oder Rohstoff-ETC. */
export type HoldingKind = 'etf' | 'stock' | 'etc'
export const HOLDING_KINDS: readonly HoldingKind[] = ['etf', 'stock', 'etc']

export interface DepotHolding {
  /** WKN oder ISIN, wie eingefügt - zugleich der Schlüssel der Position. */
  readonly id: string
  readonly name: string
  /** Yahoo-Symbol für die Kurshistorie, z. B. "EUNL.DE". Leer: keine Kennzahlen. */
  readonly symbol: string
  /** Anteil am Depot, 0.12 = 12 %. */
  readonly weight: number
  /** Laufende Kosten p. a., 0.0012 = 0,12 %. */
  readonly ter: number
  /** 1 = ungehebelt, 2 = doppelt usw. */
  readonly leverage: number
  readonly kind: HoldingKind
  /**
   * Woher die Durchschau kommt.
   *
   * ETF: ISIN eines Amundi-Fonds, dessen Bestand gilt, optional mit Filter
   * ("IE000BI8OT95:US" = nur der US-Teil, ":EU" = Europa). Aktie: ihre ISIN.
   * ETC: der Rohstoff, z. B. "Gold".
   */
  readonly lookThrough: string
}

export interface DepotState {
  readonly holdings: readonly DepotHolding[]
  /** Alternative Anteile je Positions-ID für den Was-wäre-wenn-Vergleich. */
  readonly whatIf: Readonly<Record<string, number>> | null
}

export const EMPTY_DEPOT: DepotState = { holdings: [], whatIf: null }

/** Mehr Zeilen ergeben keine lesbare Analyse mehr - und kein Depot braucht sie. */
export const MAX_HOLDINGS = 50

/** Eine Position eines Fonds, so wie der Server sie liefert. */
export interface FundPosition {
  readonly isin: string | null
  readonly name: string
  readonly asset: 'equity' | 'cash'
  /** GICS-Sektor auf Englisch, z. B. "Information Technology"; leer, wenn unbekannt. */
  readonly sector: string
  /** Ländername auf Englisch laut Fonds ("country of risk"); leer, wenn unbekannt. */
  readonly country: string
  readonly currency: string
  /** Anteil am Fonds, 0.05 = 5 %. */
  readonly weight: number
  /** Geschätzte Streubesitz-Marktkapitalisierung in USD, falls ermittelbar. */
  readonly capUsd: number | null
}

export interface FundHoldings {
  readonly isin: string
  /** Stichtag des Bestands, ISO-Datum. */
  readonly date: string
  readonly positions: readonly FundPosition[]
}
