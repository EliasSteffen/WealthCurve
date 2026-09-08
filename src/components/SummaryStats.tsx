import type { ProjectionSummary } from '../core/projection'
import { formatEur, formatPercent } from '../lib/format'
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
  const shown = summaries.find((s) => s.scenarioId === activeScenarioId) ?? summaries[0]
  if (!shown) return null

  const { balance, contributions, interest } = shown.final
  const interestShare = balance !== 0 ? (interest / balance) * 100 : 0
  const lasts = shown.depletedAtYear === null ? 'reicht durch' : `bis Jahr ${shown.depletedAtYear}`

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{shown.label}</span>
        {summaries.length > 1 ? (
          <span className="text-xs text-[var(--text-muted)]">
            von {summaries.length} sichtbaren · Vergleich in Legende und Tabelle
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {hasWithdrawalPhase ? (
          <>
            <Stat
              label="Bei Rentenbeginn"
              value={formatEur(shown.capitalAtRetirement)}
              accentVar="var(--chart-1)"
            />
            <Stat label="Monatliche Entnahme" value={formatEur(shown.monthlyWithdrawal)} />
            <Stat
              label="Kapital reicht"
              value={lasts}
              accentVar={shown.depletedAtYear === null ? undefined : 'var(--chart-8)'}
            />
            <Stat label="Restkapital" value={formatEur(balance)} />
          </>
        ) : (
          <>
            <Stat label="Endkapital" value={formatEur(balance)} accentVar="var(--chart-1)" />
            <Stat label="Eingezahlt" value={formatEur(contributions)} accentVar="var(--chart-2)" />
            <Stat label="Zinsertrag" value={formatEur(interest)} />
            <Stat label="Anteil Zinsertrag" value={formatPercent(interestShare)} />
          </>
        )}
      </div>
    </div>
  )
}
