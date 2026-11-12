/**
 * Depot aus einer eingefügten Tabelle lesen - und wieder als Tabelle ausgeben.
 *
 * Der Weg ins Programm ist bewusst eine Tabelle: aus Excel kopierte Zellen
 * kommen als Tabulator-getrennter Text an, eine CSV-Datei genauso gut. Spalten
 * werden am Kopf erkannt, deutsch oder englisch, in beliebiger Reihenfolge.
 */
import { commodityFromName, inferredPatch, kindFromName, leverageFromName, type ResolvedType } from './classify.ts'
import { HOLDING_KINDS, MAX_HOLDINGS, type DepotHolding, type HoldingKind } from './types.ts'

export type ParseIssue =
  | { readonly code: 'noHeader' }
  | { readonly code: 'noRows' }
  | { readonly code: 'tooMany'; readonly max: number }
  | { readonly code: 'badWeight'; readonly line: number; readonly value: string }
  | { readonly code: 'badSymbol'; readonly line: number; readonly value: string }
  | { readonly code: 'duplicate'; readonly line: number; readonly value: string }

export interface ParseResult {
  readonly holdings: DepotHolding[]
  readonly issues: ParseIssue[]
  /** Summe der Positionswerte in Euro, wenn die Tabelle Werte statt Anteile führt. */
  readonly totalValue: number | null
}

/**
 * Spalten einer Depot-Tabelle.
 *
 * `value` ist der Positionswert aus Broker-Exporten (Euro statt Anteil) - die
 * Anteile folgen dann aus der Summe. `isin` liefert die Durchschau, wenn die
 * Tabelle WKN und ISIN getrennt führt.
 */
type Column = keyof DepotHolding | 'value' | 'isin'

const ALIASES: Readonly<Record<Column, readonly string[]>> = {
  id: ['wkn', 'isin', 'id', 'kennung'],
  name: ['name', 'bezeichnung', 'wertpapier', 'titel'],
  symbol: ['symbol', 'ticker', 'yahoo'],
  weight: ['anteil', 'gewicht', 'gewichtung', 'weight', 'allocation'],
  ter: ['ter', 'kosten', 'laufende kosten'],
  leverage: ['hebel', 'leverage'],
  kind: ['typ', 'art', 'kind', 'type'],
  lookThrough: ['durchschau', 'lookthrough', 'look-through', 'bestand', 'quelle'],
  value: [
    'wert',
    'marktwert',
    'kurswert',
    'positionswert',
    'gesamtwert',
    'betrag',
    'value',
    'market value',
    'netvalue',
    'net value',
  ],
  isin: ['isin'],
}

const KIND_WORDS: Readonly<Record<string, HoldingKind>> = {
  etf: 'etf',
  fonds: 'etf',
  fund: 'etf',
  aktie: 'stock',
  stock: 'stock',
  share: 'stock',
  etc: 'etc',
  etp: 'etc',
  etn: 'etc',
  rohstoff: 'etc',
  commodity: 'etc',
}

/** Summenzeilen am Tabellenende sind kein Wertpapier. */
const SUMMEN = new Set(['summe', 'sum', 'total', 'gesamt'])
const SYMBOL = /^[A-Z0-9.^=-]{1,20}$/
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/

/** Zellen trennen, Anführungszeichen respektieren ("39,81 %" in einer CSV). */
function cells(line: string, sep: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') {
      quoted = !quoted
    } else if (ch === sep && !quoted) {
      out.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current.trim())
  return out
}

function separator(header: string): string {
  if (header.includes('\t')) return '\t'
  const semikolon = header.split(';').length
  const komma = header.split(',').length
  return semikolon > 1 && semikolon >= komma ? ';' : ','
}

const headerName = (cell: string) =>
  cell
    .toLowerCase()
    .replace(/\(.*?\)|%/g, '')
    .trim()

function columns(header: readonly string[]): Partial<Record<Column, number>> {
  const names = header.map(headerName)
  const found: Partial<Record<Column, number>> = {}
  for (const field of Object.keys(ALIASES) as Column[]) {
    const index = names.findIndex((n) => ALIASES[field].includes(n))
    if (index !== -1) found[field] = index
  }
  return found
}

interface Num {
  readonly value: number
  readonly percent: boolean
}

