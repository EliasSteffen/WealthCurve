import { useCallback } from 'react'
import { SERIES_BY_ID } from '../core/domain/series'
import type { ProjectionLine } from '../core/projection'
import { useT } from './localeContext'
import { useSelector } from './useSelector'

/**
 * Setzt die Beschriftung einer Chart-Linie in der aktiven Sprache zusammen.
 *
 * Der Kern liefert eine fertige deutsche Beschriftung; übersetzt wird erst
 * hier, weil `buildProjection` sprachfrei bleiben soll - es läuft auch im
 * MCP-Server und im Node-Skript, wo es keinen Sprachkontext gibt.
 */
export function useSeriesLabel(): (line: ProjectionLine) => string {
  const t = useT()
  const scenarios = useSelector((s) => s.scenarios)
  // Stabile Identität: der Video-Renderer hängt seine Zeichenfunktion daran, und
  // eine bei jedem Render neue Funktion startete die Vorschau jedes Mal neu.
  return useCallback((line) => {
    const series = SERIES_BY_ID.get(line.seriesId)
    const uebersetzt = series ? t(`series.${line.seriesId}.label`, series.label) : line.label
    // Das Tickersymbol bleibt unübersetzt - es IST der Name des Papiers.
    const name = line.variantLabel ? `${uebersetzt} ${line.variantLabel}` : uebersetzt
    if (line.scenarioLabel === null) return name
    // Ein leerer Name machte verglichene Linien ununterscheidbar - dann nach
    // Position benennen, wie es auch der Standardname beim Anlegen tut.
    let szenario = line.scenarioLabel.trim()
    if (szenario === '') {
      const position = scenarios.findIndex((s) => s.id === line.scenarioId) + 1
      szenario = t('scenario.fallbackName', `Szenario ${position}`, { n: String(position) })
    }
    return `${name} · ${szenario}`
  }, [t, scenarios])
}
