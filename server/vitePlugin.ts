/**
 * `/api/quotes` im Vite-Dev-Server.
 *
 * Ohne das bräuchte die Entwicklung `vercel dev` - und der Dev-Server lieferte
 * die TypeScript-Datei stattdessen im Klartext aus, was im Browser als
 * "Unexpected token" ankam und nichts erklärte.
 *
 * Derselbe Handler bedient auch `npm run serve`, damit sich Entwicklung und
 * lokales Hosting nicht auseinanderentwickeln.
 */
import type { Plugin } from 'vite'
import { CACHE_HEADER, handleQuotesRequest } from './quotes.ts'

export function quotesApi(): Plugin {
  return {
    name: 'zinseszins-quotes-api',
    // Nur im Dev-Server: im Build übernimmt der Wirt (Vercel, eigener Server).
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/quotes', async (req, res) => {
        const antwort = await handleQuotesRequest(req.url ?? '')
        res.statusCode = antwort.status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (antwort.cache) res.setHeader('cache-control', CACHE_HEADER)
        res.end(JSON.stringify(antwort.body))
      })
    },
  }
}
