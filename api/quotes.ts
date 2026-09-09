/**
 * Kursdaten-Proxy als Vercel-Serverfunktion.
 *
 * Nur der Adapter: Request rein, Response raus. Die Beschaffung steht in
 * `server/quotes.ts` und wird genauso vom Vite-Dev-Server (`npm run dev`) und
 * vom eigenständigen Node-Server (`npm run serve`) benutzt. Vercel ist damit
 * eine Möglichkeit, keine Voraussetzung.
 */
import { CACHE_HEADER, fetchQuotes } from '../server/quotes'

interface Req {
  readonly query: Record<string, string | string[] | undefined>
}
interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const ergebnis = await fetchQuotes(req.query.symbol)

  if (!ergebnis.ok) {
    res.status(ergebnis.fehler.status).json({ error: ergebnis.fehler.error })
    return
  }

  res.setHeader('Cache-Control', CACHE_HEADER)
  res.status(200).json(ergebnis.daten)
}
