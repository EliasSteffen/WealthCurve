/**
 * Was der Name eines Wertpapiers verrät: Produktart, Hebel, Rohstoff.
 *
 * Broker-Exporte nennen oft nur WKN und Wert. Den Namen liefert dann erst die
 * Symbolsuche - und mit ihm Hinweise, die der Import nicht kannte: "WisdomTree
 * Silver 3x Daily Leveraged" ist ein ETC mit dreifachem Hebel, kein ETF.
 */
import type { DepotHolding, HoldingKind } from './types.ts'

/** Rohstoffwörter -> Rohstoffname für die Durchschau. */
const ROHSTOFFE: readonly (readonly [RegExp, string])[] = [
  [/\bGOLD\b/i, 'Gold'],
  [/\bSILVER\b|\bSILBER\b/i, 'Silver'],
  [/\bPLATIN(UM)?\b/i, 'Platinum'],
  [/\bPALLADIUM\b/i, 'Palladium'],
  [/\bBRENT\b|\bWTI\b|\bCRUDE\b|\bOIL\b|\bROHÖL\b/i, 'Oil'],
  [/\bCOPPER\b|\bKUPFER\b/i, 'Copper'],
  [/\bBITCOIN\b/i, 'Bitcoin'],
  [/\bETHEREUM\b/i, 'Ethereum'],
]

/** Fonds mit Rohstoff-Firmen sind Aktienfonds, keine Rohstoffe. */
const ROHSTOFF_AKTIEN = /\b(MINERS?|MINING|PRODUCERS?|EQUIT(Y|IES)|AKTIEN|COMPANIES)\b/i
const ETC_WORT = /\b(ETC|ETP|ETN)\b/i
/** Woran ein Rohstoffprodukt zu erkennen ist - "Barrick Gold" allein ist eine Aktie. */
const PRODUKT_WORT =
  /\b(PHYSICAL|PHYSISCH|XETRA-GOLD|EUWAX|BULLION|SECURITIES|LEVERAGED|DAILY|TRACKER|ZERTIFIKAT|ISHARES|XTRACKERS|AMUNDI|WISDOMTREE|INVESCO|VANECK|21SHARES|COINSHARES|BOERSE|BÖRSE)\b/i
const ETF_WORT =
  /\b(ETF|UCITS|INDEX|MSCI|S&P|STOXX|FTSE|ISHARES|XTRACKERS|AMUNDI|LYXOR|VANGUARD|SPDR|INVESCO|VANECK|WISDOMTREE|FONDS|FUND)\b/i
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/

/** Rohstoff aus dem Namen, sofern es kein Fonds mit Rohstoff-Aktien ist. */
export function commodityFromName(name: string): string | null {
  if (ROHSTOFF_AKTIEN.test(name)) return null
  return ROHSTOFFE.find(([muster]) => muster.test(name))?.[1] ?? null
}

/** Produktart allein aus dem Namen; null, wenn er nichts Eindeutiges sagt. */
export function kindFromName(name: string): HoldingKind | null {
  if (ETC_WORT.test(name)) return 'etc'
  if (commodityFromName(name) !== null && PRODUKT_WORT.test(name)) return 'etc'
  if (ETF_WORT.test(name)) return 'etf'
  return null
}

/**
 * Hebel aus dem Namen: "3x Daily Leveraged", "2x Leveraged", "Faktor 4".
 *
 * Nur mit einem Wort, das Hebel meint - "1C" oder ein "x" in einer Abkürzung
 * sind keiner. Short-Produkte bleiben unberührt: ein negativer Hebel lässt sich
 * hier nicht abbilden, und ein falsches Vorzeichen wäre schlimmer als keins.
 */
export function leverageFromName(name: string): number | null {
  if (/\b(SHORT|INVERSE|BEAR)\b/i.test(name)) return null
  if (!/LEVERAGE|\bLEV\b|\bDAILY\b|\bHEBEL|\bFAKTOR\b|\bLONG\b|\bULTRA\b/i.test(name)) return null
  const treffer =
    /(?:^|[\s(-])(\d{1,2}(?:[.,]5)?)\s?[x×](?=$|[\s)-])/i.exec(name) ?? /\bFAKTOR\s?(\d{1,2})\b/i.exec(name)
  if (!treffer) return null
  const wert = Number(treffer[1].replace(',', '.'))
  return wert >= 1.5 && wert <= 10 ? wert : null
}

/** Was die Symbolsuche über die Produktart weiß (aus Yahoos "quoteType"). */
export type ResolvedType = 'etf' | 'stock' | null

type Patch = { kind?: HoldingKind; leverage?: number; lookThrough?: string }

function rohstoffPatch(h: DepotHolding, patch: Patch): void {
  const rohstoff = commodityFromName(h.name)
  if (rohstoff && (!h.lookThrough || ISIN.test(h.lookThrough))) patch.lookThrough = rohstoff
}

/**
 * Typ, Hebel und Rohstoff neu aus dem Namen - für Positionen, deren Name erst
 * die Symbolsuche geliefert hat. Was beim Import ohne Namen geraten war, weicht
 * dem, was Name und Yahoo sagen. Liefert nur, was sich ändern würde.
 */
export function inferredPatch(h: DepotHolding, type: ResolvedType = null): Partial<DepotHolding> {
  const patch: Patch = {}
  const ausName = kindFromName(h.name)
  // ETC-Belege im Namen schlagen Yahoo: Xetra-ETCs stehen dort oft als Aktie.
  const kind = ausName === 'etc' ? 'etc' : (type ?? ausName ?? h.kind)
  if (kind !== h.kind) patch.kind = kind
  const hebel = leverageFromName(h.name)
  if (hebel !== null && h.leverage === 1) patch.leverage = hebel
  if (kind === 'etc') rohstoffPatch(h, patch)
  return patch
}

/**
 * Positionen, deren Name ihren Angaben eindeutig widerspricht - ein ETC als ETF
 * geführt, ein "3x" ohne Hebel. Als Vorschlag für die Oberfläche, nicht still
 * übernommen: ein eingetragener Typ kann Absicht sein.
 */
export function holdingFixes(
  holdings: readonly DepotHolding[],
): { readonly id: string; readonly patch: Partial<DepotHolding> }[] {
  return holdings.flatMap((h) => {
    const patch: Patch = {}
    if (kindFromName(h.name) === 'etc' && h.kind !== 'etc') {
      patch.kind = 'etc'
      rohstoffPatch(h, patch)
    }
    const hebel = leverageFromName(h.name)
    if (hebel !== null && h.leverage === 1) patch.leverage = hebel
    return Object.keys(patch).length > 0 ? [{ id: h.id, patch }] : []
  })
}
