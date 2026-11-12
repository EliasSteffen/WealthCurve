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
import { handleHoldingsRequest } from './holdings.ts'
import { CACHE_HEADER as PROFILE_CACHE, handleProfileRequest } from './profile.ts'
import { CACHE_HEADER, handleQuotesRequest } from './quotes.ts'
import { CACHE_HEADER as RESOLVE_CACHE, handleResolveRequest } from './resolve.ts'

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
      // ISIN/WKN -> Yahoo-Symbol für Depots aus Broker-Exporten.
      server.middlewares.use('/api/resolve', async (req, res) => {
        const antwort = await handleResolveRequest(req.url ?? '')
        res.statusCode = antwort.status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (antwort.cache) res.setHeader('cache-control', RESOLVE_CACHE)
        res.end(JSON.stringify(antwort.body))
      })
      // Fondsbestände für die Depot-Durchschau, gleiche Form wie die Kurse.
      server.middlewares.use('/api/holdings', async (req, res) => {
        const antwort = await handleHoldingsRequest(req.url ?? '')
        res.statusCode = antwort.status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (antwort.cache) res.setHeader('cache-control', CACHE_HEADER)
        res.end(JSON.stringify(antwort.body))
      })
      // Land und Branche von Einzelaktien, die in keinem Fondsbestand stehen.
      server.middlewares.use('/api/profile', async (req, res) => {
        const antwort = await handleProfileRequest(req.url ?? '')
        res.statusCode = antwort.status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (antwort.cache) res.setHeader('cache-control', PROFILE_CACHE)
        res.end(JSON.stringify(antwort.body))
      })
    },
  }
}
