/**
 * Firmenprofile für Einzelaktien als Vercel-Serverfunktion.
 *
 * Nur der Adapter - die Beschaffung steht in `server/profile.ts` und wird
 * genauso von `npm run dev` und `npm run serve` benutzt.
 */
import { CACHE_HEADER, fetchProfiles } from '../server/profile'

interface Req {
  readonly query: Record<string, string | string[] | undefined>
}
interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  json(body: unknown): void
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const ergebnis = await fetchProfiles(req.query.symbols)

  if (!ergebnis.ok) {
    res.status(ergebnis.fehler.status).json({ error: ergebnis.fehler.error })
    return
  }

  res.setHeader('Cache-Control', CACHE_HEADER)
  res.status(200).json({ results: ergebnis.daten })
}
