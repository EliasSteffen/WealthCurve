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
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { CACHE_HEADER, handleQuotesRequest } from '../server/quotes'

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

const server = createServer(async (req, res) => {
  const url = req.url ?? '/'

  if (url.startsWith('/api/quotes')) {
    const antwort = await handleQuotesRequest(url)
    res.statusCode = antwort.status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    if (antwort.cache) res.setHeader('cache-control', CACHE_HEADER)
    res.end(JSON.stringify(antwort.body))
    return
  }

  /*
   * Pfad auf das Build-Verzeichnis festnageln.
   *
   * `normalize` löst "..", der Präfixvergleich schließt danach alles aus, was
   * aus `dist/` herausführt - sonst reichte ein "/../../etc/passwd".
   */
  const pfad = normalize(join(WURZEL, decodeURIComponent(url.split('?')[0])))
  const datei =
    pfad.startsWith(WURZEL) && existsSync(pfad) && statSync(pfad).isFile()
      ? pfad
      : join(WURZEL, 'index.html')

  res.statusCode = 200
  res.setHeader('content-type', TYPEN[extname(datei)] ?? 'application/octet-stream')
  createReadStream(datei).pipe(res)
})

server.listen(PORT, () => {
  console.log(`Zinseszins läuft auf http://localhost:${PORT} - mit Kursdaten.`)
})
