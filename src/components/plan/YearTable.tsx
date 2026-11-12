import { yearIndexTime, type TimeAnchor } from '../../core/analytics'
import type { Projection } from '../../core/projection'
import { intlLocale } from '../../i18n'
import { cn } from '../../lib/cn'
import { formatEur } from '../../lib/format'
import { useLocale, useT } from '../../react/localeContext'
import { useSeriesLabel } from '../../react/useSeriesLabel'
import { signedEur } from '../../lib/numbers'

interface YearTableProps {
  readonly projection: Projection
  readonly anchor: TimeAnchor
  readonly focusKey: string | null
  /** Überschrift der Achsenspalte; null blendet sie aus. */
  readonly yearHeading: string | null
}

/**
 * Jahreswerte als dichte Tabelle unter dem Chart - wie die Datenansicht eines Terminals.
 *
 * Datum und Achsenbeschriftung stehen nebeneinander, dazu die Veränderung der
 * Hauptkurve. Die Rentenzeile ist markiert, damit man die Phasengrenze auch hier findet.
 */
export function YearTable({ projection, anchor, focusKey, yearHeading }: YearTableProps) {
  const t = useT()
  const { locale } = useLocale()
  const labelOf = useSeriesLabel()
  const { rows, lines, yearLabels, retirementYear } = projection
  const monat = new Intl.DateTimeFormat(intlLocale(locale), { month: 'short', year: 'numeric', timeZone: 'UTC' })
  const fokus = focusKey && lines.some((l) => l.key === focusKey) ? focusKey : null
  const mitEntnahme = retirementYear > 0 && retirementYear < rows.length - 1
  const rentenMarke = (
    <span className="ml-1.5 rounded bg-[var(--accent-fill)] px-1 text-[9px] font-semibold uppercase text-[var(--on-accent)]">
      {t('chart.retirement', 'Rentenbeginn')}
    </span>
  )

  return (
    <table className="w-full border-separate border-spacing-0 text-right text-[11px] tabular-nums">
      <caption className="sr-only">{t('table.caption', 'Entwicklung je Jahr für alle aktiven Serien')}</caption>
      <thead className="sticky top-0 z-10 bg-[var(--surface-1)]">
        <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          <th scope="col" className="border-b border-[var(--grid)] px-3 py-1.5 text-left font-medium">
            {t('pro.col.date', 'Datum')}
          </th>
          {yearHeading === null ? null : (
            <th scope="col" className="border-b border-[var(--grid)] px-3 py-1.5 text-left font-medium">
              {yearHeading}
            </th>
          )}
          {lines.map((line) => (
            <th
              key={line.key}
              scope="col"
              className="max-w-40 truncate border-b border-[var(--grid)] px-3 py-1.5 font-medium normal-case tracking-normal"
              title={labelOf(line)}
            >
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-2.5 rounded-full" style={{ background: line.colorVar }} />
                {labelOf(line)}
              </span>
            </th>
          ))}
          {fokus ? (
            <th scope="col" className="border-b border-[var(--grid)] px-3 py-1.5 font-medium">
              {t('pro.col.delta', 'Δ Hauptkurve')}
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const wert = fokus ? row[fokus] : null
          const vorher = fokus && i > 0 ? rows[i - 1][fokus] : null
          const delta = typeof wert === 'number' && typeof vorher === 'number' ? wert - vorher : null
          const rente = mitEntnahme && i === retirementYear
          return (
            <tr
              key={row.year}
              className={cn('hover:bg-[var(--grid)]', rente && 'bg-[color-mix(in_srgb,var(--accent-fill)_10%,transparent)]')}
            >
              <td className="whitespace-nowrap px-3 py-[3px] text-left text-[var(--text-secondary)]">
                {monat.format(new Date(yearIndexTime(anchor, i) * 1000))}
                {rente && yearHeading === null ? rentenMarke : null}
              </td>
              {yearHeading === null ? null : (
                <td className="whitespace-nowrap px-3 py-[3px] text-left text-[var(--text-muted)]">
                  {yearLabels[i] ?? i}
                  {rente ? rentenMarke : null}
                </td>
              )}
              {lines.map((line) => {
                const v = row[line.key]
                return (
                  <td
                    key={line.key}
                    className={cn(
                      'whitespace-nowrap px-3 py-[3px] text-[var(--text-primary)]',
                      line.key === fokus && 'font-semibold',
                    )}
                  >
                    {typeof v === 'number' ? formatEur(v) : '–'}
                  </td>
                )
              })}
              {fokus ? (
                <td
                  className="whitespace-nowrap px-3 py-[3px]"
                  style={delta === null ? undefined : { color: delta >= 0 ? 'var(--up)' : 'var(--down)' }}
                >
                  {delta === null ? '–' : signedEur(delta)}
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