/** "39,81 %", "0.3981", "2x", "12.345,67 €", "12,345.67 USD" - wie aus Excel oder einem Export. */
export function parseNumber(raw: string): Num | null {
  let text = raw
    .replace(/\s/g, '')
    .replace(/[€$£]|EUR|USD|CHF|GBP/gi, '')
    .replace(/[x×]$/i, '')
  const percent = text.endsWith('%')
  if (percent) text = text.slice(0, -1)
  if (!text) return null
  // Das letzte Trennzeichen ist das Dezimalzeichen; steht nur ein Komma da, ist es deutsch.
  const komma = text.lastIndexOf(',')
  const punkt = text.lastIndexOf('.')
  const norm =
    komma !== -1 && punkt !== -1
      ? komma > punkt
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '')
      : komma !== -1
        ? text.replace(',', '.')
        : text
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null
  const value = Number(norm)
  if (!Number.isFinite(value)) return null
  return { value: percent ? value / 100 : value, percent }
}

function kindOf(raw: string, ter: number | null, name: string): HoldingKind {
  const word = KIND_WORDS[raw.trim().toLowerCase()]
  if (word) return word
  if (HOLDING_KINDS.includes(raw as HoldingKind)) return raw as HoldingKind
  // Ohne Angabe: erst der Name, dann die Kosten - eine TER von 0 hat kein Fonds.
  const ausName = kindFromName(name)
  if (ausName) return ausName
  if (ter !== null) return ter > 0 ? 'etf' : 'stock'
  return 'stock'
}

export function parseDepotText(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  const issues: ParseIssue[] = []

  let headerIndex = -1
  let sep = '\t'
  let cols: Partial<Record<Column, number>> = {}
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const s = separator(lines[i])
    const c = columns(cells(lines[i], s))
    if (c.id !== undefined && (c.weight !== undefined || c.value !== undefined)) {
      headerIndex = i
      sep = s
      cols = c
      break
    }
  }
  if (headerIndex === -1) return { holdings: [], issues: [{ code: 'noHeader' }], totalValue: null }

  const cell = (row: readonly string[], field: Column) => {
    const index = cols[field]
    return index === undefined ? '' : (row[index] ?? '').trim()
  }
  // Ohne Anteil-Spalte rechnen die Positionswerte die Anteile.
  const ausWerten = cols.weight === undefined
  const anteilSpalte: Column = ausWerten ? 'value' : 'weight'

  interface Draft {
    readonly line: number
    readonly id: string
    readonly name: string
    readonly symbol: string
    readonly weight: Num
    readonly ter: Num | null
    readonly leverage: number | null
    readonly kind: string
    readonly lookThrough: string
  }
  const drafts: Draft[] = []
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = cells(lines[i], sep)
    const id = cell(row, 'id').toUpperCase()
    if (!id) continue
    if (SUMMEN.has(id.toLowerCase())) break
    const line = i + 1

    const weight = parseNumber(cell(row, anteilSpalte))
    if (!weight || weight.value < 0) {
      issues.push({ code: 'badWeight', line, value: cell(row, anteilSpalte) })
      continue
    }
    const symbol = cell(row, 'symbol').toUpperCase()
    if (symbol && !SYMBOL.test(symbol)) {
      issues.push({ code: 'badSymbol', line, value: symbol })
      continue
    }
    if (drafts.some((d) => d.id === id)) {
      issues.push({ code: 'duplicate', line, value: id })
      continue
    }
    const leverage = parseNumber(cell(row, 'leverage'))
    // Ohne eigene Durchschau-Angabe genügt oft die ISIN: Amundi-ETFs und Aktien findet sie.
    const isin = cell(row, 'isin').toUpperCase()
    const lookThrough =
      cell(row, 'lookThrough').toUpperCase().replace(/\s/g, '') ||
      (ISIN.test(isin) ? isin : ISIN.test(id) ? id : '')
    drafts.push({
      line,
      id,
      name: cell(row, 'name'),
      symbol,
      weight,
      ter: parseNumber(cell(row, 'ter')),
      leverage: leverage && leverage.value > 0 ? leverage.value : null,
      kind: cell(row, 'kind'),
      lookThrough,
    })
  }

  if (drafts.length === 0) return { holdings: [], issues: [...issues, { code: 'noRows' }], totalValue: null }
  if (drafts.length > MAX_HOLDINGS) issues.push({ code: 'tooMany', max: MAX_HOLDINGS })

  // Ohne Prozentzeichen ist "39,81" mehrdeutig - die Summe entscheidet. Werte in
  // Euro werden zu Anteilen an ihrer Summe.
  const rawSum = drafts.reduce((s, d) => s + (d.weight.percent ? 0 : d.weight.value), 0)
  const valueSum = drafts.reduce((s, d) => s + d.weight.value, 0)
  const weightScale = rawSum > 1.5 ? 100 : 1

  const holdings = drafts.slice(0, MAX_HOLDINGS).map((d): DepotHolding => {
    const weight = ausWerten
      ? valueSum > 0
        ? d.weight.value / valueSum
        : 0
      : d.weight.percent
        ? d.weight.value
        : d.weight.value / weightScale
    // Eine TER über 5 % gibt es nicht: "0,12" ohne Zeichen meint 0,12 %.
    const terWert = d.ter ? (!d.ter.percent && d.ter.value > 0.05 ? d.ter.value / 100 : d.ter.value) : null
    const ter = terWert ?? 0
    const kind = kindOf(d.kind, terWert, d.name)
    // Groß geschriebene Rohstoffnamen ("GOLD") lesbar halten; ohne Angabe sagt es oft der Name.
    const lookThrough =
      kind === 'etc' && d.lookThrough && !ISIN.test(d.lookThrough)
        ? d.lookThrough.charAt(0) + d.lookThrough.slice(1).toLowerCase()
        : kind === 'etc'
          ? (commodityFromName(d.name) ?? d.lookThrough)
          : d.lookThrough
    return {
      id: d.id,
      name: d.name || d.id,
      symbol: d.symbol,
      weight,
      ter: Math.max(0, ter),
      // Ohne Hebel-Spalte: "3x Daily Leveraged" im Namen ist ein Hebel von 3.
      leverage: d.leverage ?? leverageFromName(d.name) ?? 1,
      kind,
      lookThrough,
    }
  })
  return { holdings, issues, totalValue: ausWerten && valueSum > 0 ? valueSum : null }
}

