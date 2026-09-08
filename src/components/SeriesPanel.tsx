import type { CapacityReport } from '../core/encoding'
import { SERIES } from '../core/domain/series'
import { useT } from '../react/localeContext'
import { Checkbox } from './ui/Checkbox'

interface SeriesPanelProps {
  readonly enabledSeriesIds: readonly string[]
  readonly onToggle: (id: string) => void
  readonly capacity: CapacityReport
  readonly matches?: ReadonlySet<string> | null
}

export function SeriesPanel({ enabledSeriesIds, onToggle, capacity, matches = null }: SeriesPanelProps) {
  const t = useT()
  const sichtbar = SERIES.filter((s) => matches === null || matches.has(`series:${s.id}`))
  if (sichtbar.length === 0) return null


  return (
    <div>
      <div className="space-y-3.5">
        {sichtbar.map((series) => (
          <Checkbox
            key={series.id}
            checked={enabledSeriesIds.includes(series.id)}
            onChange={() => onToggle(series.id)}
            label={t(`series.${series.id}.label`, series.label)}
            description={t(`series.${series.id}.description`, series.description)}
            colorVar={series.colorVar}
          />
        ))}
      </div>
      {capacity.message ? (
        <p className="mt-4 text-[11px] leading-snug text-[var(--text-muted)]">{capacity.message}</p>
      ) : null}
    </div>
  )
}
