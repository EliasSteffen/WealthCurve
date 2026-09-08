import type { ProjectionLine } from '../../core/projection'
import { formatEur } from '../../lib/format'
import { useSeriesLabel } from '../../react/useSeriesLabel'

interface TooltipPayloadEntry {
  readonly dataKey?: string | number
  readonly value?: number | null
}

interface ChartTooltipProps {
  readonly active?: boolean
  readonly label?: string | number
  readonly payload?: readonly TooltipPayloadEntry[]
  readonly series: readonly ProjectionLine[]
}

/**
 * Ein Tooltip für ALLE Serien am gehoverten Jahr - der Zeiger muss nie eine
 * einzelne Linie treffen. Der Wert führt, der Serienname folgt: der Leser hat
 * die Serie schon und will die Zahl.
 */
export function ChartTooltip({ active, label, payload, series }: ChartTooltipProps) {
  const labelOf = useSeriesLabel()
  if (!active || !payload?.length) return null

  const byKey = new Map(payload.map((entry) => [String(entry.dataKey), entry.value]))
  const rows = series
    .map((s) => ({ series: s, value: byKey.get(s.key) }))
    .filter((row): row is { series: ProjectionLine; value: number } => typeof row.value === 'number')
    .sort((a, b) => b.value - a.value)

  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-xs font-semibold text-[var(--text-primary)]">
        Jahr {String(label)}
      </p>
      <ul className="space-y-1">
        {rows.map(({ series: s, value }) => (
          <li key={s.key} className="flex items-center gap-2.5 text-xs">
            {/* Kurzer Strich statt gefülltem Kästchen - in Tooltip-Dichte
                wäre ein Block Daten-Gewicht für eine Label-Aufgabe. */}
            <span
              aria-hidden
              className="h-0.5 w-3.5 shrink-0 rounded-full"
              style={{ background: s.colorVar, opacity: s.opacity }}
            />
            <span className="text-[var(--text-secondary)]">{labelOf(s)}</span>
            <span className="ml-auto font-semibold tabular-nums text-[var(--text-primary)]">
              {formatEur(value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
