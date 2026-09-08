import { SERIES_BY_ID } from '../core/domain/series'
import type { ProjectionLine } from '../core/projection'
import { useT } from './localeContext'

/**
 * Setzt die Beschriftung einer Chart-Linie in der aktiven Sprache zusammen.
 *
 * Der Kern liefert eine fertige deutsche Beschriftung; übersetzt wird erst
 * hier, weil `buildProjection` sprachfrei bleiben soll - es läuft auch im
 * MCP-Server und im Node-Skript, wo es keinen Sprachkontext gibt.
 */
export function useSeriesLabel(): (line: ProjectionLine) => string {
  const t = useT()
  return (line) => {
    const series = SERIES_BY_ID.get(line.seriesId)
    const name = series ? t(`series.${line.seriesId}.label`, series.label) : line.label
    return line.scenarioLabel ? `${name} · ${line.scenarioLabel}` : name
  }
}
