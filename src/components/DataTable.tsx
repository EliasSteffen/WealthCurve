import { useState } from 'react'
import type { ProjectionRow, ProjectionLine } from '../core/projection'
import { formatEur } from '../lib/format'

interface DataTableProps {
  readonly rows: readonly ProjectionRow[]
  readonly series: readonly ProjectionLine[]
}

/**
 * Die Tabellenansicht ist Pflicht, nicht Kür: mehrere Serienfarben liegen auf
 * heller Fläche unter 3:1 Kontrast, und dann verlangt die Farbprüfung einen
 * farbunabhängigen Weg zu jedem Wert. Für einen Finanzrechner ist sie ohnehin
 * das, was man am Ende abliest.
 */
export function DataTable({ rows, series }: DataTableProps) {
  const [open, setOpen] = useState(false)

  if (series.length === 0) return null

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)]"
    >
      <summary className="cursor-pointer select-none px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Jahreswerte als Tabelle
      </summary>
      {/* Breite Tabellen scrollen in ihrem eigenen Container - die Seite selbst
          darf nie horizontal scrollen. */}
      <div className="max-h-96 overflow-auto border-t border-[var(--hairline)]">
        <table className="w-full text-right text-xs tabular-nums">
          <caption className="sr-only">
            Entwicklung je Jahr für alle aktiven Serien
          </caption>
          <thead className="sticky top-0 bg-[var(--surface-1)]">
            <tr className="border-b border-[var(--hairline)]">
              <th scope="col" className="px-4 py-2 text-left font-medium text-[var(--text-muted)]">
                Jahr
              </th>
              {series.map((s) => (
                <th
                  key={s.key}
                  scope="col"
                  className="whitespace-nowrap px-4 py-2 font-medium text-[var(--text-muted)]"
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-b border-[var(--hairline)] last:border-0">
                <th scope="row" className="px-4 py-1.5 text-left font-normal text-[var(--text-secondary)]">
                  {row.year}
                </th>
                {series.map((s) => {
                  const value = row[s.key]
                  return (
                    <td key={s.key} className="whitespace-nowrap px-4 py-1.5 text-[var(--text-primary)]">
                      {typeof value === 'number' ? formatEur(value) : '–'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
