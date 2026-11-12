import { describe, expect, it } from 'vitest'
import {
  GOAL_PRESETS,
  applyPreset,
  evaluateGoals,
  goalAdvice,
  type GoalTarget,
} from '../../../src/core/depot/goals'
import { computeLookThrough, sanitizeDepot, type DepotHolding } from '../../../src/core/depot/index'
import type { LookThrough, Share } from '../../../src/core/depot/lookthrough'
import { actions, createInitialState, deserialize, reducer, serialize } from '../../../src/core/state'
import { toShareJson } from '../../../src/lib/persistence'

const holding = (over: Partial<DepotHolding> & { id: string }): DepotHolding => ({
  name: over.id,
  symbol: '',
  weight: 0,
  ter: 0,
  leverage: 1,
  kind: 'etf',
  lookThrough: '',
  ...over,
})

/** Eine Durchschau von Hand - die Ziele brauchen nur die Summen je Dimension. */
function look(over: Partial<Record<'assets' | 'markets' | 'continents' | 'countries' | 'sectors' | 'sizes', Share[]>>): LookThrough {
  return {
    exposure: 1,
    dates: [],
    missing: [],
    estimated: [],
    sources: {},
    assets: [],
    continents: [],
    markets: [],
    countries: [],
    sectors: [],
    sizes: [],
    currencies: [],
    products: [],
    companies: [],
    ...over,
  }
}

const ziel = (dim: GoalTarget['dim'], key: string, min: number | null, max: number | null): GoalTarget => ({
  dim,
  key,
  min,
  max,
})

describe('evaluateGoals', () => {
  const heute = look({
    assets: [{ key: 'equity', value: 1 }],
    markets: [
      { key: 'developed', value: 0.95 },
      { key: 'emerging', value: 0.05 },
    ],
    countries: [
      { key: 'US', value: 0.7 },
      { key: 'DE', value: 0.25 },
      { key: 'CN', value: 0.05 },
    ],
  })

  it('rechnet Abstand, Zukauf und Umschichtung je Ziel', () => {
    const [em, dev] = evaluateGoals(heute, [ziel('market', 'emerging', 0.1, 0.15), ziel('market', 'developed', null, 0.9)])
    expect(em).toMatchObject({ status: 'below', current: 0.05 })
    expect(em.gap).toBeCloseTo(0.05)
    // (0,05 + x) / (1 + x) = 0,10  ->  x = 0,05 / 0,9
    expect(em.buy).toBeCloseTo(0.05 / 0.9)
    expect(em.shift).toBeCloseTo(0.05)
    expect(dev).toMatchObject({ status: 'above' })
    // 0,95 / (1 + y) = 0,9  ->  y = 0,05 / 0,9
    expect(dev.buy).toBeCloseTo(0.05 / 0.9)
  })

  it('prüft "jedes Land" einzeln und meldet nur die Verletzer', () => {
    const checks = evaluateGoals(heute, [ziel('country', '*', null, 0.5)])
    expect(checks.map((c) => [c.key, c.status])).toEqual([['US', 'above']])
    const ok = evaluateGoals(heute, [ziel('country', '*', null, 0.8)])
    expect(ok.map((c) => [c.key, c.status])).toEqual([['US', 'ok']])
  })

  it('rechnet Unbekanntes aus dem Nenner heraus und meldet die Abdeckung', () => {
    const halb = look({
      assets: [
        { key: 'equity', value: 0.6 },
        { key: 'unknown', value: 0.4 },
      ],
      markets: [
        { key: 'developed', value: 0.3 },
        { key: 'emerging', value: 0.1 },
        { key: 'unknown', value: 0.6 },
      ],
    })
    const [em] = evaluateGoals(halb, [ziel('market', 'emerging', 0.1, null)])
    expect(em.current).toBeCloseTo(0.25)
    expect(em.coverage).toBeCloseTo(0.4)
    expect(evaluateGoals(look({}), [ziel('size', 'small', 0.1, null)])[0].status).toBe('noData')
  })
})

