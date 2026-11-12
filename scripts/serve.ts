/**
 * Eigenständiger Server für `dist/` samt Kursdaten.
 *
 *     npm run build && npm run serve
 *
 * Der dritte Wirt neben Vercel und dem Vite-Dev-Server - und der Beleg dafür,
 * dass die Anwendung an keiner Plattform hängt: nur Node, kein Framework,
 * keine Abhängigkeit außer dem, was ohnehin installiert ist.
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { handleHoldingsRequest } from '../server/holdings'
import { CACHE_HEADER, handleQuotesRequest } from '../server/quotes'
import { CACHE_HEADER as RESOLVE_CACHE, handleResolveRequest } from '../server/resolve'

const PORT = Number(process.env.PORT ?? 4173)
const WURZEL = resolve(import.meta.dirname, '..', 'dist')

const TYPEN: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}

if (!existsSync(WURZEL)) {
  console.error(`Kein Build gefunden unter ${WURZEL}. Erst "npm run build" ausführen.`)
  process.exit(1)
}

const KEIN_CACHE = 'no-cache'
// Vite hängt Inhalts-Hashes an alles unter /assets/ - ein Jahr, unveränderlich.
const UNVERAENDERLICH = 'public, max-age=31536000, immutable'

function fehler(res: ServerResponse, status: number, text: string): void {
  if (res.headersSent) {
    res.destroy()
    return
  }
  res.statusCode = status
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.end(text)
}

async function behandle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '/'

  const api = url.startsWith('/api/quotes')
    ? handleQuotesRequest
    : url.startsWith('/api/holdings')
      ? handleHoldingsRequest
      : url.startsWith('/api/resolve')
        ? handleResolveRequest
        : null
  if (api) {
    const antwort = await api(url)
    res.statusCode = antwort.status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    if (antwort.cache) {
      res.setHeader('cache-control', api === handleResolveRequest ? RESOLVE_CACHE : CACHE_HEADER)
    }
    res.end(JSON.stringify(antwort.body))
    return
  }

  // Kaputte Prozent-Kodierung ("%E0%A4%A") wirft URIError - das ist Client-Fehler, kein Absturz.
  let angefragt: string
  try {
    angefragt = decodeURIComponent(url.split('?')[0])
  } catch {
    fehler(res, 400, 'Ungültiger Pfad.')
    return
  }

  /*
   * Pfad auf das Build-Verzeichnis festnageln.
   *
   * `normalize` löst "..", der Vergleich schließt danach alles aus, was aus
   * `dist/` herausführt - sonst reichte ein "/../../etc/passwd". Mit `sep`
   * am Ende, weil ein bloßer Präfixvergleich auch Geschwister wie `dist-ssr/`
   * durchließe.
   */
  const pfad = normalize(join(WURZEL, angefragt))
  const innen = pfad === WURZEL || pfad.startsWith(WURZEL + sep)
  const datei =
    innen && existsSync(pfad) && statSync(pfad).isFile() ? pfad : join(WURZEL, 'index.html')

  // Nur gehashte Assets sind unveränderlich; index.html (auch als SPA-Fallback) muss frisch bleiben.
  const gehasht = datei.startsWith(join(WURZEL, 'assets') + sep)

  res.statusCode = 200
  res.setHeader('content-type', TYPEN[extname(datei)] ?? 'application/octet-stream')
  res.setHeader('cache-control', gehasht ? UNVERAENDERLICH : KEIN_CACHE)

  const strom = createReadStream(datei)
  strom.on('error', () => fehler(res, 500, 'Datei nicht lesbar.'))
  strom.pipe(res)
}

const server = createServer((req, res) => {
  // Ein geworfener Fehler darf nie als unhandled rejection den Prozess beenden.
  behandle(req, res).catch((e: unknown) => {
    console.error(e)
    fehler(res, 500, 'Interner Fehler.')
  })
})

server.listen(PORT, () => {
  console.log(`Zinseszins läuft auf http://localhost:${PORT} - mit Kursdaten.`)
})
