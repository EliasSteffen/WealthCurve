/**
 * Fehlende Yahoo-Symbole über `/api/resolve` nachschlagen.
 *
 * Ein Aufruf für alle Kennungen; ohne Server (GitHub Pages) oder bei Fehlern
 * kommt eine leere Zuordnung zurück - das Depot bleibt dann, wie es ist.
 */
interface Treffer {
  readonly symbol: string
  readonly name: string | null
  readonly type: 'etf' | 'stock' | null
}

export async function resolveSymbols(ids: readonly string[]): Promise<Map<string, Treffer>> {
  const out = new Map<string, Treffer>()
  if (ids.length === 0) return out
  try {
    const antwort = await fetch(`/api/resolve?ids=${encodeURIComponent(ids.join(','))}`)
    if (!antwort.ok || !(antwort.headers.get('content-type') ?? '').includes('application/json')) return out
    const body = (await antwort.json()) as {
      readonly results?: readonly {
        readonly id: string
        readonly symbol: string | null
        readonly name: string | null
        readonly type?: unknown
      }[]
    }
    for (const r of body.results ?? []) {
      if (!r.symbol) continue
      const type = r.type === 'etf' || r.type === 'stock' ? r.type : null
      out.set(r.id, { symbol: r.symbol, name: r.name, type })
    }
  } catch {
    // Kein Server, kein Netz: dann eben ohne Symbole.
  }
  return out
}
