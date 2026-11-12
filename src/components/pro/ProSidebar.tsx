import { Crosshair, Eye, EyeOff, Plus } from 'lucide-react'
import { scenarioFigures, type MarketStats, type PriceIndex } from '../../core/analytics'
import type { Projection } from '../../core/projection'
import { actions } from '../../core/state'
import { slotVar } from '../../core/palette'
import { effectiveMode } from '../../core/timeAxis'
import { cn } from '../../lib/cn'
import { formatEur, formatPercent } from '../../lib/format'
import { useLocale, useT } from '../../react/localeContext'
import { useSeriesLabel } from '../../react/useSeriesLabel'
import { useDispatch, useSelector } from '../../react/useSelector'
import { intlLocale } from '../../i18n'
import { formatDecimal, shortEur, signedEur, signedPercent, tone } from './numbers'
import { KeyValue, SectionTitle } from './ui'

export interface MarketEntry {
  readonly symbol: string
  readonly name: string
  readonly index: PriceIndex
  readonly stats: MarketStats | null
}

interface ProSidebarProps {
  readonly projection: Projection
  readonly focusKey: string | null
  readonly onFocus: (key: string) => void
  /** 'wealth' oder das Symbol des gezeigten Wertpapiers. */
  readonly chartTab: string
  readonly onChartTab: (tab: string) => void
  readonly markets: readonly MarketEntry[]
  readonly onOpenMarkets: () => void
}

const zeile =
  'grid w-full cursor-pointer items-center gap-2 border-l-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--grid)]'

/**
 * Die Seitenspalte des Terminals: Beobachtungsliste und Kennzahlen.
 *
 * Wie bei TradingView rechts neben dem Chart - Szenarien statt Ticker, dazu die
 * Kurven, die geladenen Wertpapiere und die Zahlen zum gewählten Szenario.
 */
