/**
 * ISIN/WKN -> Yahoo-Symbol als Vercel-Serverfunktion.
 *
 * Nur der Adapter - die Auflösung steht in `server/resolve.ts` und wird
 * genauso von `npm run dev` und `npm run serve` benutzt.
 */
import { CACHE_HEADER, resolveIds } from '../server/resolve'

interface Req {
  readonly query: Record<string, string | string[] | undefined>
}
interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const ergebnis = await resolveIds(req.query.ids)

  if (!ergebnis.ok) {
    res.status(ergebnis.fehler.status).json({ error: ergebnis.fehler.error })
    return
  }

  res.setHeader('Cache-Control', CACHE_HEADER)
  res.status(200).json({ results: ergebnis.daten })
}