describe('goalAdvice', () => {
  it('schlägt für zu wenig Schwellenländer einen Schwellenländer-Baustein vor', () => {
    const depot = computeLookThrough(
      [
        holding({ id: 'SP', name: 'iShares Core S&P 500', weight: 0.6 }),
        holding({ id: 'EU', name: 'Vanguard FTSE Developed Europe', weight: 0.4 }),
      ],
      new Map(),
    )
    const advice = goalAdvice(depot, GOAL_PRESETS.em30)
    expect(advice.suggestions[0]).toMatchObject({ block: 'em', fixes: 2, breaks: 0 })
    // 30 % Schwellenländer-Anteil: x / (1 + x) = 0,25  ->  rund ein Drittel des Depotwerts.
    expect(advice.suggestions[0].amount).toBeGreaterThan(0.3)
    expect(advice.suggestions[0].amount).toBeLessThan(0.36)
    expect(advice.suggestions[0].after).toBeLessThan(1e-4)
  })

  it('verdünnt ein zu großes Land mit dem, was am wenigsten kostet', () => {
    const depot = computeLookThrough([holding({ id: 'SP', name: 'iShares Core S&P 500', weight: 1 })], new Map())
    const advice = goalAdvice(depot, [ziel('country', '*', null, 0.6)])
    // Ein Welt-ETF ist selbst zu 72 % USA - nur Bausteine ohne USA kommen in Frage.
    expect(advice.suggestions.map((s) => s.block)).not.toContain('world')
    expect(advice.suggestions[0].after).toBeLessThan(1e-4)
  })

  it('bleibt still, wenn alles passt', () => {
    const depot = computeLookThrough([holding({ id: 'W', name: 'Vanguard FTSE All-World', weight: 1 })], new Map())
    const advice = goalAdvice(depot, GOAL_PRESETS.marketWeight)
    expect(advice.checks.every((c) => c.status === 'ok')).toBe(true)
    expect(advice.suggestions).toEqual([])
    expect(advice.plan).toBeNull()
  })

  it('plant mehrere Bausteine, wenn einer nicht reicht', () => {
    const depot = computeLookThrough([holding({ id: 'SP', name: 'iShares Core S&P 500', weight: 1 })], new Map())
    const advice = goalAdvice(depot, [
      ziel('market', 'emerging', 0.1, null),
      ziel('asset', 'bond', 0.2, null),
    ])
    expect(advice.plan?.steps.map((s) => s.block).sort()).toEqual(['bonds', 'em'])
    expect(advice.plan?.open).toBe(0)
  })
})

describe('Ziele im Zustand', () => {
  it('ersetzt mit einer Vorlage nur die Dimensionen, die sie festlegt', () => {
    const eigene = [ziel('sector', 'it', null, 0.25), ziel('market', 'emerging', 0.2, null)]
    const neu = applyPreset(eigene, 'marketWeight')
    expect(neu.filter((t) => t.dim === 'sector')).toEqual([eigene[0]])
    expect(neu.filter((t) => t.dim === 'market')).toEqual(GOAL_PRESETS.marketWeight.filter((t) => t.dim === 'market'))
  })

  it('übersteht neuen Import, Speichern und Laden - und bleibt aus dem Teilen-Link', () => {
    let state = createInitialState()
    state = reducer(state, actions.setDepot([holding({ id: 'A', weight: 1 })], 25000))
    state = reducer(state, actions.setDepotGoals([ziel('market', 'emerging', 0.1, 0.15)]))
    state = reducer(state, actions.setDepot([holding({ id: 'B', weight: 1 })]))
    expect(state.depot.goals).toHaveLength(1)
    expect(state.depot.value).toBe(25000)

    const geladen = deserialize(serialize(state))
    expect(geladen?.depot.goals).toEqual(state.depot.goals)
    expect(geladen?.depot.value).toBe(25000)
    expect(toShareJson(state)).not.toContain('emerging')

    expect(reducer(state, actions.setDepotValue(-5)).depot.value).toBeNull()
  })

  it('verwirft unsinnige Ziele beim Laden', () => {
    const depot = sanitizeDepot({
      holdings: [],
      goals: [
        { dim: 'market', key: 'emerging', min: 0.2, max: 0.1 },
        { dim: 'market', key: 'emerging', min: 0.3, max: null },
        { dim: 'country', key: '*', min: 0.1, max: 0.5 },
        { dim: 'planet', key: 'mars', min: 0.1, max: null },
        { dim: 'sector', key: 'it', min: null, max: null },
        { dim: 'sector', key: '<script>', min: 0.1, max: null },
      ],
      value: 'viel',
    })
    expect(depot.goals).toEqual([
      // Vertauschte Grenzen werden gerade gerückt, Doppeltes fällt weg.
      { dim: 'market', key: 'emerging', min: 0.1, max: 0.2 },
      // "Jedes Land" kennt nur eine Obergrenze.
      { dim: 'country', key: '*', min: null, max: 0.5 },
    ])
    expect(depot.value).toBeNull()
  })
})
