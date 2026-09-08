import { Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import type { MarketSeries } from '../core/domain/types'
import { actions } from '../core/state'
import { cn } from '../lib/cn'
import { useDispatch, useSelector } from '../react/useSelector'

/** Ein paar geläufige Ticker als Startpunkt - Yahoo-Schreibweise. */
const VORSCHLAEGE = [
  { symbol: 'URTH', label: 'MSCI World' },
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^GDAXI', label: 'DAX' },
  { symbol: 'AAPL', label: 'Apple' },
] as const

interface MarketPanelProps {
  readonly matches?: ReadonlySet<string> | null
}

/**
 * Lädt einen echten Kursverlauf für die Serie „Kursverlauf".
 *
 * Der Abruf läuft über `/api/quotes`, weil Yahoo weder CORS-Header sendet noch
 * direkte Browser-Aufrufe zulässt (HTTP 429). Ohne laufende Serverfunktion -
 * etwa im reinen `npm run dev` - schlägt der Abruf deshalb fehl; die Meldung
 * sagt das dann auch, statt eine leere Kurve zu zeigen.
 */
export function MarketPanel({ matches = null }: MarketPanelProps) {
  const dispatch = useDispatch()
  const market = useSelector((s) => s.market)
  const [symbol, setSymbol] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  if (matches !== null && !matches.has('market')) return null

  const laden = async (wert: string) => {
    const gesucht = wert.trim().toUpperCase()
    if (!gesucht) return
    setLaedt(true)
    setFehler(null)
    try {
      const antwort = await fetch(`/api/quotes?symbol=${encodeURIComponent(gesucht)}`)

      /*
       * Erst den Inhaltstyp pruefen, dann parsen. Ohne laufende Serverfunktion
       * liefert der Dev-Server die TypeScript-Datei im Klartext aus - ein
       * blindes .json() endete dann in "Unexpected token 'c'", was niemandem
       * sagt, was eigentlich fehlt.
       */
      const typ = antwort.headers.get('content-type') ?? ''
      if (!typ.includes('application/json')) {
        throw new Error('Die Kurs-Schnittstelle antwortet nicht.')
      }

      const daten = (await antwort.json()) as MarketSeries & { error?: string }
      if (!antwort.ok) throw new Error(daten.error ?? `Fehler ${antwort.status}`)
      dispatch(actions.setMarket(daten))
      // Die Serie nützt nichts, wenn sie ausgeschaltet bleibt.
      dispatch(actions.toggleSeries('marketReturn'))
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
    } finally {
      setLaedt(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="market-symbol"
          className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
        >
          Wertpapier
        </label>
        <div className="flex gap-1.5">
          <input
            id="market-symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void laden(symbol)
            }}
            placeholder="z. B. AAPL"
            className="min-w-0 flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] px-2.5 py-2 text-sm uppercase text-[var(--text-primary)] placeholder:normal-case placeholder:text-[var(--text-muted)] focus:border-[var(--chart-1)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void laden(symbol)}
            disabled={laedt || !symbol.trim()}
            aria-label="Kurse laden"
            className="rounded-lg border border-[var(--hairline)] px-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)] disabled:opacity-40"
          >
            {laedt ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {VORSCHLAEGE.map((v) => (
          <button
            key={v.symbol}
            type="button"
            onClick={() => {
              setSymbol(v.symbol)
              void laden(v.symbol)
            }}
            className="rounded-md border border-[var(--hairline)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]"
          >
            {v.label}
          </button>
        ))}
      </div>

      {market ? (
        <p className="text-[11px] leading-snug text-[var(--text-muted)]">
          <span className="text-[var(--text-primary)]">{market.name}</span> · seit {market.start} ·{' '}
          {Math.floor(market.monthlyReturns.length / 12)} Jahre Historie
        </p>
      ) : null}

      {fehler ? (
        <p className={cn('text-[11px] leading-snug', 'text-[var(--chart-8)]')}>
          {fehler}
          <span className="block text-[var(--text-muted)]">
            Kursdaten brauchen die Serverfunktion – lokal per `vercel dev`, sonst im Deploy.
          </span>
        </p>
      ) : null}
    </div>
  )
}