const WKN = /^[A-Z0-9]{6}$/

/**
 * Die Kennung des Produkts selbst (ISIN oder WKN), um ein fehlendes Symbol zu finden.
 *
 * Bevorzugt der Schlüssel der Zeile. Eine Durchschau-ISIN zählt nur ohne Filter:
 * "IE000…:US" zeigt auf einen Stellvertreter-Fonds, nicht auf das Produkt.
 */
export function productId(h: DepotHolding): string | null {
  if (ISIN.test(h.id) || WKN.test(h.id)) return h.id
  return ISIN.test(h.lookThrough) ? h.lookThrough : null
}

/**
 * Gefundene Symbole und Namen eintragen, wo sie fehlen - vorhandene bleiben.
 * Ein Name ohne Symbol genügt: an ihm erkennt die Durchschau den Index.
 *
 * Kam der Name erst mit der Suche, waren Typ und Hebel beim Import geraten
 * (aus der TER oder gar nicht). Dann zählen jetzt Name und Yahoos Produktart.
 */
export function withResolvedSymbols(
  holdings: readonly DepotHolding[],
  found: ReadonlyMap<
    string,
    { readonly symbol: string; readonly name: string | null; readonly type?: ResolvedType }
  >,
): DepotHolding[] {
  return holdings.map((h) => {
    const kennung = productId(h)
    const treffer = kennung ? found.get(kennung) : undefined
    if (!treffer) return h
    const symbol = h.symbol || treffer.symbol
    if (h.name !== h.id || !treffer.name) return symbol === h.symbol ? h : { ...h, symbol }
    const benannt = { ...h, symbol, name: treffer.name }
    return { ...benannt, ...inferredPatch(benannt, treffer.type ?? null) }
  })
}

const HEADER = ['WKN', 'Name', 'Symbol', 'Anteil', 'TER', 'Hebel', 'Typ', 'Durchschau']

/** Zurück in eine Tabelle, die `parseDepotText` wieder liest - zum Bearbeiten. */
export function serializeDepot(holdings: readonly DepotHolding[]): string {
  const percent = (v: number) => `${(v * 100).toFixed(2)}%`
  const rows = holdings.map((h) =>
    [h.id, h.name, h.symbol, percent(h.weight), percent(h.ter), String(h.leverage), h.kind, h.lookThrough].join(
      '\t',
    ),
  )
  return [HEADER.join('\t'), ...rows].join('\n')
}
