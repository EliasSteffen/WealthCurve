/**
 * Depot aus gespeichertem Zustand prüfen.
 *
 * Wie beim übrigen Zustand Feld für Feld: was aus localStorage kommt, hat
 * jemand anders geschrieben - eine ältere Version oder eine Hand im Devtool.
 */
import {
  EMPTY_DEPOT,
  HOLDING_KINDS,
  MAX_HOLDINGS,
  type DepotHolding,
  type DepotState,
  type HoldingKind,
} from './types.ts'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const text = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const finite = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

function sanitizeHolding(raw: unknown): DepotHolding | null {
  if (!isRecord(raw)) return null
  const id = text(raw.id, 20).toUpperCase()
  if (!id) return null
  const symbol = text(raw.symbol, 20).toUpperCase()
  return {
    id,
    name: text(raw.name) || id,
    symbol: /^[A-Z0-9.^=-]{1,20}$/.test(symbol) ? symbol : '',
    weight: Math.max(0, finite(raw.weight, 0)),
    ter: Math.min(0.1, Math.max(0, finite(raw.ter, 0))),
    leverage: Math.min(10, Math.max(1, finite(raw.leverage, 1))),
    kind: HOLDING_KINDS.includes(raw.kind as HoldingKind) ? (raw.kind as HoldingKind) : 'etf',
    lookThrough: text(raw.lookThrough, 40),
  }
}

export function sanitizeDepot(raw: unknown): DepotState {
  if (!isRecord(raw) || !Array.isArray(raw.holdings)) return EMPTY_DEPOT
  const holdings: DepotHolding[] = []
  for (const entry of raw.holdings) {
    const h = sanitizeHolding(entry)
    if (h && !holdings.some((x) => x.id === h.id)) holdings.push(h)
    if (holdings.length >= MAX_HOLDINGS) break
  }
  let whatIf: Record<string, number> | null = null
  if (isRecord(raw.whatIf)) {
    whatIf = {}
    for (const h of holdings) {
      const v = raw.whatIf[h.id]
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) whatIf[h.id] = v
    }
  }
  return { holdings, whatIf }
}
