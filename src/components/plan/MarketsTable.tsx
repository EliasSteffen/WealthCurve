import type { MarketStats, PriceIndex } from '../../core/analytics'
import { intlLocale } from '../../i18n'
import { cn } from '../../lib/cn'
import { formatPercent } from '../../lib/format'
import { signedPercent } from '../../lib/numbers'
import { useLocale, useT } from '../../react/localeContext'

export interface MarketEntry {
  readonly symbol: string
  readonly name: string
  readonly index: PriceIndex
  readonly stats: MarketStats | null
}

/**
 * Geladene Wertpapiere als Screener: eine Zeile je Papier, alle Kennzahlen
 * nebeneinander. Ein Klick öffnet den Kerzenchart.
 */
export function MarketsTable({
  markets,
  selected,
  onSelect,
  onAdd,
}: {
  readonly markets: readonly MarketEntry[]
  readonly selected: string | null
  readonly onSelect: (symbol: string) => void
  readonly onAdd: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const monat = new Intl.DateTimeFormat(intlLocale(locale), { month: 'short', year: 'numeric', timeZone: 'UTC' })
  const datum = (s: number) => monat.format(new Date(s * 1000))

  if (markets.length === 0) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-2 p-4">
        <p className="max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
          {t(
            'pro.noSecurities',
            'Noch keines geladen. Mit + ein Papier wie den S&P 500 holen – es erscheint als Kerzenchart.',
          )}
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="h-7 rounded-md bg-[var(--accent-fill)] px-3 text-xs font-medium text-[var(--on-accent)] hover:opacity-90"
        >
          {t('pro.addSecurity', 'Wertpapier laden')}
        </button>
      </div>
    )
  }

  const kopf = [
    t('pro.col.symbol', 'Symbol'),
    t('pro.stat.period', 'Zeitraum'),
    t('pro.stat.total', 'Gesamtrendite'),
    t('pro.stat.cagr', 'Rendite p. a.'),
    t('pro.stat.vol', 'Schwankung p. a.'),
    t('pro.stat.maxDd', 'Größter Rückgang'),
    t('pro.stat.recovery', 'Erholt'),
    t('pro.stat.best', 'Bester Monat'),
    t('pro.stat.worst', 'Schlechtester Monat'),
    t('pro.stat.positive', 'Monate im Plus'),
  ]

  return (
    <div>
      <table className="w-full border-separate border-spacing-0 text-right text-[11px]">
        <caption className="sr-only">{t('markets.caption', 'Kennzahlen der geladenen Wertpapiere')}</caption>
        <thead className="sticky top-0 z-10 bg-[var(--surface-1)]">
          <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            {kopf.map((k, i) => (
              <th key={k} scope="col" className={cn('whitespace-nowrap border-b border-[var(--grid)] px-3 py-1.5 font-medium', i === 0 && 'text-left')}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {markets.map((m) => {
            const s = m.stats
            return (
              <tr
                key={m.symbol}
                className={cn('cursor-pointer hover:bg-[var(--grid)]', selected === m.symbol && 'bg-[var(--surface-2)]')}
                onClick={() => onSelect(m.symbol)}
              >
                <th scope="row" className="px-3 py-1 text-left font-normal">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(m.symbol)
                    }}
                    aria-pressed={selected === m.symbol}
                    className="text-left"
                  >
                    <span className="block text-xs font-semibold text-[var(--text-primary)]">{m.symbol}</span>
                    <span className="block max-w-48 truncate text-[10px] text-[var(--text-muted)]">{m.name}</span>
                  </button>
                </th>
                {s ? (
                  <>
                    <td className="whitespace-nowrap px-3 text-[var(--text-secondary)]">{`${datum(s.from)} – ${datum(s.to)}`}</td>
                    <td className="px-3" style={{ color: s.totalReturn >= 0 ? 'var(--up)' : 'var(--down)' }}>{signedPercent(s.totalReturn)}</td>
                    <td className="px-3 font-semibold" style={{ color: s.cagr >= 0 ? 'var(--up)' : 'var(--down)' }}>{signedPercent(s.cagr)}</td>
                    <td className="px-3 text-[var(--text-primary)]">{formatPercent(s.volatility * 100)}</td>
                    <td className="whitespace-nowrap px-3 text-[var(--down)]" title={`${datum(s.drawdownPeak)} → ${datum(s.drawdownTrough)}`}>
                      {formatPercent(s.maxDrawdown * 100)}
                    </td>
                    <td className="whitespace-nowrap px-3 text-[var(--text-secondary)]">
                      {s.maxDrawdown === 0 ? '–' : s.recoveredAt === null ? t('pro.stat.notYet', 'noch nicht') : datum(s.recoveredAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 text-[var(--up)]">{`${signedPercent(s.bestMonth.change)} · ${datum(s.bestMonth.time)}`}</td>
                    <td className="whitespace-nowrap px-3 text-[var(--down)]">{`${signedPercent(s.worstMonth.change)} · ${datum(s.worstMonth.time)}`}</td>
                    <td className="px-3 text-[var(--text-primary)]">{formatPercent(s.positiveShare * 100)}</td>
                  </>
                ) : (
                  <td colSpan={9} className="px-3 text-[var(--text-muted)]">–</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[10px] text-[var(--text-muted)]">
        {t('pro.marketNote', 'Monatskurse, bereinigt um Splits und Dividenden. Vergangenheit ist keine Prognose.')}
      </p>
    </div>
  )
}
