import { scenarioFigures, type ScenarioFigures } from '../../core/analytics'
import type { Projection, ProjectionSummary } from '../../core/projection'
import { slotVar } from '../../core/palette'
import { actions } from '../../core/state'
import { effectiveMode } from '../../core/timeAxis'
import { cn } from '../../lib/cn'
import { formatEur, formatPercent } from '../../lib/format'
import { formatDecimal, signedEur, signedPercent } from '../../lib/numbers'
import { useT } from '../../react/localeContext'
import { useDispatch, useSelector } from '../../react/useSelector'

interface Zeile {
  readonly id: string
  readonly label: string
  readonly wert: (s: ProjectionSummary, z: ScenarioFigures) => string
  /** Die Spalte mit dem höchsten Wert wird hervorgehoben - nur wo „mehr" auch „besser" heißt. */
  readonly besser?: (s: ProjectionSummary, z: ScenarioFigures) => number | null
  readonly ton?: (s: ProjectionSummary, z: ScenarioFigures) => 'up' | 'down' | undefined
}

/**
 * Alle sichtbaren Szenarien nebeneinander - Kennzahl je Zeile, Szenario je Spalte.
 *
 * Der Vergleich, den früher Legende und Tabelle nur nebenbei trugen. Der beste
 * Wert einer Zeile ist markiert, die Spalte des bearbeiteten Szenarios unterlegt.
 */