export function ProSidebar({
  projection,
  focusKey,
  onFocus,
  chartTab,
  onChartTab,
  markets,
  onOpenMarkets,
}: ProSidebarProps) {
  const t = useT()
  const { locale } = useLocale()
  const dispatch = useDispatch()
  const labelOf = useSeriesLabel()
  const scenarios = useSelector((s) => s.scenarios)
  const activeId = useSelector((s) => s.activeScenarioId)
  const model = useSelector((s) => s.model)

  const monat = new Intl.DateTimeFormat(intlLocale(locale), { month: 'short', year: 'numeric', timeZone: 'UTC' })
  const datum = (sekunden: number) => monat.format(new Date(sekunden * 1000))
  const jahre = projection.rows.length - 1
  const aktiv = scenarios.find((s) => s.id === activeId)
  const summary = projection.summaries.find((s) => s.scenarioId === activeId)
  const zahlen = summary ? scenarioFigures(summary, jahre) : null
  const mitEntnahme = projection.retirementYear > 0 && projection.retirementYear < jahre
  const markt = markets.find((m) => m.symbol === chartTab)
  const label = (i: number) => projection.yearLabels[i] ?? String(i)
  const reichtBis = (jahr: number) => {
    const modus = effectiveMode(model)
    if (modus === 'calendar') return t('stat.lasts.untilCalendar', `bis ${label(jahr)}`, { year: label(jahr) })
    if (modus === 'age') return t('stat.lasts.untilAge', `bis Alter ${label(jahr)}`, { year: label(jahr) })
    return t('stat.lasts.until', `bis Jahr ${label(jahr)}`, { year: label(jahr) })
  }

  return (
    <div className="pb-4">
      {markt?.stats ? (
        <section aria-label={t('pro.marketStats', 'Kennzahlen {symbol}', { symbol: markt.symbol })}>
          <SectionTitle>{t('pro.marketStats', 'Kennzahlen {symbol}', { symbol: markt.symbol })}</SectionTitle>
          <dl className="m-0">
            <KeyValue
              label={t('pro.stat.period', 'Zeitraum')}
              value={`${datum(markt.stats.from)} – ${datum(markt.stats.to)}`}
            />
            <KeyValue
              label={t('pro.stat.total', 'Gesamtrendite')}
              value={signedPercent(markt.stats.totalReturn)}
              tone={tone(markt.stats.totalReturn)}
            />
            <KeyValue
              label={t('pro.stat.cagr', 'Rendite p. a.')}
              value={signedPercent(markt.stats.cagr)}
              tone={tone(markt.stats.cagr)}
            />
            <KeyValue label={t('pro.stat.vol', 'Schwankung p. a.')} value={formatPercent(markt.stats.volatility * 100)} />
            <KeyValue
              label={t('pro.stat.maxDd', 'Größter Rückgang')}
              value={formatPercent(markt.stats.maxDrawdown * 100)}
              tone={tone(markt.stats.maxDrawdown)}
              hint={`${datum(markt.stats.drawdownPeak)} → ${datum(markt.stats.drawdownTrough)}`}
            />
            <KeyValue
              label={t('pro.stat.recovery', 'Erholt')}
              value={
                markt.stats.maxDrawdown === 0
                  ? '–'
                  : markt.stats.recoveredAt === null
                    ? t('pro.stat.notYet', 'noch nicht')
                    : datum(markt.stats.recoveredAt)
              }
            />
            <KeyValue
              label={t('pro.stat.best', 'Bester Monat')}
              value={`${signedPercent(markt.stats.bestMonth.change)} · ${datum(markt.stats.bestMonth.time)}`}
              tone="up"
            />
            <KeyValue
              label={t('pro.stat.worst', 'Schlechtester Monat')}
              value={`${signedPercent(markt.stats.worstMonth.change)} · ${datum(markt.stats.worstMonth.time)}`}
              tone="down"
            />
            <KeyValue
              label={t('pro.stat.positive', 'Monate im Plus')}
              value={formatPercent(markt.stats.positiveShare * 100)}
            />
          </dl>
          <p className="px-3 pt-1 text-[10px] leading-snug text-[var(--text-muted)]">
            {t('pro.marketNote', 'Monatskurse, bereinigt um Splits und Dividenden. Vergangenheit ist keine Prognose.')}
          </p>
        </section>
      ) : null}

      <section aria-label={t('plan.scenarios', 'Szenarien')}>
        <SectionTitle>{t('plan.scenarios', 'Szenarien')}</SectionTitle>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] px-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          <span className="pl-[10px]">{t('pro.col.name', 'Name')}</span>
          <span className="w-12 text-right">{t('pro.col.rate', 'p. a.')}</span>
          <span className="w-20 text-right">{t('pro.col.final', 'Endwert')}</span>
          <span className="w-6" />
        </div>
        <ul>
          {scenarios.map((s) => {
            const sum = projection.summaries.find((x) => x.scenarioId === s.id)
            const istAktiv = s.id === activeId
            return (
              <li key={s.id}>
                <div
                  className={cn(
                    zeile,
                    'grid-cols-[minmax(0,1fr)_auto_auto_auto]',
                    istAktiv ? 'border-[var(--accent-fill)] bg-[var(--grid)]' : 'border-transparent',
                    !s.visible && 'opacity-50',
                  )}
                >
                  <button
                    type="button"
                    aria-current={istAktiv ? 'true' : undefined}
                    onClick={() => dispatch(actions.selectScenario(s.id))}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: slotVar(s.colorSlot) }} />
                    <span className="truncate font-medium text-[var(--text-primary)]">{s.label || '–'}</span>
                  </button>
                  <span className="w-12 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatPercent(s.params.annualRate)}
                  </span>
                  <span className="w-20 text-right font-medium tabular-nums text-[var(--text-primary)]">
                    {sum ? shortEur(sum.final.balance) : '–'}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch(actions.setScenarioVisible(s.id, !s.visible))}
                    aria-label={
                      s.visible
                        ? t('pro.hide', '„{name}“ ausblenden', { name: s.label })
                        : t('pro.show', '„{name}“ einblenden', { name: s.label })
                    }
                    title={s.visible ? t('pro.hideShort', 'Ausblenden') : t('pro.showShort', 'Einblenden')}
                    className="flex w-6 justify-end text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {s.visible ? <Eye size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label={t('pro.curves', 'Kurven')}>
        <SectionTitle>{t('pro.curves', 'Kurven')}</SectionTitle>
        <ul>
          {projection.lines.map((line) => {
            let letzter: number | null = null
            for (let i = projection.rows.length - 1; i >= 0 && letzter === null; i -= 1) {
              const v = projection.rows[i][line.key]
              if (typeof v === 'number') letzter = v
            }
            const fokus = line.key === focusKey
            return (
              <li key={line.key}>
                <button
                  type="button"
                  aria-pressed={fokus}
                  onClick={() => onFocus(line.key)}
                  title={t('pro.focusHint', 'Als Hauptkurve zeigen: Fläche, Marken und Balken')}
                  className={cn(
                    zeile,
                    'grid-cols-[auto_minmax(0,1fr)_auto]',
                    fokus ? 'border-[var(--accent-fill)] bg-[var(--grid)]' : 'border-transparent',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-0.5 w-3 rounded-full"
                    style={{
                      background: line.dash
                        ? `repeating-linear-gradient(90deg, ${line.colorVar} 0 3px, transparent 3px 5px)`
                        : line.colorVar,
                      opacity: line.opacity,
                    }}
                  />
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[var(--text-primary)]">{labelOf(line)}</span>
                    {fokus ? <Crosshair size={11} aria-hidden className="shrink-0 text-[var(--text-muted)]" /> : null}
                  </span>
                  <span className="font-medium tabular-nums text-[var(--text-primary)]">
                    {letzter === null ? '–' : shortEur(letzter)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label={t('pro.securities', 'Wertpapiere')}>
        <SectionTitle
          action={
            <button
              type="button"
              onClick={onOpenMarkets}
              aria-label={t('pro.addSecurity', 'Wertpapier laden')}
              title={t('pro.addSecurity', 'Wertpapier laden')}
              className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
            >
              <Plus size={13} aria-hidden />
            </button>
          }
        >
          {t('pro.securities', 'Wertpapiere')}
        </SectionTitle>
        {markets.length === 0 ? (
          <p className="px-3 text-xs leading-snug text-[var(--text-muted)]">
            {t('pro.noSecurities', 'Noch keines geladen. Mit + ein Papier wie den S&P 500 holen – es erscheint als Kerzenchart.')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] px-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <span className="pl-[10px]">{t('pro.col.symbol', 'Symbol')}</span>
              <span className="w-14 text-right">{t('pro.col.cagr', 'p. a.')}</span>
              <span className="w-14 text-right">{t('pro.col.maxDd', 'Max DD')}</span>
            </div>
            <ul>
              {markets.map((m) => (
                <li key={m.symbol}>
                  <button
                    type="button"
                    aria-pressed={chartTab === m.symbol}
                    onClick={() => onChartTab(m.symbol)}
                    className={cn(
                      zeile,
                      'grid-cols-[minmax(0,1fr)_auto_auto]',
                      chartTab === m.symbol ? 'border-[var(--accent-fill)] bg-[var(--grid)]' : 'border-transparent',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[var(--text-primary)]">{m.symbol}</span>
                      <span className="block truncate text-[10px] text-[var(--text-muted)]">{m.name}</span>
                    </span>
                    <span
                      className="w-14 text-right tabular-nums"
                      style={m.stats ? { color: m.stats.cagr >= 0 ? 'var(--up)' : 'var(--down)' } : undefined}
                    >
                      {m.stats ? signedPercent(m.stats.cagr) : '–'}
                    </span>
                    <span className="w-14 text-right tabular-nums text-[var(--down)]">
                      {m.stats ? formatPercent(m.stats.maxDrawdown * 100) : '–'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {zahlen && summary && aktiv ? (
        <section aria-label={t('pro.details', 'Details · {name}', { name: aktiv.label })}>
          <SectionTitle>{t('pro.details', 'Details · {name}', { name: aktiv.label })}</SectionTitle>
          <dl className="m-0">
            <KeyValue label={t('stat.final', 'Endkapital')} value={formatEur(zahlen.finalValue)} />
            <KeyValue label={t('stat.contributed', 'Eingezahlt')} value={formatEur(zahlen.contributions)} />
            {zahlen.withdrawals > 0 ? (
              <KeyValue label={t('pro.withdrawn', 'Entnommen')} value={formatEur(zahlen.withdrawals)} />
            ) : null}
            <KeyValue label={t('pro.gain', 'Ertrag')} value={signedEur(zahlen.gain)} tone={tone(zahlen.gain)} />
            {zahlen.gainRatio !== null ? (
              <KeyValue
                label={t('pro.gainRatio', 'Ertrag je Euro')}
                value={signedPercent(zahlen.gainRatio)}
                tone={tone(zahlen.gainRatio)}
              />
            ) : null}
            {zahlen.multiple !== null ? (
              <KeyValue
                label={t('pro.multiple', 'Vervielfachung')}
                value={`× ${formatDecimal(zahlen.multiple, 2)}`}
                hint={t('pro.multipleHint', 'Endwert plus Entnahmen je eingezahltem Euro')}
              />
            ) : null}
            <KeyValue
              label={t('pro.doubling', 'Verdopplung alle')}
              value={
                zahlen.doublingYears === null
                  ? '–'
                  : t('pro.yearsShort', '{n} J.', {
                      n: formatDecimal(zahlen.doublingYears),
                    })
              }
              hint={t('pro.doublingHint', 'Beim festen Zins, ohne Einzahlungen')}
            />
            <KeyValue
              label={t('pro.real', 'Endwert in heutiger Kaufkraft')}
              value={formatEur(zahlen.realFinalValue)}
              hint={t('pro.realHint', 'Bei {rate} Inflation pro Jahr', {
                rate: formatPercent(summary.params.inflationRate),
              })}
            />
            {mitEntnahme ? (
              <>
                <KeyValue label={t('stat.atRetirement', 'Bei Rentenbeginn')} value={formatEur(summary.capitalAtRetirement)} />
                <KeyValue label={t('stat.monthlyWithdrawal', 'Monatliche Entnahme')} value={formatEur(summary.monthlyWithdrawal)} />
                <KeyValue
                  label={t('stat.lasts', 'Kapital reicht')}
                  value={summary.depletedAtYear === null ? t('stat.lasts.through', 'reicht durch') : reichtBis(summary.depletedAtYear)}
                  tone={summary.depletedAtYear === null ? 'up' : 'down'}
                />
              </>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  )
}
