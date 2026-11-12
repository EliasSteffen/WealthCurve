import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import type { LookThrough } from '../../core/depot/lookthrough'
import { productId } from '../../core/depot/parse'
import { HOLDING_KINDS, type DepotHolding, type HoldingKind } from '../../core/depot/types'
import { actions } from '../../core/state'
import type { Translate } from '../../i18n'
import { cn } from '../../lib/cn'
import { currentFormatterLocale } from '../../lib/format'
import { useT } from '../../react/localeContext'
import { useDispatch } from '../../react/useSelector'
import { kindLabel, pct } from './depotFormat'
import type { DepotData } from './useDepotData'

const TH = 'px-2 py-1 text-left text-xs font-medium text-[var(--text-muted)] first:pl-0'
const TD = 'border-t border-[var(--hairline)] px-2 py-2 align-top text-left font-normal first:pl-0'
const EINGABE =
  'rounded-md border border-[var(--hairline)] bg-[var(--surface-1)] px-2 py-1 text-sm text-[var(--text-primary)] focus:border-[var(--chart-1)] focus:outline-none'

/** Ein Amundi-Fonds mit veröffentlichtem Bestand, der für andere Indexfonds stehen kann. */
const WELT = 'IE000BI8OT95'
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/

function quellen(t: Translate) {
  return [
    { value: WELT, label: t('depot.source.world', 'Wie MSCI World') },
    { value: `${WELT}:US`, label: t('depot.source.us', 'Wie MSCI World, nur USA') },
    { value: `${WELT}:EU`, label: t('depot.source.eu', 'Wie MSCI World, nur Europa') },
    { value: `${WELT}:JP`, label: t('depot.source.jp', 'Wie MSCI World, nur Japan') },
  ]
}

/** Eingabe, die erst beim Verlassen oder mit Enter übernimmt - Escape verwirft. */
function Feld({
  value,
  label,
  onCommit,
  className,
  placeholder,
  numerisch = false,
}: {
  readonly value: string
  readonly label: string
  readonly onCommit: (value: string) => void
  readonly className?: string
  readonly placeholder?: string
  readonly numerisch?: boolean
}) {
  const [entwurf, setEntwurf] = useState<string | null>(null)
  const uebernehmen = () => {
    if (entwurf === null) return
    if (entwurf !== value) onCommit(entwurf)
    setEntwurf(null)
  }
  return (
    <input
      aria-label={label}
      value={entwurf ?? value}
      placeholder={placeholder}
      inputMode={numerisch ? 'decimal' : undefined}
      spellCheck={false}
      onChange={(e) => setEntwurf(e.target.value)}
      onBlur={uebernehmen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') uebernehmen()
        if (e.key === 'Escape') setEntwurf(null)
      }}
      className={cn(EINGABE, className)}
    />
  )
}

