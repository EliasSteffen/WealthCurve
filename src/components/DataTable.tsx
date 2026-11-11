import { Download } from 'lucide-react'
import { useState } from 'react'
import { projectionToCsv } from '../core/csv'
import { selectProjection } from '../core/derive'
import type { ProjectionRow, ProjectionLine } from '../core/projection'
import { downloadCsv } from '../lib/download'
import { formatEur } from '../lib/format'
import { useT } from '../react/localeContext'
import { useStore } from '../react/storeContext'
import { useSeriesLabel } from '../react/useSeriesLabel'

interface DataTableProps {
  readonly rows: readonly ProjectionRow[]
  readonly series: readonly ProjectionLine[]
  /** Beschriftung je Jahres-Index; ohne sie steht der rohe Index da. */
  readonly yearLabels?: readonly string[]
  /** Überschrift der ersten Spalte; folgt der gewählten Beschriftung. */
  readonly yearHeading?: string
}

/**
 * Die Tabellenansicht ist Pflicht, nicht Kür: mehrere Serienfarben liegen auf
 * heller Fläche unter 3:1 Kontrast, und dann verlangt die Farbprüfung einen
 * farbunabhängigen Weg zu jedem Wert. Für einen Finanzrechner ist sie ohnehin
 * das, was man am Ende abliest.
 */
export function DataTable({ rows, series, yearLabels, yearHeading }: DataTableProps) {
  const t = useT()
  const labelOf = useSeriesLabel()
  const store = useStore()
  const [open, setOpen] = useState(false)

  if (series.length === 0) return null

  // Erst beim Klick lesen: der Export braucht die aktuelle Projektion, aber
  // keine Subscription - die Tabelle bekommt ihre Zeilen ohnehin als Props.
  const exportCsv = () => downloadCsv(projectionToCsv(selectProjection(store.getSnapshot())))

  return (
    <div className="relative">
      <details
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)]"
      >
        <summary className="cursor-pointer select-none px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t('table.title', 'Jahreswerte als Tabelle')}
        </summary>
        {/* Zugeklappt bleibt der Körper leer: bis zu ~110 x N Zeilen bei jedem
          Reglerschritt neu zu rendern wäre reine Verschwendung. */}
        {open ? (
          <>
            {/* Breite Tabellen scrollen in ihrem eigenen Container - die Seite selbst
          darf nie horizontal scrollen. */}
            <div className="max-h-96 overflow-auto border-t border-[var(--hairline)]">
              <table className="w-full text-right text-xs tabular-nums">
                <caption className="sr-only">
                  {t('table.caption', 'Entwicklung je Jahr für alle aktiven Serien')}
                </caption>
                <thead className="sticky top-0 bg-[var(--surface-1)]">
                  <tr className="border-b border-[var(--hairline)]">
                    <th scope="col" className="px-4 py-2 text-left font-medium text-[var(--text-muted)]">
                      {yearHeading ?? t('table.year', 'Jahr')}
                    </th>
                    {series.map((s) => (
                      <th
                        key={s.key}
                        scope="col"
                        className="whitespace-nowrap px-4 py-2 font-medium text-[var(--text-muted)]"
                      >
                        {labelOf(s)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.year} className="border-b border-[var(--hairline)] last:border-0">
                      <th
                        scope="row"
                        className="px-4 py-1.5 text-left font-normal text-[var(--text-secondary)]"
                      >
                        {yearLabels?.[row.year] ?? row.year}
                      </th>
                      {series.map((s) => {
                        const value = row[s.key]
                        return (
                          <td
                            key={s.key}
                            className="whitespace-nowrap px-4 py-1.5 text-[var(--text-primary)]"
                          >
                            {typeof value === 'number' ? formatEur(value) : '–'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </details>
      <button
        type="button"
        onClick={exportCsv}
        title={t('table.download', 'CSV herunterladen')}
        aria-label={t('table.download', 'CSV herunterladen')}
        className="absolute right-3 top-1.5 flex size-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
      >
        <Download size={15} aria-hidden />
      </button>
    </div>
  )
}
