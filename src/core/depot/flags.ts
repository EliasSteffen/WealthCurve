/**
 * Risiko-Hinweise: messbare Auffälligkeiten des Depots, nach festen Regeln.
 *
 * Bewusst keine Empfehlungen: ein Hinweis sagt, was die Zahlen zeigen und
 * welche Positionen den Wert bestimmen - was daraus folgt, entscheidet der
 * Anleger. Die Grenzwerte stehen offen in FLAG_LIMITS, nicht versteckt im Code.
 */
import { isWindowStats, type DepotStats } from './metrics.ts'
import { NON_EQUITY_KEYS, type LookThrough } from './lookthrough.ts'
import type { DepotHolding } from './types.ts'

export type FlagId =
  | 'company'
  | 'top10'
  | 'country'
  | 'sector'
  | 'leverage'
  | 'riskShare'
  | 'currency'
  | 'cost'
  | 'overlap'
  | 'drawdown'
  | 'data'

export interface DepotFlag {
  readonly id: FlagId
  readonly level: 'warn' | 'info'
  /** Zahlen als Anteile (0.05 = 5 %), von der Oberfläche formatiert. */
  readonly values: Readonly<Record<string, number>>
  /** Betroffene Namen: Firmen, Positionen, Länder- oder Branchenschlüssel. */
  readonly names: readonly string[]
}

export const FLAG_LIMITS = {
  /** Einzelfirma über alle Positionen, in % des Depotwerts. */
  company: 0.05,
  /** Die zehn größten Firmen zusammen, in % des Engagements. */
  top10: 0.3,
  country: 0.5,
  sector: 0.3,
  /** Risikoanteil gilt als auffällig ab diesem Vielfachen des Anteils … */
  riskFactor: 1.5,
  /** … und erst ab diesem Risikoanteil. */
  riskMin: 0.1,
  foreignCurrency: 0.5,
  costShare: 0.3,
  drawdown: -0.2,
} as const

const NOT_EQUITY = NON_EQUITY_KEYS

export function depotFlags(
  holdings: readonly DepotHolding[],
  stats: DepotStats | null,
  look: LookThrough | null,
): DepotFlag[] {
  const flags: DepotFlag[] = []
  const nameOf = (id: string) => holdings.find((h) => h.id === id)?.name || id

  if (look && look.exposure > 0) {
    for (const c of look.companies.slice(0, 3)) {
      if (c.exposure <= FLAG_LIMITS.company) break
      flags.push({
        id: 'company',
        level: 'warn',
        values: { exposure: c.exposure, direct: c.direct, positions: c.via.length },
        names: [c.name, ...c.via.map(nameOf)],
      })
    }

    const top10 = look.companies.slice(0, 10).reduce((s, c) => s + c.exposure, 0) / look.exposure
    if (top10 > FLAG_LIMITS.top10) flags.push({ id: 'top10', level: 'info', values: { share: top10 }, names: [] })

    const topCountry = look.countries.find((s) => !NOT_EQUITY.has(s.key))
    if (topCountry && topCountry.value / look.exposure > FLAG_LIMITS.country) {
      flags.push({
        id: 'country',
        level: 'warn',
        values: { share: topCountry.value / look.exposure },
        names: [topCountry.key],
      })
    }

    const topSector = look.sectors.find((s) => !NOT_EQUITY.has(s.key))
    if (topSector && topSector.value / look.exposure > FLAG_LIMITS.sector) {
      flags.push({
        id: 'sector',
        level: 'warn',
        values: { share: topSector.value / look.exposure },
        names: [topSector.key],
      })
    }

    const foreign = look.currencies.filter((s) => s.key !== 'EUR' && s.key !== 'unknown')
    const foreignShare = foreign.reduce((s, c) => s + c.value, 0)
    if (foreignShare > FLAG_LIMITS.foreignCurrency) {
      flags.push({
        id: 'currency',
        level: 'info',
        values: { share: foreignShare },
        names: foreign.slice(0, 3).map((c) => c.key),
      })
    }

    const overlap = holdings
      .filter((h) => h.kind === 'stock')
      .map((h) => look.companies.find((c) => c.via.includes(h.id) && c.direct > 0))
      .filter((c): c is NonNullable<typeof c> => c !== undefined && c.exposure > c.direct * 1.1)
    if (overlap.length > 0) {
      flags.push({
        id: 'overlap',
        level: 'info',
        values: { indirect: overlap.reduce((s, c) => s + c.exposure - c.direct, 0) },
        names: overlap.map((c) => c.name),
      })
    }
  }

  if (stats) {
    if (stats.exposure > 1.001) {
      flags.push({
        id: 'leverage',
        level: 'warn',
        values: { exposure: stats.exposure, extra: stats.exposure - 1 },
        names: holdings.filter((h) => h.leverage > 1).map((h) => h.name || h.id),
      })
    }

    for (const h of stats.holdings) {
      if (h.riskShare >= FLAG_LIMITS.riskMin && h.riskShare > FLAG_LIMITS.riskFactor * h.weight) {
        flags.push({
          id: 'riskShare',
          level: 'warn',
          values: { weight: h.weight, riskShare: h.riskShare, years: stats.holdingsYears ?? 0 },
          names: [nameOf(h.id)],
        })
      }
    }

    for (const h of stats.holdings) {
      if (h.ter > 0 && h.costShare >= FLAG_LIMITS.costShare && stats.holdings.length > 1) {
        flags.push({
          id: 'cost',
          level: 'info',
          values: { ter: h.ter, costShare: h.costShare, total: stats.ter, weight: h.weight },
          names: [nameOf(h.id)],
        })
      }
    }

    const windows = stats.windows.filter(isWindowStats)
    const worst = windows.reduce<(typeof windows)[number] | null>(
      (w, x) => (w === null || x.maxDrawdown < w.maxDrawdown ? x : w),
      null,
    )
    if (worst && worst.maxDrawdown < FLAG_LIMITS.drawdown) {
      flags.push({
        id: 'drawdown',
        level: 'info',
        values: { drawdown: worst.maxDrawdown, years: worst.years },
        names: [],
      })
    }
  }

  const missing = [...new Set([...(stats?.missing ?? []), ...(look?.missing ?? [])])]
  if (missing.length > 0) {
    flags.push({ id: 'data', level: 'info', values: { count: missing.length }, names: missing.map(nameOf) })
  }

  return flags.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1))
}
