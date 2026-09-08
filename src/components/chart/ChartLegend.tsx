import type { ProjectionRow, ProjectionLine } from '../../core/projection'
import { formatEur } from '../../lib/format'

interface ChartLegendProps {
  readonly series: readonly ProjectionLine[]
  readonly rows: readonly ProjectionRow[]
  /** Was Farbe und Strich bedeuten - kommt aus der aktiven Kodierung. */
  readonly encodingDescription: string
  readonly showEncodingHint: boolean
}

/**
 * Die Legende ist rein darstellend. Recharts' eigene <Legend> kann klick-to-toggle
 * und würde gegen das SeriesPanel arbeiten - zwei Wahrheiten für dieselbe
 * Sichtbarkeit. Umgeschaltet wird ausschließlich im Panel.
 *
 * Sie trägt zusätzlich den Endwert jeder Serie: damit ist jeder Wert auch ohne
 * Hover erreichbar - nötig, weil Aqua und Gelb auf heller Fläche unter 3:1
 * Kontrast liegen.
 */
export function ChartLegend({ series, rows, encodingDescription, showEncodingHint }: ChartLegendProps) {
  const finalValueOf = (key: string): number | null => {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const value = rows[i][key]
      if (typeof value === 'number') return value
    }
    return null
  }

  return (
    <div className="mt-2">
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {series.map((s) => {
          const value = finalValueOf(s.key)
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-0.5 w-5 shrink-0 rounded-full"
                style={{
                  // Der Legenden-Schlüssel spiegelt den Strichstil der Kurve.
                  background: s.dash
                    ? `repeating-linear-gradient(90deg, ${s.colorVar} 0 5px, transparent 5px 9px)`
                    : s.colorVar,
                  opacity: s.opacity,
                }}
              />
              <span className="text-xs text-[var(--text-secondary)]">{s.label}</span>
              {value !== null ? (
                <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatEur(value)}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
      {showEncodingHint ? (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">{encodingDescription}</p>
      ) : null}
    </div>
  )
}
