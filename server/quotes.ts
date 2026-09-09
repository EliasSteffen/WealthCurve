/**
 * Kursabruf - einmal geschrieben, überall einhängbar.
 *
 * Bewusst ohne Request und ohne Response: `fetchQuotes` ist eine Funktion von
 * einem Symbol auf ein Ergebnis. Erst die Adapter drumherum kennen HTTP -
 * die Vercel-Funktion in `api/`, die Dev-Middleware in `vite.config.ts` und
 * der eigenständige Server in `scripts/serve.ts`. Damit hängt das Projekt an
 * keiner einzelnen Plattform.
 *
 * Warum es überhaupt einen Server braucht: Yahoo sendet keine CORS-Header und
 * verlangt Cookie plus Crumb. Ein Browser kann das nicht, und keine der frei
 * zugänglichen Alternativen liefert CORS ohne Schlüssel. Wer keinen Server
 * betreiben will, importiert stattdessen eine Datei - siehe `parseMarketFile`.
 */
import YahooFinance from 'yahoo-finance2'
import type { MarketSeries } from '../src/core/domain/types.ts'
import { marketFromPrices, normalizeSymbol } from '../src/core/market.ts'

export interface QuoteFehler {
  readonly status: number
  readonly error: string
}

export type QuoteErgebnis =
  | { readonly ok: true; readonly daten: MarketSeries }
  | { readonly ok: false; readonly fehler: QuoteFehler }

const JAHRE = 40

// Die Umfrage-Notiz der Bibliothek gehört nicht in ein Serverlog.
const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

/**
 * Einen Tag im Edge-Cache halten, danach im Hintergrund erneuern.
 *
 * Der Cache ist die eigentliche Verteidigung gegen die Drosselung: die
 * allermeisten Aufrufe erreichen Yahoo damit gar nicht erst.
 */
export const CACHE_HEADER = 's-maxage=86400, stale-while-revalidate=604800'

export async function fetchQuotes(rohSymbol: unknown): Promise<QuoteErgebnis> {
  const symbol = normalizeSymbol(rohSymbol)
  if (!symbol) return { ok: false, fehler: { status: 400, error: 'Ungültiges Symbol.' } }

  const von = new Date()
  von.setFullYear(von.getFullYear() - JAHRE)

  try {
    const ergebnis = await yahoo.chart(symbol, { period1: von, interval: '1mo' })
    const daten = marketFromPrices(
      ergebnis.quotes.map((q) => ({
        date: q.date.toISOString().slice(0, 10),
        // Bereinigt um Splits und Dividenden - sonst liest sich ein Split als
        // Kurssturz und die Rendite wäre schlicht falsch.
        price: q.adjclose ?? q.close,
      })),
      {
        symbol: ergebnis.meta.symbol || symbol,
        name: ergebnis.meta.longName ?? ergebnis.meta.shortName,
        currency: ergebnis.meta.currency,
      },
    )

    if (!daten) {
      return { ok: false, fehler: { status: 404, error: `Zu wenig Kursdaten für "${symbol}".` } }
    }
    return { ok: true, daten }
  } catch (e) {
    const text = e instanceof Error ? e.message : ''
    // Die Bibliothek wirft für alles Error - der Grund steht nur im Text.
    if (/not found|no data|invalid/i.test(text)) {
      return { ok: false, fehler: { status: 404, error: `"${symbol}" ist unbekannt.` } }
    }
    if (/429|too many/i.test(text)) {
      return {
        ok: false,
        fehler: {
          status: 429,
          error: 'Der Kursdienst drosselt gerade. Bitte später erneut versuchen.',
        },
      }
    }
    return { ok: false, fehler: { status: 502, error: 'Der Kursdienst ist nicht erreichbar.' } }
  }
}

export interface QuoteAntwort {
  readonly status: number
  readonly body: unknown
  readonly cache: boolean
}

/** Für Adapter, die nur den angefragten Pfad kennen. */
export async function handleQuotesRequest(url: string): Promise<QuoteAntwort> {
  const symbol = new URL(url, 'http://localhost').searchParams.get('symbol')
  const ergebnis = await fetchQuotes(symbol)
  return ergebnis.ok
    ? { status: 200, body: ergebnis.daten, cache: true }
    : { status: ergebnis.fehler.status, body: { error: ergebnis.fehler.error }, cache: false }
}
