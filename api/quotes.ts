/**
 * Kursdaten-Proxy (Vercel Serverless).
 *
 * Zwei Gründe, warum das nicht im Browser laufen kann:
 * 1. Yahoo sendet keinen `access-control-allow-origin`-Header.
 * 2. Yahoo drosselt aggressiv - direkte Aufrufe enden regelmäßig in 429.
 *
 * Der Proxy löst Punkt 1. Gegen Punkt 2 hilft nur der Cache: die
 * `s-maxage`-Angabe lässt Vercels Edge die allermeisten Aufrufe beantworten,
 * ohne Yahoo überhaupt zu berühren.
 */

interface YahooAntwort {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string; longName?: string; shortName?: string; currency?: string }
      timestamp?: number[]
      indicators?: { adjclose?: Array<{ adjclose?: (number | null)[] }> }
    }>
    error?: { description?: string } | null
  }
}

export interface MarketSeries {
  readonly symbol: string
  readonly name: string
  readonly currency: string
  /** Erster erfasster Monat als ISO-Datum, z. B. "1994-01-01". */
  readonly start: string
  /** Monatsrenditen als Dezimalzahl: 0.012 bedeutet +1,2 %. */
  readonly monthlyReturns: readonly number[]
}

const JAHRE = 40

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

export function normalise(antwort: YahooAntwort, fallbackSymbol: string): MarketSeries | null {
  const result = antwort.chart?.result?.[0]
  const kurse = result?.indicators?.adjclose?.[0]?.adjclose
  if (!result || !Array.isArray(kurse) || kurse.length < 13) return null

  const ersterZeitpunkt = result.timestamp?.[0]
  return {
    symbol: result.meta?.symbol ?? fallbackSymbol,
    name: result.meta?.longName ?? result.meta?.shortName ?? fallbackSymbol,
    currency: result.meta?.currency ?? 'USD',
    start: ersterZeitpunkt
      ? new Date(ersterZeitpunkt * 1000).toISOString().slice(0, 10)
      : 'unbekannt',
    monthlyReturns: toMonthlyReturns(kurse),
  }
}

interface Req {
  readonly query: Record<string, string | string[] | undefined>
}
interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const roh = req.query.symbol
  const symbol = (Array.isArray(roh) ? roh[0] : roh)?.trim().toUpperCase()

  // Eng gefasst: nur Zeichen, die in Tickern vorkommen. Der Wert wandert in
  // eine URL an einen fremden Dienst.
  if (!symbol || !/^[A-Z0-9.^=-]{1,20}$/.test(symbol)) {
    res.status(400).json({ error: 'Ungültiges Symbol.' })
    return
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${JAHRE}y&interval=1mo`

  try {
    const antwort = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; zinseszins/1.0)' },
    })

    if (antwort.status === 429) {
      res.status(429).json({ error: 'Yahoo drosselt gerade. Bitte später erneut versuchen.' })
      return
    }
    if (!antwort.ok) {
      res.status(502).json({ error: `Kursdienst antwortete mit ${antwort.status}.` })
      return
    }

    const daten = normalise((await antwort.json()) as YahooAntwort, symbol)
    if (!daten || daten.monthlyReturns.length < 12) {
      res.status(404).json({ error: `Zu wenig Kursdaten für "${symbol}".` })
      return
    }

    // Einen Tag im Edge-Cache halten; danach im Hintergrund erneuern, damit
    // niemand auf die Antwort warten muss.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    res.status(200).json(daten)
  } catch {
    res.status(502).json({ error: 'Der Kursdienst ist nicht erreichbar.' })
  }
}
