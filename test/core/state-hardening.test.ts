import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, sanitizeModel } from '@/core'
import { SLOT_COUNT } from '@/core/palette'
import { MAX_MARKETS, actions, createInitialState, deserialize, reducer, serialize } from '@/core/state'

const load = (blob: unknown) => deserialize(JSON.stringify(blob))
const scenario = (extra: Record<string, unknown> = {}) => ({
  id: 'a',
  label: 'A',
  colorSlot: 1,
  params: {},
  ...extra,
})

describe('sanitizeModel', () => {
  it('lässt ein gültiges Modell unverändert', () => {
    const model = {
      ...DEFAULT_MODEL,
      compounding: 'annual' as const,
      timing: 'start' as const,
      accumulationYears: 12,
      withdrawalYears: 7,
      withdrawalStrategyId: 'fixedAmount',
      amountsInflationAdjusted: true,
      timeAxis: 'age' as const,
      startAge: 30,
      startYear: 2020,
      startMonth: 6,
    }
    expect(sanitizeModel(model)).toEqual(model)
  })

  it('fällt bei Unsinn feldweise auf den Standard zurück', () => {
    expect(sanitizeModel(null)).toEqual(DEFAULT_MODEL)
    expect(sanitizeModel('x')).toEqual(DEFAULT_MODEL)
    expect(
      sanitizeModel({
        compounding: 'bogus',
        timing: 'bogus',
        accumulationYears: 'viel',
        withdrawalYears: null,
        withdrawalStrategyId: 'gibtsnicht',
        amountsInflationAdjusted: 'ja',
        timeAxis: 'bogus',
        startAge: 'alt',
        startYear: {},
        startMonth: 'Mai',
      }),
    ).toEqual(DEFAULT_MODEL)
  })

  it('begrenzt die Laufzeiten, statt die Simulation einzufrieren', () => {
    const m = sanitizeModel({ accumulationYears: 1e7, withdrawalYears: -5 })
    expect(m.accumulationYears).toBe(60)
    expect(m.withdrawalYears).toBe(0)
    expect(sanitizeModel({ accumulationYears: Infinity }).accumulationYears).toBe(
      DEFAULT_MODEL.accumulationYears,
    )
  })

  it('klemmt Anker auf ihre Grenzen und behält gültige Teile', () => {
    const m = sanitizeModel({ timing: 'start', startYear: 1e9, startAge: NaN, startMonth: 99 })
    expect(m.timing).toBe('start')
    expect(m.startYear).toBe(2100)
    expect(m.startAge).toBeNull()
    expect(m.startMonth).toBe(12)
  })

  it('wird vom Reducer bei model/set angewendet', () => {
    const state = reducer(
      createInitialState(),
      // @ts-expect-error - fremde Werte, genau der Fall, den der Reducer abfangen soll
      actions.setModel({ ...DEFAULT_MODEL, timing: 'bogus', accumulationYears: 1e7 }),
    )
    expect(state.model.timing).toBe(DEFAULT_MODEL.timing)
    expect(state.model.accumulationYears).toBe(60)
  })
})

