/**
 * Kurse, Devisenkurse und Fondsbestände für ein Depot laden.
 *
 * Über dieselben Server-Schnittstellen wie das Wertpapier-Panel. Jede URL wird
 * höchstens einmal je Sitzung abgerufen - wer zwischen den Ansichten wechselt
 * oder Was-wäre-wenn-Anteile ändert, löst keinen neuen Abruf aus.
 */
import { useEffect, useMemo, useState } from 'react'
import { lookThroughIsins } from '../../core/depot/lookthrough'
import { fxSymbol, normalizeCurrency } from '../../core/depot/metrics'
import type { DepotHolding, FundHoldings, StockProfile } from '../../core/depot/types'
import type { MarketSeries } from '../../core/domain/types'

type Ergebnis<T> = { ok: true; daten: T } | { ok: false; fehler: string; keinServer: boolean }

const cache = new Map<string, Promise<Ergebnis<unknown>>>()

async function holeJson<T>(url: string): Promise<Ergebnis<T>> {
  try {
    const antwort = await fetch(url)
    // Statische Auslieferung (GitHub Pages) antwortet mit HTML statt JSON.
    const typ = antwort.headers.get('content-type') ?? ''
    if (!typ.includes('application/json')) return { ok: false, fehler: '', keinServer: true }
    const body: unknown = await antwort.json()
    if (antwort.ok) return { ok: true, daten: body as T }
    const text =
      typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `HTTP ${antwort.status}`
    return { ok: false, fehler: text, keinServer: false }
  } catch {
    return { ok: false, fehler: '', keinServer: true }
  }
}

function einmal<T>(url: string): Promise<Ergebnis<T>> {
  let abruf = cache.get(url)
  if (!abruf) {
    abruf = holeJson<T>(url)
    cache.set(url, abruf)
    // Fehler nicht festhalten: ein späterer Versuch darf es erneut probieren.
    void abruf.then((e) => {
      if (!e.ok) cache.delete(url)
    })
  }
  return abruf as Promise<Ergebnis<T>>
}

export interface DepotData {
  readonly series: ReadonlyMap<string, MarketSeries>
  readonly fx: ReadonlyMap<string, MarketSeries>
  readonly funds: ReadonlyMap<string, FundHoldings>
  /** Land, Branche und Börsenwert der Einzelaktien, je Kurssymbol. */
  readonly profiles: ReadonlyMap<string, StockProfile>
  readonly loading: boolean
  readonly noServer: boolean
  /** Fehlertexte je Quelle (Symbol oder ISIN). */
  readonly errors: readonly { readonly source: string; readonly message: string }[]
}

const LEER: DepotData = {
  series: new Map(),
  fx: new Map(),
  funds: new Map(),
  profiles: new Map(),
  loading: false,
  noServer: false,
  errors: [],
}

export function useDepotData(holdings: readonly DepotHolding[]): DepotData {
  const symbols = useMemo(
    () => [...new Set(holdings.map((h) => h.symbol).filter(Boolean))].sort(),
    [holdings],
  )
  // Eigene Bestände und die Stellvertreter-Fonds der Indizes, die die Namen verraten.
  const isins = useMemo(() => lookThroughIsins(holdings), [holdings])
  const aktien = useMemo(
    () => [...new Set(holdings.filter((h) => h.kind === 'stock' && h.symbol).map((h) => h.symbol))].sort(),
    [holdings],
  )
  // Geladen wird je Kombination aus Symbolen und ISINs; "lädt" ist, was noch nicht passt.
  const schluessel = `${symbols.join(',')}|${isins.join(',')}|${aktien.join(',')}`
  const [geladen, setGeladen] = useState<{ readonly schluessel: string; readonly data: DepotData } | null>(
    null,
  )

  useEffect(() => {
    if (symbols.length === 0 && isins.length === 0) return
    let abgebrochen = false

    void (async () => {
      const [kurse, bestaende, profilAntwort] = await Promise.all([
        Promise.all(symbols.map((s) => einmal<MarketSeries>(`/api/quotes?symbol=${encodeURIComponent(s)}`))),
        Promise.all(isins.map((i) => einmal<FundHoldings>(`/api/holdings?isin=${encodeURIComponent(i)}`))),
        aktien.length > 0
          ? einmal<{ readonly results?: readonly StockProfile[] }>(
              `/api/profile?symbols=${encodeURIComponent(aktien.join(','))}`,
            )
          : null,
      ])
      const series = new Map<string, MarketSeries>()
      const funds = new Map<string, FundHoldings>()
      const errors: { source: string; message: string }[] = []
      let noServer = false
      kurse.forEach((e, i) => {
        if (e.ok) series.set(symbols[i], e.daten)
        else if (e.keinServer) noServer = true
        else errors.push({ source: symbols[i], message: e.fehler })
      })
      bestaende.forEach((e, i) => {
        if (e.ok) funds.set(isins[i], e.daten)
        else if (e.keinServer) noServer = true
        else errors.push({ source: isins[i], message: e.fehler })
      })
      const profiles = new Map<string, StockProfile>()
      if (profilAntwort?.ok) {
        for (const p of profilAntwort.daten.results ?? []) if (p && typeof p.symbol === 'string') profiles.set(p.symbol, p)
      } else if (profilAntwort && !profilAntwort.keinServer) {
        errors.push({ source: aktien.join(', '), message: profilAntwort.fehler })
      }

      // Devisenkurse erst jetzt: welche Währungen es braucht, steht in den Kursen.
      const fxSymbole = [
        ...new Set(
          [...series.values()]
            .map((s) => fxSymbol(normalizeCurrency(s.currency)))
            .filter((s): s is string => s !== null),
        ),
      ]
      const devisen = await Promise.all(
        fxSymbole.map((s) => einmal<MarketSeries>(`/api/quotes?symbol=${encodeURIComponent(s)}`)),
      )
      const fx = new Map<string, MarketSeries>()
      devisen.forEach((e, i) => {
        if (e.ok) fx.set(fxSymbole[i], e.daten)
        else if (!e.keinServer) errors.push({ source: fxSymbole[i], message: e.fehler })
      })

      if (!abgebrochen) {
        setGeladen({ schluessel, data: { series, fx, funds, profiles, loading: false, noServer, errors } })
      }
    })()

    return () => {
      abgebrochen = true
    }
  }, [schluessel, symbols, isins, aktien])

  if (symbols.length === 0 && isins.length === 0) return LEER
  // Bis der neue Abruf da ist, bleiben die alten Daten stehen - nur als ladend markiert.
  if (!geladen || geladen.schluessel !== schluessel) return { ...(geladen?.data ?? LEER), loading: true }
  return geladen.data
}