export function CompareTable({ projection }: { readonly projection: Projection }) {
  const t = useT()
  const dispatch = useDispatch()
  const scenarios = useSelector((s) => s.scenarios)
  const activeId = useSelector((s) => s.activeScenarioId)
  const model = useSelector((s) => s.model)
  const jahre = projection.rows.length - 1
  const mitEntnahme = projection.retirementYear > 0 && projection.retirementYear < jahre
  const spalten = projection.summaries.map((s) => ({ s, z: scenarioFigures(s, jahre) }))
  const label = (i: number) => projection.yearLabels[i] ?? String(i)
  const modus = effectiveMode(model)

  const zeilen: Zeile[] = [
    { id: 'rate', label: t('param.annualRate.label', 'Rendite p. a.'), wert: (s) => formatPercent(s.params.annualRate) },
    { id: 'start', label: t('param.initialCapital.label', 'Startkapital'), wert: (s) => formatEur(s.params.initialCapital) },
    {
      id: 'monthly',
      label: t('param.monthlyContribution.label', 'Monatliche Sparrate'),
      wert: (s) => formatEur(s.params.monthlyContribution),
    },
    {
      id: 'final',
      label: t('stat.final', 'Endkapital'),
      wert: (_, z) => formatEur(z.finalValue),
      besser: (_, z) => z.finalValue,
    },
    { id: 'contributed', label: t('stat.contributed', 'Eingezahlt'), wert: (_, z) => formatEur(z.contributions) },
    ...(mitEntnahme
      ? [{ id: 'withdrawn', label: t('pro.withdrawn', 'Entnommen'), wert: (_: ProjectionSummary, z: ScenarioFigures) => formatEur(z.withdrawals) }]
      : []),
    {
      id: 'gain',
      label: t('pro.gain', 'Ertrag'),
      wert: (_, z) => signedEur(z.gain),
      besser: (_, z) => z.gain,
      ton: (_, z) => (z.gain >= 0 ? 'up' : 'down'),
    },
    {
      id: 'gainRatio',
      label: t('pro.gainRatio', 'Ertrag je Euro'),
      wert: (_, z) => (z.gainRatio === null ? '–' : signedPercent(z.gainRatio)),
      besser: (_, z) => z.gainRatio,
    },
    {
      id: 'multiple',
      label: t('pro.multiple', 'Vervielfachung'),
      wert: (_, z) => (z.multiple === null ? '–' : `× ${formatDecimal(z.multiple, 2)}`),
      besser: (_, z) => z.multiple,
    },
    {
      id: 'doubling',
      label: t('pro.doubling', 'Verdopplung alle'),
      wert: (_, z) =>
        z.doublingYears === null ? '–' : t('pro.yearsShort', '{n} J.', { n: formatDecimal(z.doublingYears) }),
    },
    {
      id: 'real',
      label: t('pro.real', 'Endwert in heutiger Kaufkraft'),
      wert: (_, z) => formatEur(z.realFinalValue),
      besser: (_, z) => z.realFinalValue,
    },
    ...(mitEntnahme
      ? ([
          {
            id: 'atRetirement',
            label: t('stat.atRetirement', 'Bei Rentenbeginn'),
            wert: (s) => formatEur(s.capitalAtRetirement),
            besser: (s) => s.capitalAtRetirement,
          },
          {
            id: 'withdrawal',
            label: t('stat.monthlyWithdrawal', 'Monatliche Entnahme'),
            wert: (s) => formatEur(s.monthlyWithdrawal),
            besser: (s) => s.monthlyWithdrawal,
          },
          {
            id: 'lasts',
            label: t('stat.lasts', 'Kapital reicht'),
            wert: (s) => {
              if (s.depletedAtYear === null) return t('stat.lasts.through', 'reicht durch')
              const j = label(s.depletedAtYear)
              if (modus === 'calendar') return t('stat.lasts.untilCalendar', `bis ${j}`, { year: j })
              if (modus === 'age') return t('stat.lasts.untilAge', `bis Alter ${j}`, { year: j })
              return t('stat.lasts.until', `bis Jahr ${j}`, { year: j })
            },
            ton: (s) => (s.depletedAtYear === null ? 'up' : 'down'),
          },
        ] satisfies Zeile[])
      : []),
  ]

  if (spalten.length === 0) return null

  return (
    <table className="w-full border-separate border-spacing-0 text-right text-[11px]">
      <caption className="sr-only">{t('compare.caption', 'Kennzahlen aller sichtbaren Szenarien im Vergleich')}</caption>
      <thead className="sticky top-0 z-10 bg-[var(--surface-1)]">
        <tr>
          <th scope="col" className="border-b border-[var(--grid)] px-3 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            {t('compare.metric', 'Kennzahl')}
          </th>
          {spalten.map(({ s }) => {
            const sc = scenarios.find((x) => x.id === s.scenarioId)
            return (
              <th
                key={s.scenarioId}
                scope="col"
                className={cn('border-b border-[var(--grid)] px-3 py-1 font-medium', s.scenarioId === activeId && 'bg-[var(--surface-2)]')}
              >
                <button
                  type="button"
                  onClick={() => dispatch(actions.selectScenario(s.scenarioId))}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] hover:underline"
                >
                  {sc ? <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: slotVar(sc.colorSlot) }} /> : null}
                  {s.label || '–'}
                </button>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {zeilen.map((z) => {
          const werte = z.besser ? spalten.map(({ s, z: f }) => z.besser!(s, f)) : []
          const zahlen = werte.filter((w): w is number => w !== null)
          const bester = spalten.length > 1 && zahlen.length > 1 ? Math.max(...zahlen) : null
          return (
            <tr key={z.id} className="hover:bg-[var(--grid)]">
              <th scope="row" className="px-3 py-[3px] text-left font-normal text-[var(--text-secondary)]">
                {z.label}
              </th>
              {spalten.map(({ s, z: f }, i) => {
                const ton = z.ton?.(s, f)
                const top = bester !== null && werte[i] === bester
                return (
                  <td
                    key={s.scenarioId}
                    className={cn(
                      'whitespace-nowrap px-3 py-[3px] text-[var(--text-primary)]',
                      s.scenarioId === activeId && 'bg-[var(--surface-2)]',
                      top && 'font-semibold',
                    )}
                    style={ton ? { color: `var(--${ton})` } : undefined}
                  >
                    {top ? <span className="sr-only">{t('compare.best', 'Bester Wert:')} </span> : null}
                    {z.wert(s, f)}
                    {top ? <span aria-hidden className="ml-1 text-[9px] text-[var(--accent-text)]">▲</span> : null}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
