import { AlertTriangle, Info } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { DepotFlag } from '../../core/depot/flags'
import { indexTemplate } from '../../core/depot/indices'
import { NON_EQUITY_KEYS, type LookThrough, type Share } from '../../core/depot/lookthrough'
import { isWindowStats, scenarioRate, type DepotStats } from '../../core/depot/metrics'
import type { DepotHolding } from '../../core/depot/types'
import { PARAMETERS } from '../../core/domain/parameters'
import { MAX_SCENARIOS, actions } from '../../core/state'
import type { Translate } from '../../i18n'
import { cn } from '../../lib/cn'
import { currentFormatterLocale } from '../../lib/format'
import { useT } from '../../react/localeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import { Stat } from '../ui/Stat'
import { pct, ratio, shareLabel, type Dimension } from './depotFormat'

const KNOPF =
  'rounded-md border border-[var(--hairline)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-page)] disabled:opacity-40'
const TH = 'px-2 py-1 text-right text-xs font-medium text-[var(--text-muted)] first:pl-0 first:text-left'
const TD = 'border-t border-[var(--hairline)] px-2 py-1.5 text-right tabular-nums first:pl-0 first:text-left'
const KEIN_LAND = NON_EQUITY_KEYS

function Tabelle({
  caption,
  head,
  rows,
}: {
  readonly caption: string
  readonly head: readonly string[]
  readonly rows: readonly (readonly ReactNode[])[]
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-[13px] text-[var(--text-primary)]">
        <caption className="mb-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {caption}
        </caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className={cn(TD, 'font-normal')}>
                    {cell}
                  </th>
                ) : (
                  <td key={j} className={TD}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const nameOf = (holdings: readonly DepotHolding[], id: string) =>
  holdings.find((h) => h.id === id)?.name || id

/* --------------------------------------------------------------- Kennzahlen */

export function OverviewView({
  holdings,
  stats,
  loading,
  nur,
}: {
  readonly holdings: readonly DepotHolding[]
  readonly stats: DepotStats
  readonly loading: boolean
  /** Nur die Kennzahl-Kacheln oder nur die Tabellen - die Seite stellt sie getrennt auf. */
  readonly nur?: 'kacheln' | 'tabellen'
}) {
  const t = useT()
  const haupt = stats.windows.find(isWindowStats)
  const jahre = (years: number) => t('depot.years', '{years} J.', { years })
  const luecken = [...new Set(stats.windows.flatMap((w) => (isWindowStats(w) ? [] : w.missing)))]
  const proPosition = new Map(stats.holdings.map((h) => [h.id, h]))
  const sortiert = [...holdings].sort((a, b) => b.weight - a.weight)
  const summe = holdings.reduce((s, h) => s + h.weight, 0) || 1

  return (
    <div className="space-y-5">
      {nur === 'tabellen' ? null : (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat
          label={t('depot.stat.return', 'Rendite p. a.')}
          value={haupt ? pct(haupt.returnPa) : '–'}
          detail={
            haupt
              ? t('depot.stat.window', '{years} J., {from} bis {to}', {
                  years: haupt.years,
                  from: haupt.from,
                  to: haupt.to,
                })
              : t('depot.stat.noWindow', 'Kurshistorie fehlt')
          }
        />
        <Stat label={t('depot.stat.vol', 'Schwankung p. a.')} value={haupt ? pct(haupt.volPa) : '–'} />
        <Stat label={t('depot.stat.ratio', 'Rendite je Risiko')} value={haupt ? ratio(haupt.ratio) : '–'} />
        <Stat
          label={t('depot.stat.drawdown', 'Größter Rückgang')}
          value={haupt ? pct(haupt.maxDrawdown) : '–'}
        />
        <Stat
          label={t('depot.stat.ter', 'Laufende Kosten (TER)')}
          value={pct(stats.ter, 2)}
          detail={t('depot.stat.terDetail', 'gewichtet, steckt schon in den Kursen')}
        />
        <Stat
          label={t('depot.stat.exposure', 'Marktengagement')}
          value={pct(stats.exposure)}
          detail={t('depot.stat.exposureDetail', 'des Depotwerts, Hebel mitgezählt')}
        />
      </div>
      )}

      {nur !== 'tabellen' && loading && !haupt ? (
        <p className="text-[13px] text-[var(--text-muted)]">{t('depot.loading', 'Lade Kurse und Fondsbestände …')}</p>
      ) : null}

      {nur === 'kacheln' ? null : (
        <>
      <Tabelle
        caption={t('depot.overview.windows', 'Zeiträume')}
        head={[
          t('depot.col.window', 'Zeitraum'),
          t('depot.col.return', 'Rendite p. a.'),
          t('depot.col.vol', 'Schwankung p. a.'),
          t('depot.col.ratio', 'Rendite/Risiko'),
          t('depot.col.drawdown', 'Größter Rückgang'),
        ]}
        rows={stats.windows.map((w) =>
          isWindowStats(w)
            ? [jahre(w.years), pct(w.returnPa), pct(w.volPa), ratio(w.ratio), pct(w.maxDrawdown)]
            : [jahre(w.years), '–', '–', '–', '–'],
        )}
      />
      {luecken.length > 0 && !loading ? (
        <p className="text-xs text-[var(--text-muted)]">
          {t('depot.gap', 'Ohne ausreichende Kurshistorie: {names}', {
            names: luecken.map((id) => nameOf(holdings, id)).join(', '),
          })}
        </p>
      ) : null}

      <Tabelle
        caption={
          stats.holdingsYears
            ? t('depot.overview.holdings', 'Positionen ({years} J.)', { years: stats.holdingsYears })
            : t('depot.overview.holdingsPlain', 'Positionen')
        }
        head={[
          t('depot.col.position', 'Position'),
          t('depot.col.weight', 'Anteil'),
          t('depot.col.ter', 'TER'),
          t('depot.col.return', 'Rendite p. a.'),
          t('depot.col.vol', 'Schwankung p. a.'),
          t('depot.col.riskShare', 'Risikoanteil'),
          t('depot.col.costShare', 'Kostenanteil'),
        ]}
        rows={sortiert.map((h) => {
          const s = proPosition.get(h.id)
          return [
            <span key="n" title={h.id}>
              {h.name}
              {h.leverage > 1 ? <span className="text-[var(--text-muted)]"> · {h.leverage}×</span> : null}
            </span>,
            pct(h.weight / summe),
            pct(h.ter, 2),
            s ? pct(s.returnPa) : '–',
            s ? pct(s.volPa) : '–',
            s ? pct(s.riskShare) : '–',
            s ? pct(s.costShare) : '–',
          ]
        })}
      />
        </>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- Durchschau */

function oben(list: readonly Share[], n: number): Share[] {
  if (list.length <= n) return [...list]
  const rest = list.slice(n).reduce((s, x) => s + x.value, 0)
  return [...list.slice(0, n), { key: `__other:${list.length - n}`, value: rest }]
}

function Balken({
  title,
  dimension,
  items,
}: {
  readonly title: string
  readonly dimension: Dimension
  readonly items: readonly Share[]
}) {
  const t = useT()
  const max = Math.max(1e-9, ...items.map((i) => Math.abs(i.value)))
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-[13px]">
            <span className="truncate text-[var(--text-primary)]">
              {item.key.startsWith('__other:')
                ? t('depot.key.other', 'Übrige ({count})', { count: item.key.split(':')[1] })
                : shareLabel(dimension, item.key, t)}
            </span>
            <span className="tabular-nums text-[var(--text-secondary)]">{pct(item.value)}</span>
            <span aria-hidden className="col-span-2 h-1.5 rounded-full bg-[var(--grid)]">
              <span
                className="block h-full rounded-full bg-[var(--chart-1)]"
                style={{ width: `${(Math.max(0, item.value) / max) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function BreakdownView({
  holdings,
  look,
  loading,
}: {
  readonly holdings: readonly DepotHolding[]
  readonly look: LookThrough
  readonly loading: boolean
}) {
  const t = useT()
  if (loading && look.companies.length === 0) {
    return <p className="text-[13px] text-[var(--text-muted)]">{t('depot.loading', 'Lade Kurse und Fondsbestände …')}</p>
  }
  return (
    <div className="space-y-6">
      <p className="text-xs text-[var(--text-secondary)]">
        {t(
          'depot.bd.note',
          'Anteile am Depotwert, Hebel mitgezählt – zusammen {exposure}. Währungen und Produktarten zählen nur das eingesetzte Geld.',
          { exposure: pct(look.exposure) },
        )}
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <Balken title={t('depot.bd.continents', 'Kontinente')} dimension="continent" items={look.continents} />
        <Balken title={t('depot.bd.markets', 'Märkte (MSCI)')} dimension="market" items={look.markets} />
        <Balken title={t('depot.bd.countries', 'Länder')} dimension="country" items={oben(look.countries, 10)} />
        <Balken title={t('depot.bd.sectors', 'Branchen (GICS)')} dimension="sector" items={look.sectors} />
        <Balken title={t('depot.bd.sizes', 'Unternehmensgröße')} dimension="size" items={look.sizes} />
        <Balken title={t('depot.bd.assets', 'Anlageklassen')} dimension="asset" items={look.assets} />
        <Balken
          title={t('depot.bd.currencies', 'Währungen (eingesetztes Geld)')}
          dimension="currency"
          items={oben(look.currencies, 8)}
        />
        <Balken
          title={t('depot.bd.products', 'Produktarten (eingesetztes Geld)')}
          dimension="product"
          items={look.products}
        />
      </div>
      <Tabelle
        caption={t('depot.bd.companies', 'Größte Firmen über alle Positionen')}
        head={[
          t('depot.col.company', 'Firma'),
          t('depot.col.total', 'Gesamt'),
          t('depot.col.direct', 'davon direkt'),
          t('depot.col.via', 'über'),
        ]}
        rows={look.companies
          .slice(0, 15)
          .map((c) => [c.name, pct(c.exposure, 2), c.direct > 0 ? pct(c.direct, 2) : '–', c.via.join(', ')])}
      />
      {look.estimated.length > 0 ? (
        <p className="text-xs text-[var(--text-muted)]">
          {t(
            'depot.bd.estimated',
            'Geschätzt, weil der Anbieter keinen Bestand veröffentlicht – über einen ähnlichen Fonds oder typische Indexgewichte: {names}',
            {
              names: look.estimated
                .map((id) => {
                  const quelle = look.sources[id]
                  const index =
                    quelle && (quelle.kind === 'proxy' || quelle.kind === 'index') && quelle.index
                      ? indexTemplate(quelle.index)?.label
                      : null
                  return index ? `${nameOf(holdings, id)} (${index})` : nameOf(holdings, id)
                })
                .join(', '),
            },
          )}
        </p>
      ) : null}
      {look.missing.length > 0 ? (
        <p className="text-xs text-[var(--text-muted)]">
          {t(
            'depot.bd.missing',
            'Ohne Durchschau (zählt als „Unbekannt“): {names}. Unter „Daten & Quellen“ lässt sich ein Index oder ein ähnlicher Fonds zuordnen.',
            {
              names: look.missing.map((id) => nameOf(holdings, id)).join(', '),
            },
          )}
        </p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ Risiken */

function flagText(f: DepotFlag, t: Translate): { title: string; text: string; lever?: string } {
  const v = f.values
  const n = f.names
  switch (f.id) {
    case 'company':
      return {
        title: t('depot.flag.company.title', 'Klumpen: {name}', { name: n[0] }),
        text: t(
          'depot.flag.company.text',
          '{name} macht über alle Positionen {exposure} des Depotwerts aus, davon {direct} direkt gehalten.',
          { name: n[0], exposure: pct(v.exposure), direct: pct(v.direct) },
        ),
        lever: t('depot.flag.company.lever', 'Steckt in: {via}.', { via: n.slice(1).join(', ') }),
      }
    case 'top10':
      return {
        title: t('depot.flag.top10.title', 'Wenige Firmen bestimmen viel'),
        text: t('depot.flag.top10.text', 'Die zehn größten Firmen stehen für {share} des Engagements.', {
          share: pct(v.share),
        }),
        lever: t(
          'depot.flag.top10.lever',
          'Breit gestreute Fonds senken diesen Wert, Einzelaktien und Branchen-ETFs erhöhen ihn.',
        ),
      }
    case 'country':
      return {
        title: t('depot.flag.country.title', 'Länderschwerpunkt: {country}', {
          country: shareLabel('country', n[0], t),
        }),
        text: t('depot.flag.country.text', '{share} des Engagements entfallen auf {country}.', {
          share: pct(v.share),
          country: shareLabel('country', n[0], t),
        }),
      }
    case 'sector':
      return {
        title: t('depot.flag.sector.title', 'Branchenschwerpunkt: {sector}', {
          sector: shareLabel('sector', n[0], t),
        }),
        text: t('depot.flag.sector.text', '{share} des Engagements entfallen auf {sector}.', {
          share: pct(v.share),
          sector: shareLabel('sector', n[0], t),
        }),
      }
    case 'leverage':
      return {
        title: t('depot.flag.leverage.title', 'Hebel: {exposure} Marktengagement', { exposure: pct(v.exposure) }),
        text: t(
          'depot.flag.leverage.text',
          'Gehebelte Produkte ({names}) bewegen {extra} mehr Markt als eingesetzt. Täglich zurückgesetzte Hebel verlieren in schwankenden Seitwärtsphasen an Wert, auch wenn der Index am Ende gleich steht.',
          { names: n.join(', '), extra: pct(v.extra) },
        ),
      }
    case 'riskShare':
      return {
        title: t('depot.flag.riskShare.title', 'Risikotreiber: {name}', { name: n[0] }),
        text: t(
          'depot.flag.riskShare.text',
          '{name} ist {weight} des Depots, trägt aber {riskShare} seiner Schwankung ({years} J.).',
          { name: n[0], weight: pct(v.weight), riskShare: pct(v.riskShare), years: v.years },
        ),
        lever: t('depot.flag.riskShare.lever', 'Wie sich ein anderer Anteil auswirkt, zeigt „Was-wäre-wenn“.'),
      }
    case 'currency':
      return {
        title: t('depot.flag.currency.title', 'Fremdwährungen: {share}', { share: pct(v.share) }),
        text: t(
          'depot.flag.currency.text',
          '{share} des eingesetzten Geldes liegen in Fremdwährungen, vor allem {names}. Wechselkurse wirken direkt auf den Euro-Wert.',
          { share: pct(v.share), names: n.join(', ') },
        ),
      }
    case 'cost':
      return {
        title: t('depot.flag.cost.title', 'Kostentreiber: {name}', { name: n[0] }),
        text: t(
          'depot.flag.cost.text',
          '{name} hat {weight} Anteil, verursacht mit einer TER von {ter} aber {costShare} der laufenden Kosten (Depot gesamt: {total} p. a.).',
          { name: n[0], weight: pct(v.weight), ter: pct(v.ter, 2), costShare: pct(v.costShare), total: pct(v.total, 2) },
        ),
      }
    case 'overlap':
      return {
        title: t('depot.flag.overlap.title', 'Doppelt gehalten: {names}', { names: n.join(', ') }),
        text: t(
          'depot.flag.overlap.text',
          'Diese Einzelaktien stecken zusätzlich in deinen ETFs – zusammen weitere {indirect} des Depotwerts.',
          { indirect: pct(v.indirect) },
        ),
      }
    case 'drawdown':
      return {
        title: t('depot.flag.drawdown.title', 'Historischer Rückgang: {drawdown}', { drawdown: pct(v.drawdown) }),
        text: t(
          'depot.flag.drawdown.text',
          'So tief fiel die heutige Mischung in den letzten {years} Jahren zwischenzeitlich.',
          { years: v.years },
        ),
      }
    case 'data':
      return {
        title: t('depot.flag.data.title', 'Unvollständige Daten'),
        text: t(
          'depot.flag.data.text',
          'Für {names} fehlen Kurse oder Fondsbestände – sie fehlen in den Kennzahlen oder zählen in der Durchschau als „Unbekannt“.',
          { names: n.join(', ') },
        ),
      }
  }
}

export function RisksView({
  flags,
  limit,
}: {
  readonly flags: readonly DepotFlag[]
  /** Nur die ersten - Warnungen stehen vorn, also die wichtigsten. */
  readonly limit?: number
}) {
  const t = useT()
  if (flags.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        {t('depot.flags.none', 'Keine der geprüften Auffälligkeiten liegt über ihrem Grenzwert.')}
      </p>
    )
  }
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {flags.slice(0, limit).map((f, i) => {
          const { title, text, lever } = flagText(f, t)
          const Icon = f.level === 'warn' ? AlertTriangle : Info
          return (
            <li key={`${f.id}-${i}`} className="flex gap-3">
              <Icon
                size={14}
                aria-hidden
                className="mt-0.5 shrink-0"
                style={{ color: f.level === 'warn' ? 'var(--chart-4)' : 'var(--text-muted)' }}
              />
              <div className="min-w-0 space-y-0.5">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">
                  <span className="sr-only">
                    {f.level === 'warn' ? t('depot.flags.warn', 'Warnung: ') : t('depot.flags.info', 'Hinweis: ')}
                  </span>
                  {title}
                </p>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{text}</p>
                {lever ? <p className="text-xs text-[var(--text-muted)]">{lever}</p> : null}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-[var(--text-muted)]">
        {t(
          'depot.flags.footer',
          'Die Hinweise folgen festen Grenzwerten (z. B. Einzelfirma über 5 %, Land über 50 %, Branche über 30 % des Engagements). Sie beschreiben das Depot und sind keine Anlageberatung.',
        )}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ Was-wäre-wenn */

function ProzentFeld({
  value,
  label,
  onCommit,
}: {
  readonly value: number
  readonly label: string
  readonly onCommit: (value: number) => void
}) {
  // Entwurf statt kontrolliertem Wert: "12," muss tippbar bleiben, bis die Eingabe fertig ist.
  const [entwurf, setEntwurf] = useState<string | null>(null)
  const anzeige =
    entwurf ?? (value * 100).toLocaleString(currentFormatterLocale(), { maximumFractionDigits: 2 })
  const uebernehmen = () => {
    if (entwurf === null) return
    const zahl = Number.parseFloat(entwurf.replace(',', '.'))
    if (Number.isFinite(zahl) && zahl >= 0) onCommit(zahl / 100)
    setEntwurf(null)
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        inputMode="decimal"
        aria-label={label}
        value={anzeige}
        onChange={(e) => setEntwurf(e.target.value)}
        onBlur={uebernehmen}
        onKeyDown={(e) => {
          if (e.key === 'Enter') uebernehmen()
        }}
        className="w-20 rounded-md border border-[var(--hairline)] bg-[var(--surface-1)] px-2 py-1 text-right text-[13px] tabular-nums text-[var(--text-primary)] focus:border-[var(--accent-fill)] focus:outline-none"
      />
      <span aria-hidden className="text-[var(--text-muted)]">
        %
      </span>
    </span>
  )
}

function kennzahlen(s: DepotStats, l: LookThrough, t: Translate): string[] {
  const w = s.windows.find(isWindowStats)
  const exp = l.exposure || 1
  const firma = l.companies[0]
  const land = l.countries.find((c) => !KEIN_LAND.has(c.key))
  const branche = l.sectors.find((c) => !KEIN_LAND.has(c.key))
  const fremd = l.currencies
    .filter((c) => c.key !== 'EUR' && c.key !== 'unknown')
    .reduce((a, c) => a + c.value, 0)
  return [
    w ? pct(w.returnPa) : '–',
    w ? pct(w.volPa) : '–',
    w ? ratio(w.ratio) : '–',
    w ? pct(w.maxDrawdown) : '–',
    pct(s.ter, 2),
    pct(s.exposure),
    firma ? `${firma.name} · ${pct(firma.exposure)}` : '–',
    land ? `${shareLabel('country', land.key, t)} · ${pct(land.value / exp)}` : '–',
    branche ? `${shareLabel('sector', branche.key, t)} · ${pct(branche.value / exp)}` : '–',
    pct(fremd),
  ]
}

export function WhatIfView({
  holdings,
  whatIf,
  stats,
  look,
  variantStats,
  variantLook,
}: {
  readonly holdings: readonly DepotHolding[]
  readonly whatIf: Readonly<Record<string, number>> | null
  readonly stats: DepotStats
  readonly look: LookThrough
  readonly variantStats: DepotStats
  readonly variantLook: LookThrough
}) {
  const t = useT()
  const dispatch = useDispatch()
  const szenarien = useSelector((s) => s.scenarios.length)
  const [meldung, setMeldung] = useState<string | null>(null)

  const gewichte = whatIf ?? Object.fromEntries(holdings.map((h) => [h.id, h.weight]))
  const summeHeute = holdings.reduce((s, h) => s + h.weight, 0) || 1
  const summeVariante = Object.values(gewichte).reduce((s, v) => s + v, 0)

  const alsSzenario = (quelle: DepotStats, variante: boolean) => {
    const rate = scenarioRate(quelle)
    if (rate === null) return
    const { min, max } = PARAMETERS.annualRate
    const zins = Math.min(max, Math.max(min, rate))
    const label = variante
      ? t('depot.whatif.labelVariant', 'Depot-Variante ({rate})', { rate: pct(zins / 100) })
      : t('depot.whatif.labelToday', 'Depot heute ({rate})', { rate: pct(zins / 100) })
    dispatch(actions.addScenario(label, { annualRate: zins }))
    setMeldung(
      t(
        'depot.whatif.added',
        'Szenario „{label}“ angelegt – die Rendite stammt aus der Vergangenheit und ist keine Prognose.',
        { label },
      ),
    )
  }
  const voll = szenarien >= MAX_SCENARIOS

  const zeilen = [
    t('depot.col.return', 'Rendite p. a.'),
    t('depot.col.vol', 'Schwankung p. a.'),
    t('depot.col.ratio', 'Rendite/Risiko'),
    t('depot.col.drawdown', 'Größter Rückgang'),
    t('depot.stat.ter', 'Laufende Kosten (TER)'),
    t('depot.stat.exposure', 'Marktengagement'),
    t('depot.whatif.topCompany', 'Größte Firma'),
    t('depot.whatif.topCountry', 'Größtes Land'),
    t('depot.whatif.topSector', 'Größte Branche'),
    t('depot.whatif.foreign', 'Fremdwährungen'),
  ]
  const heute = kennzahlen(stats, look, t)
  const variante = kennzahlen(variantStats, variantLook, t)

  return (
    <div className="space-y-5">
      <p className="text-xs text-[var(--text-secondary)]">
        {t(
          'depot.whatif.intro',
          'Andere Anteile eintragen und vergleichen. Gleiche Historie, andere Mischung – das zeigt, wie sie sich früher verhalten hätte, nicht wie sie sich künftig verhält.',
        )}
      </p>
      <Tabelle
        caption={t('depot.whatif.weights', 'Anteile')}
        head={[t('depot.col.position', 'Position'), t('depot.whatif.today', 'Heute'), t('depot.whatif.variant', 'Variante')]}
        rows={holdings.map((h) => [
          h.name,
          pct(h.weight / summeHeute),
          <ProzentFeld
            key={h.id}
            value={gewichte[h.id] ?? h.weight}
            label={t('depot.whatif.inputLabel', 'Anteil von {name} in der Variante', { name: h.name })}
            onCommit={(wert) => dispatch(actions.setDepotWhatIfWeight(h.id, wert))}
          />,
        ])}
      />
      <p className="text-xs text-[var(--text-muted)]">
        {t('depot.whatif.sum', 'Summe der Variante: {sum} – gerechnet wird auf 100 % umgelegt.', {
          sum: pct(summeVariante),
        })}
      </p>

      <Tabelle
        caption={t('depot.whatif.compare', 'Vergleich')}
        head={[t('depot.whatif.metric', 'Kennzahl'), t('depot.whatif.today', 'Heute'), t('depot.whatif.variant', 'Variante')]}
        rows={zeilen.map((label, i) => [label, heute[i], variante[i]])}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={KNOPF}
          disabled={whatIf === null}
          onClick={() => dispatch(actions.setDepotWhatIf(null))}
        >
          {t('depot.whatif.reset', 'Variante zurücksetzen')}
        </button>
        <button
          type="button"
          className={KNOPF}
          disabled={voll || scenarioRate(stats) === null}
          onClick={() => alsSzenario(stats, false)}
        >
          {t('depot.whatif.addToday', 'Heute als Szenario')}
        </button>
        <button
          type="button"
          className={KNOPF}
          disabled={voll || whatIf === null || scenarioRate(variantStats) === null}
          onClick={() => alsSzenario(variantStats, true)}
        >
          {t('depot.whatif.addVariant', 'Variante als Szenario')}
        </button>
      </div>
      {voll ? (
        <p className="text-xs text-[var(--text-muted)]">
          {t('depot.whatif.full', 'Es gibt schon {max} Szenarien – entferne eines, um das Depot hinzuzufügen.', {
            max: MAX_SCENARIOS,
          })}
        </p>
      ) : null}
      {meldung ? (
        <p role="status" className="text-xs text-[var(--text-secondary)]">
          {meldung}{' '}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-[var(--text-primary)]"
            onClick={() => dispatch(actions.setPage('sparplan'))}
          >
            {t('depot.whatif.toPlan', 'Zum Sparplan')}
          </button>
        </p>
      ) : null}
    </div>
  )
}
