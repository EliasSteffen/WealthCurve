import type { ProjectionSummary } from '../core/projection'
import { selectProjection } from '../core/derive'
import { actions } from '../core/state'
import { effectiveMode } from '../core/timeAxis'
import { formatEur, formatPercent } from '../lib/format'
import { useT } from '../react/localeContext'
import { useDispatch, useSelector } from '../react/useSelector'
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
  const dispatch = useDispatch()
  const yearLabels = useSelector((s) => selectProjection(s).yearLabels)
  const model = useSelector((s) => s.model)
  const aktiv = useSelector((s) => s.scenarios.find((sc) => sc.id === activeScenarioId))
  const shown = summaries.find((s) => s.scenarioId === activeScenarioId) ?? summaries[0]
  if (!shown) return null

  const { balance, contributions, interest } = shown.final
  const interestShare = balance !== 0 ? (interest / balance) * 100 : 0
  /*
   * Die Beschriftung der Achse statt des rohen Jahresindex: bei Kalenderachse
   * stünde sonst „Jahr 23" unter einer Achse, die 2049 zeigt. Die Formulierung
   * richtet sich nach dem, was die Achse zählt.
   */
  const bis = shown.depletedAtYear === null ? null : shown.depletedAtYear
  const bisLabel =
    bis === null ? '' : (yearLabels[bis] ?? String(bis))
  const modus = effectiveMode(model)
  const lasts =
    bis === null
      ? t('stat.lasts.through', 'reicht durch')
      : modus === 'calendar'
        ? t('stat.lasts.untilCalendar', `bis ${bisLabel}`, { year: bisLabel })
        : modus === 'age'
          ? t('stat.lasts.untilAge', `bis Alter ${bisLabel}`, { year: bisLabel })
          : t('stat.lasts.until', `bis Jahr ${bisLabel}`, { year: bisLabel })
  // Der bearbeitete Regler-Satz gehört zu einem ausgeblendeten Szenario: die
  // Kennzahlen zeigen dann ein anderes, und das muss man sehen.
  const versteckt = aktiv !== undefined && !aktiv.visible

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

      {versteckt ? (
        <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--chart-8)] sm:mb-3">
          <span>
            {t(
              'stat.hiddenActive',
              `„${aktiv.label}" ist ausgeblendet – die Regler ändern es, die Kennzahlen zeigen ein anderes Szenario.`,
              { name: aktiv.label },
            )}
          </span>
          <button
            type="button"
            onClick={() => dispatch(actions.setScenarioVisible(aktiv.id, true))}
            className="rounded-md border border-[var(--hairline)] px-2 py-0.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--grid)]"
          >
            {t('stat.showActive', 'Einblenden')}
          </button>
        </p>
      ) : null}

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
