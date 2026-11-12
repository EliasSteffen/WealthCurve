import { useMemo } from 'react'
import { computeDepotStats, scenarioRate } from '../../core/depot/metrics'
import { useSelector } from '../../react/useSelector'
import { useDepotData } from './useDepotData'

/**
 * Historische Rendite p. a. des eigenen Depots in Prozentpunkten, falls bekannt.
 *
 * Für die Rendite-Vorgabe „Wie mein Depot“ im Sparplan. Die Kurse kommen aus
 * demselben Zwischenspeicher wie auf der Depot-Seite - kein zweiter Abruf.
 */
export function useDepotRate(): number | null {
  const holdings = useSelector((s) => s.depot.holdings)
  const data = useDepotData(holdings)
  return useMemo(
    () => (holdings.length > 0 ? scenarioRate(computeDepotStats(holdings, data.series, data.fx)) : null),
    [holdings, data.series, data.fx],
  )
}
