import { Loader2, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MarketSeries } from '../core/domain/types'
import { parseMarketFile } from '../core/market'
import { MAX_MARKETS, actions } from '../core/state'
import { cn } from '../lib/cn'
import { useT } from '../react/localeContext'
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

type Verfuegbarkeit = 'unbekannt' | 'ja' | 'nein'

/**
 * Lädt einen echten Kursverlauf für die Serie „Kursverlauf".
 *
 * Zwei Wege, weil nicht jede Auslieferung eine Serverfunktion hat: der Abruf
 * über `/api/quotes` (Vite-Dev-Server, `npm run serve`, Vercel) und der Import
 * einer Datei. Ist keine Serverfunktion erreichbar, verschwindet die Suche und
 * der Import tritt an ihre Stelle - statt einer Fehlermeldung, die dem Nutzer
 * nur mitteilt, dass er Pech hat.
 *
 * Yahoo direkt aus dem Browser geht nicht: keine CORS-Header, dazu Cookie und
 * Crumb. Für die frei zugänglichen Alternativen gilt dasselbe.
 */
export function MarketPanel({ matches = null }: MarketPanelProps) {
  const dispatch = useDispatch()
  const t = useT()
  const markets = useSelector((s) => s.markets)
  const enabledSeriesIds = useSelector((s) => s.enabledSeriesIds)
  const startYear = useSelector((s) => s.model.startYear)
  const [symbol, setSymbol] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [serverDa, setServerDa] = useState<Verfuegbarkeit>('unbekannt')
  const dateiRef = useRef<HTMLInputElement>(null)

  /*
   * Einmal nachsehen, ob es die Schnittstelle gibt.
   *
   * Mit einem absichtlich leeren Symbol: die Antwort ist dann 400 mit JSON, was
   * beweist, dass etwas Serverseitiges antwortet - ohne dafür einen echten Kurs
   * abzurufen und das Kontingent zu belasten.
   */
  useEffect(() => {
    let abgebrochen = false
    fetch('/api/quotes?symbol=')
      .then((antwort) => {
        const typ = antwort.headers.get('content-type') ?? ''
        if (!abgebrochen) setServerDa(typ.includes('application/json') ? 'ja' : 'nein')
      })
      .catch(() => {
        if (!abgebrochen) setServerDa('nein')
      })
    return () => {
      abgebrochen = true
    }
  }, [])

  if (matches !== null && !matches.has('market')) return null

  const voll = markets.length >= MAX_MARKETS

  const uebernehmen = (daten: MarketSeries) => {
    if (voll && !markets.some((m) => m.symbol === daten.symbol)) {
      setFehler(
        t(
          'market.full',
          `Mehr als ${MAX_MARKETS} Wertpapiere lassen sich nicht mehr auseinanderhalten. Entferne zuerst eines.`,
          { max: String(MAX_MARKETS) },
        ),
      )
      return
    }
    dispatch(actions.addMarket(daten))
    // Die Serie nützt nichts, wenn sie ausgeschaltet bleibt.
    if (!enabledSeriesIds.includes('marketReturn')) dispatch(actions.toggleSeries('marketReturn'))
  }

  const laden = async (wert: string) => {
    const gesucht = wert.trim().toUpperCase()
    if (!gesucht) return
    setLaedt(true)
    setFehler(null)
    try {
      const antwort = await fetch(`/api/quotes?symbol=${encodeURIComponent(gesucht)}`)

      // Erst den Inhaltstyp prüfen, dann parsen: eine statische Auslieferung
      // antwortet mit HTML, und ein blindes .json() endete in "Unexpected
      // token '<'", was niemandem sagt, was eigentlich fehlt.
      const typ = antwort.headers.get('content-type') ?? ''
      if (!typ.includes('application/json')) {
        setServerDa('nein')
        throw new Error(t('market.unavailable', 'Die Kurs-Schnittstelle antwortet nicht.'))
      }

      const daten = (await antwort.json()) as MarketSeries & { error?: string }
      if (!antwort.ok) throw new Error(daten.error ?? `Fehler ${antwort.status}`)
      uebernehmen(daten)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
    } finally {
      setLaedt(false)
    }
  }

  const importieren = async (datei: File) => {
    setFehler(null)
    const daten = parseMarketFile(await datei.text(), datei.name)
    if (!daten) {
      setFehler(
        t(
          'market.badFile',
          'Datei nicht lesbar – erwartet werden mindestens 13 Monatskurse mit Datums- und Kursspalte.',
        ),
      )
      return
    }
    uebernehmen(daten)
  }

  const mitServer = serverDa !== 'nein'

  return (
    <div className="space-y-3">
      {mitServer ? (
        <>
          <div>
            <label
              htmlFor="market-symbol"
              className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
            >
              {t('market.label', 'Wertpapier')}
            </label>
            <div className="flex gap-1.5">
              <input
                id="market-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void laden(symbol)
                }}
                placeholder={t('market.placeholder', 'z. B. AAPL')}
                className="min-w-0 flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] px-2.5 py-2 text-sm uppercase text-[var(--text-primary)] placeholder:normal-case placeholder:text-[var(--text-muted)] focus:border-[var(--chart-1)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void laden(symbol)}
                disabled={laedt || !symbol.trim()}
                aria-label={t('market.load', 'Kurse laden')}
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
        </>
      ) : null}

      {/* Immer da: der Import braucht keine Serverfunktion. */}
      <div>
        <input
          ref={dateiRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => {
            const datei = e.target.files?.[0]
            if (datei) void importieren(datei)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => dateiRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--hairline)] px-2.5 py-2 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]"
        >
          <Upload size={13} aria-hidden />
          {t('market.import', 'Kursdatei laden (CSV oder JSON)')}
        </button>
        {mitServer ? null : (
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
            {t(
              'market.noServer',
              'Diese Auslieferung hat keine Kurs-Schnittstelle. Alles andere funktioniert; Kurse kommen aus einer Datei – oder starte die App mit `npm run serve`.',
            )}
          </p>
        )}
      </div>

      {/*
        Ohne Startjahr rechnet die Kursserie nichts - das muss hier stehen und
        nicht erst auffallen, wenn der Chart leer bleibt.
      */}
      {markets.length > 0 && startYear === null ? (
        <p className="rounded-md border border-dashed border-[var(--chart-8)] px-2 py-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">
          {t(
            'market.needsStartYear',
            'Für den Kursverlauf fehlt das Startjahr – unter „Generell" eintragen. Erst damit steht fest, ab wann gehalten worden wäre.',
          )}
        </p>
      ) : null}

      {markets.length > 0 ? (
        <ul className="space-y-1">
          {markets.map((m) => (
            <li
              key={m.symbol}
              className="flex items-start justify-between gap-2 rounded-md border border-[var(--hairline)] px-2 py-1.5"
            >
              <span className="min-w-0 text-[11px] leading-snug text-[var(--text-muted)]">
                <span className="block truncate text-[var(--text-primary)]">{m.name}</span>
                {m.symbol} · seit {m.start} · {Math.floor(m.monthlyReturns.length / 12)} Jahre
                {startYear !== null && Number(m.start.slice(0, 4)) > startYear ? (
                  <span className="mt-0.5 block text-[var(--chart-8)]">
                    {t('market.startsLater', `Erst ab ${m.start.slice(0, 4)} handelbar – keine Kurve vor diesem Jahr.`, { jahr: m.start.slice(0, 4) })}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => dispatch(actions.removeMarket(m.symbol))}
                aria-label={t('market.remove', `${m.symbol} entfernen`, { symbol: m.symbol })}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {fehler ? (
        <p className={cn('text-[11px] leading-snug', 'text-[var(--chart-8)]')}>{fehler}</p>
      ) : null}
    </div>
  )
}
