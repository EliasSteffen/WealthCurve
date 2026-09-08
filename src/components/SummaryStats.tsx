import type { ProjectionSummary } from '../core/projection'
import { formatEur, formatPercent } from '../lib/format'
import { useT } from '../react/localeContext'
import { Stat } from './ui/Stat'

interface SummaryStatsProps {
  readonly summaries: readonly ProjectionSummary[]
  readonly activeScenarioId: string
  readonly hasWithdrawalPhase: boolean
}

/**
 * Kennzahlen des gerade bearbeiteten Szenarios.
 *
 * Bewusst nur eines: bei beliebig vielen Szenarien würde eine Gegenüberstellung
 * hier zerfasern. Der Vergleich lebt in Legende und Tabelle, die ihn ohne
 * Platzgrenze tragen.
 */
export function SummaryStats({
  summaries,
  activeScenarioId,
  hasWithdrawalPhase,
}: SummaryStatsProps) {
  const t = useT()
  const shown = summaries.find((s) => s.scenarioId === activeScenarioId) ?? summaries[0]
  if (!shown) return null

  const { balance, contributions, interest } = shown.final
  const interestShare = balance !== 0 ? (interest / balance) * 100 : 0
  const lasts =
    shown.depletedAtYear === null
      ? t('stat.lasts.through', 'reicht durch')
      : t('stat.lasts.until', `bis Jahr ${shown.depletedAtYear}`, { year: shown.depletedAtYear })

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 sm:mb-3">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{shown.label}</span>
        {summaries.length > 1 ? (
          <span className="text-xs text-[var(--text-muted)]">
            {t('stat.ofVisible', `von ${summaries.length} sichtbaren · Vergleich in Legende und Tabelle`, {
              count: summaries.length,
            })}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6 sm:gap-y-4 lg:grid-cols-4">
        {hasWithdrawalPhase ? (
          <>
            <Stat
              label={t('stat.atRetirement', 'Bei Rentenbeginn')}
              value={formatEur(shown.capitalAtRetirement)}
              accentVar="var(--chart-1)"
            />
            <Stat
              label={t('stat.monthlyWithdrawal', 'Monatliche Entnahme')}
              value={formatEur(shown.monthlyWithdrawal)}
              detail={
                // Nur zeigen, wenn er abweicht - sonst wäre es eine Dopplung.
                Math.abs(shown.monthlyWithdrawalAtStart - shown.monthlyWithdrawal) > 1
                  ? t(
                      'stat.nominalAtStart',
                      `nominal zu Beginn ${formatEur(shown.monthlyWithdrawalAtStart)}`,
                      { value: formatEur(shown.monthlyWithdrawalAtStart) },
                    )
                  : undefined
              }
            />
            <Stat
              label={t('stat.lasts', 'Kapital reicht')}
              value={lasts}
              accentVar={shown.depletedAtYear === null ? undefined : 'var(--chart-8)'}
            />
            <Stat label={t('stat.remaining', 'Restkapital')} value={formatEur(balance)} />
          </>
        ) : (
          <>
            <Stat
              label={t('stat.final', 'Endkapital')}
              value={formatEur(balance)}
              accentVar="var(--chart-1)"
            />
            <Stat
              label={t('stat.contributed', 'Eingezahlt')}
              value={formatEur(contributions)}
              accentVar="var(--chart-2)"
            />
            <Stat label={t('stat.interest', 'Zinsertrag')} value={formatEur(interest)} />
            <Stat
              label={t('stat.interestShare', 'Anteil Zinsertrag')}
              value={formatPercent(interestShare)}
            />
          </>
        )}
      </div>
    </div>
  )
}
