import type { CapacityReport } from '../core/encoding'
import { SERIES } from '../core/domain/series'
import { Card, CardTitle } from './ui/Card'
import { Checkbox } from './ui/Checkbox'

interface SeriesPanelProps {
  readonly enabledSeriesIds: readonly string[]
  readonly onToggle: (id: string) => void
  readonly capacity: CapacityReport
}

export function SeriesPanel({ enabledSeriesIds, onToggle, capacity }: SeriesPanelProps) {

  return (
    <Card>
      <CardTitle>Serien</CardTitle>
      <div className="space-y-3.5">
        {SERIES.map((series) => (
          <Checkbox
            key={series.id}
            checked={enabledSeriesIds.includes(series.id)}
            onChange={() => onToggle(series.id)}
            label={series.label}
            description={series.description}
            colorVar={series.colorVar}
          />
        ))}
      </div>
      {capacity.message ? (
        <p className="mt-4 text-[11px] leading-snug text-[var(--text-muted)]">{capacity.message}</p>
      ) : null}
    </Card>
  )
}