describe('deserialize: Härtung', () => {
  it('weist die Reproduktion aus dem Fehlerbericht ab', () => {
    const state = load({
      scenarios: [{ id: 'a', label: 'A', colorSlot: 99, params: {} }],
      model: { accumulationYears: 1e7, timing: 'bogus', compounding: 'bogus' },
      enabledSeriesIds: 'compound',
    })!
    expect(state.model.accumulationYears).toBe(60)
    expect(state.model.timing).toBe('end')
    expect(state.model.compounding).toBe('monthly-effective')
    expect(state.scenarios[0].colorSlot).toBe(1)
    expect(Array.isArray(state.enabledSeriesIds)).toBe(true)
    expect(state.enabledSeriesIds).toEqual(createInitialState().enabledSeriesIds)
  })

  it('lässt unbekannte Schlüssel nicht in den Zustand', () => {
    const state = load({ scenarios: [scenario()], evil: 1, __proto__: { x: 1 } })!
    expect(Object.keys(state).sort()).toEqual(Object.keys(createInitialState()).sort())
  })

  it('begrenzt die Zahl der Szenarien auf die Palette', () => {
    const many = Array.from({ length: 20 }, (_, i) => scenario({ id: `s${i}`, colorSlot: i + 1 }))
    expect(load({ scenarios: many })!.scenarios).toHaveLength(SLOT_COUNT)
  })

  it('macht doppelte IDs eindeutig', () => {
    const state = load({
      scenarios: [scenario({ colorSlot: 1 }), scenario({ colorSlot: 2 }), scenario({ id: 5 })],
      activeScenarioId: 'a',
    })!
    const ids = state.scenarios.map((s) => s.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('a')
    expect(state.activeScenarioId).toBe('a')
  })

  it('ersetzt Nicht-Strings als Label', () => {
    expect(load({ scenarios: [scenario({ label: 42 })] })!.scenarios[0].label).toBe('Szenario 1')
  })

  it('vergibt ungültige und doppelte Farb-Slots neu, ohne gültige anzutasten', () => {
    const state = load({
      scenarios: [
        scenario({ id: 'a', colorSlot: 0 }),
        scenario({ id: 'b', colorSlot: 1 }),
        scenario({ id: 'c', colorSlot: 1 }),
        scenario({ id: 'd', colorSlot: 2.5 }),
        scenario({ id: 'e', colorSlot: '3' }),
        scenario({ id: 'f', colorSlot: 9 }),
        scenario({ id: 'g', colorSlot: 3 }),
      ],
    })!
    const slots = state.scenarios.map((s) => s.colorSlot)
    expect(slots[1]).toBe(1)
    expect(slots[6]).toBe(3)
    expect(new Set(slots).size).toBe(slots.length)
    expect(slots.every((s) => Number.isInteger(s) && s >= 1 && s <= SLOT_COUNT)).toBe(true)
  })

  it('übernimmt nur bekannte, einmalige Serien', () => {
    const state = load({
      scenarios: [scenario()],
      enabledSeriesIds: ['contributions', 'nope', 7, 'contributions', 'compound'],
    })!
    expect(state.enabledSeriesIds).toEqual(['contributions', 'compound'])
  })

  it('prüft Kodierung und Diagrammstil', () => {
    const fremd = load({ scenarios: [scenario()], encoding: 'zzz', chartStyleId: 'zzz' })!
    expect(fremd.encoding).toBe('auto')
    expect(fremd.chartStyleId).toBe(createInitialState().chartStyleId)
    const bekannt = load({ scenarios: [scenario()], encoding: 'auto', chartStyleId: 'sketch' })!
    expect(bekannt.chartStyleId).toBe('sketch')
    expect(load({ scenarios: [scenario()], encoding: 5 })!.encoding).toBe('auto')
  })

  it('verlangt ein boolesches sidebarCollapsed', () => {
    expect(load({ scenarios: [scenario()], sidebarCollapsed: 'yes' })!.sidebarCollapsed).toBe(false)
    expect(load({ scenarios: [scenario()], sidebarCollapsed: true })!.sidebarCollapsed).toBe(true)
  })

  describe('Wertpapiere', () => {
    const markt = (symbol: unknown, extra: Record<string, unknown> = {}) => ({
      symbol,
      name: 'N',
      currency: 'USD',
      start: '2000-01-01',
      monthlyReturns: Array(24).fill(0.01),
      ...extra,
    })
    const markets = (list: unknown[]) => load({ scenarios: [scenario()], markets: list })!.markets

    it('siebt Renditen und kurze Reihen aus', () => {
      const returns = [...Array(11).fill(0.01), 'x', null, NaN, 0.02]
      // 12 gültige Zahlen (11 + 0.02) bleiben, der Rest fällt heraus. NaN wird
      // in JSON zu null.
      expect(markets([markt('A', { monthlyReturns: returns })])[0].monthlyReturns).toHaveLength(12)
      expect(markets([markt('A', { monthlyReturns: [0.01, 'x', 0.02] })])).toEqual([])
    })

    it('verlangt einen String als Symbol und setzt Ersatzwerte', () => {
      expect(markets([markt(5)])).toEqual([])
      const [m] = markets([markt('A', { name: 1, currency: null, start: {} })])
      expect(m.name).toBe('A')
      expect(typeof m.currency).toBe('string')
      expect(typeof m.start).toBe('string')
    })

    it('entdoppelt nach Symbol und begrenzt auf MAX_MARKETS', () => {
      expect(markets([markt('A'), markt('A')])).toHaveLength(1)
      const viele = ['A', 'B', 'C', 'D', 'E', 'F'].map((s) => markt(s))
      expect(markets(viele).map((m) => m.symbol)).toEqual(['A', 'B', 'C', 'D'].slice(0, MAX_MARKETS))
    })
  })

  it('übersteht die Serialisierung eines Blobs wie ihn der MCP-Server erzeugt', () => {
    const blob = serialize({
      ...createInitialState(),
      scenarios: Array.from({ length: 3 }, (_, i) => ({
        ...createInitialState().scenarios[0],
        id: `s${i + 1}`,
        colorSlot: i + 1,
      })),
      activeScenarioId: 's1',
    })
    const back = deserialize(blob)!
    expect(back.scenarios.map((s) => [s.id, s.colorSlot])).toEqual([
      ['s1', 1],
      ['s2', 2],
      ['s3', 3],
    ])
  })
})

describe('series/setEnabled', () => {
  it('schaltet an und aus', () => {
    const state = createInitialState()
    const an = reducer(state, actions.setSeriesEnabled('purchasingPower', true))
    expect(an.enabledSeriesIds).toContain('purchasingPower')
    const aus = reducer(an, actions.setSeriesEnabled('purchasingPower', false))
    expect(aus.enabledSeriesIds).not.toContain('purchasingPower')
  })

  it('ist idempotent und gibt denselben Zustand zurück, wenn sich nichts ändert', () => {
    const state = createInitialState()
    const an = reducer(state, actions.setSeriesEnabled('marketReturn', true))
    // Der Fehler aus der Oberfläche: zweimal "an" darf nicht wieder ausschalten.
    expect(reducer(an, actions.setSeriesEnabled('marketReturn', true))).toBe(an)
    expect(reducer(state, actions.setSeriesEnabled('marketReturn', false))).toBe(state)
  })

  it('ignoriert unbekannte IDs', () => {
    const state = createInitialState()
    expect(reducer(state, actions.setSeriesEnabled('gibtsnicht', true))).toBe(state)
    expect(reducer(state, actions.setSeriesEnabled('gibtsnicht', false))).toBe(state)
  })
})