const zahl = (text: string) => {
  const n = Number.parseFloat(text.replace('%', '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const zahlText = (v: number) => v.toLocaleString(currentFormatterLocale(), { maximumFractionDigits: 2 })

function Status({ ok, text }: { readonly ok: boolean | null; readonly text: string }) {
  if (ok === null) return null
  const Icon = ok ? CheckCircle2 : AlertTriangle
  return (
    <span title={text} className="mt-1.5 inline-flex shrink-0">
      <Icon size={14} aria-hidden className={ok ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'} />
      <span className="sr-only">{text}</span>
    </span>
  )
}

/**
 * Die Bestände zum Nachbessern: Kurssymbol und Durchschau-Quelle sind das, was
 * ein Import am häufigsten nicht weiß. Jede Zeile zeigt, ob beides greift.
 */
export function HoldingsEditor({
  holdings,
  data,
  look,
}: {
  readonly holdings: readonly DepotHolding[]
  readonly data: DepotData
  readonly look: LookThrough
}) {
  const t = useT()
  const dispatch = useDispatch()
  const update = (id: string, patch: Partial<Omit<DepotHolding, 'id'>>) =>
    dispatch(actions.updateDepotHolding(id, patch))
  const summe = holdings.reduce((s, h) => s + h.weight, 0) || 1
  const fehlgeschlagen = new Set(data.errors.map((e) => e.source))
  const vorlagen = quellen(t)

  const durchschau = (h: DepotHolding) => {
    if (h.kind !== 'etf') {
      return (
        <Feld
          value={h.lookThrough}
          label={t('depot.editor.lookThroughOf', 'Durchschau für {name}', { name: h.name })}
          placeholder={h.kind === 'stock' ? 'ISIN' : t('depot.editor.commodity', 'Rohstoff')}
          className="w-36"
          onCommit={(v) => update(h.id, { lookThrough: h.kind === 'stock' ? v.trim().toUpperCase() : v.trim() })}
        />
      )
    }
    // Die eigene ISIN steht im Schlüssel oder - bei einer WKN als Schlüssel - in der Durchschau.
    const ausSchluessel = productId(h)
    const eigene =
      ausSchluessel && ISIN.test(ausSchluessel)
        ? ausSchluessel
        : ISIN.test(h.lookThrough)
          ? h.lookThrough
          : null
    const optionen = [
      ...(eigene && eigene !== WELT
        ? [{ value: eigene, label: t('depot.source.own', 'Eigener Bestand ({isin})', { isin: eigene }) }]
        : []),
      ...vorlagen,
    ]
    if (h.lookThrough && !optionen.some((o) => o.value === h.lookThrough)) {
      optionen.push({
        value: h.lookThrough,
        label: t('depot.source.custom', 'Eigene Angabe: {value}', { value: h.lookThrough }),
      })
    }
    optionen.push({ value: '', label: t('depot.source.none', 'Keine') })
    return (
      <select
        aria-label={t('depot.editor.lookThroughOf', 'Durchschau für {name}', { name: h.name })}
        value={h.lookThrough}
        onChange={(e) => update(h.id, { lookThrough: e.target.value })}
        className={cn(EINGABE, 'w-52')}
      >
        {optionen.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-[var(--text-primary)]">
        <thead>
          <tr>
            <th scope="col" className={TH}>{t('depot.col.position', 'Position')}</th>
            <th scope="col" className={TH}>{t('depot.col.weight', 'Anteil')}</th>
            <th scope="col" className={TH}>{t('depot.editor.kind', 'Typ')}</th>
            <th scope="col" className={TH}>{t('depot.editor.leverage', 'Hebel')}</th>
            <th scope="col" className={TH}>{t('depot.col.ter', 'TER')}</th>
            <th scope="col" className={TH}>{t('depot.editor.symbol', 'Kurssymbol')}</th>
            <th scope="col" className={TH}>{t('depot.editor.lookThrough', 'Durchschau')}</th>
          </tr>
        </thead>
        <tbody>
          {[...holdings]
            .sort((a, b) => b.weight - a.weight)
            .map((h) => {
              const geladen = h.symbol ? data.series.has(h.symbol) : false
              const symbolOk: boolean | null = !h.symbol
                ? false
                : geladen || fehlgeschlagen.has(h.symbol) || !data.loading
                  ? geladen
                  : null
              const durchschauOk: boolean | null = data.loading ? null : !look.missing.includes(h.id)
              return (
                <tr key={h.id}>
                  <th scope="row" className={TD}>
                    <Feld
                      value={h.name}
                      label={t('depot.editor.name', 'Name von {id}', { id: h.id })}
                      className="w-48"
                      onCommit={(v) => update(h.id, { name: v.trim() || h.id })}
                    />
                    <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{h.id}</span>
                  </th>
                  <td className={cn(TD, 'pt-3 tabular-nums')}>{pct(h.weight / summe)}</td>
                  <td className={TD}>
                    <select
                      aria-label={t('depot.editor.kindOf', 'Typ von {name}', { name: h.name })}
                      value={h.kind}
                      onChange={(e) => update(h.id, { kind: e.target.value as HoldingKind })}
                      className={EINGABE}
                    >
                      {HOLDING_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {kindLabel(k, t)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={TD}>
                    <Feld
                      value={zahlText(h.leverage)}
                      numerisch
                      label={t('depot.editor.leverageOf', 'Hebel von {name}', { name: h.name })}
                      className="w-14 text-right tabular-nums"
                      onCommit={(v) => {
                        const n = zahl(v)
                        if (n !== null && n >= 1) update(h.id, { leverage: n })
                      }}
                    />
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-1">
                      <Feld
                        value={zahlText(h.ter * 100)}
                        numerisch
                        label={t('depot.editor.terOf', 'TER von {name} in Prozent', { name: h.name })}
                        className="w-16 text-right tabular-nums"
                        onCommit={(v) => {
                          const n = zahl(v)
                          if (n !== null && n >= 0) update(h.id, { ter: n / 100 })
                        }}
                      />
                      <span aria-hidden className="text-[var(--text-muted)]">
                        %
                      </span>
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="flex items-start gap-1.5">
                      <Feld
                        value={h.symbol}
                        label={t('depot.editor.symbolOf', 'Kurssymbol von {name}', { name: h.name })}
                        placeholder="z. B. EUNL.DE"
                        className="w-28 uppercase"
                        onCommit={(v) => update(h.id, { symbol: v.trim().toUpperCase() })}
                      />
                      <Status
                        ok={symbolOk}
                        text={
                          symbolOk
                            ? t('depot.editor.symbolOk', 'Kurse geladen')
                            : h.symbol
                              ? t('depot.editor.symbolBad', 'Für dieses Symbol gibt es keine Kurse')
                              : t('depot.editor.symbolMissing', 'Ohne Symbol keine Kennzahlen')
                        }
                      />
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="flex items-start gap-1.5">
                      {durchschau(h)}
                      <Status
                        ok={durchschauOk}
                        text={
                          durchschauOk
                            ? t('depot.editor.lookThroughOk', 'Bestand gefunden')
                            : t('depot.editor.lookThroughBad', 'Kein Bestand – zählt als „Unbekannt“')
                        }
                      />
                    </span>
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}
