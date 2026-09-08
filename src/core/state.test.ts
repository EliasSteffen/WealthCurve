import { describe, expect, it } from 'vitest'
import { MAX_SCENARIOS, actions, createInitialState, deserialize, reducer, serialize } from './state'
import type { AppState } from './state'

const run = (state: AppState, ...list: ReturnType<typeof actions.addScenario>[]) =>
  list.reduce(reducer, state)

const withScenarios = (count: number): AppState => {
  let state = createInitialState()
  for (let i = 1; i < count; i += 1) state = reducer(state, actions.addScenario(`S${i + 1}`))
  return state
}

describe('Szenarien', () => {
  it('startet mit genau einem Szenario auf Slot 1', () => {
    const state = createInitialState()
    expect(state.scenarios).toHaveLength(1)
    expect(state.scenarios[0].colorSlot).toBe(1)
    expect(state.activeScenarioId).toBe(state.scenarios[0].id)
  })

  it('vergibt beim Anlegen den nächsten freien Slot', () => {
    const state = withScenarios(3)
    expect(state.scenarios.map((s) => s.colorSlot)).toEqual([1, 2, 3])
  })

  it('behält die Farben der übrigen beim Löschen', () => {
    // Die Regression, die den Chart umfärben würde: wer "Aggressiv ist orange"
    // gelernt hat, darf das nicht durch das Löschen eines anderen verlieren.
    const before = withScenarios(4)
    const middle = before.scenarios[1]
    const after = reducer(before, actions.removeScenario(middle.id))

    expect(after.scenarios).toHaveLength(3)
    for (const scenario of after.scenarios) {
      const original = before.scenarios.find((s) => s.id === scenario.id)!
      expect(scenario.colorSlot, scenario.label).toBe(original.colorSlot)
    }
  })

  it('füllt den frei gewordenen Slot beim nächsten Anlegen wieder auf', () => {
    const before = withScenarios(3)
    const removed = reducer(before, actions.removeScenario(before.scenarios[1].id))
    const added = reducer(removed, actions.addScenario('Neu'))
    expect(added.scenarios.map((s) => s.colorSlot).sort()).toEqual([1, 2, 3])
  })

  it('lässt sich nicht über die Palette hinaus erweitern', () => {
    const full = withScenarios(MAX_SCENARIOS)
    expect(full.scenarios).toHaveLength(MAX_SCENARIOS)
    // Kein neunter Farbton - lieber nichts tun als eine Farbe wiederholen.
    const overflow = reducer(full, actions.addScenario('zu viel'))
    expect(overflow).toBe(full)
  })

  it('lässt das letzte Szenario stehen', () => {
    const state = createInitialState()
    expect(reducer(state, actions.removeScenario(state.scenarios[0].id))).toBe(state)
  })

  it('dupliziert mit eigenen Parametern direkt hinter dem Original', () => {
    const state = withScenarios(2)
    const source = state.scenarios[0]
    const next = reducer(state, actions.duplicateScenario(source.id))
    expect(next.scenarios[1].label).toBe(`${source.label} (Kopie)`)
    expect(next.scenarios[1].params).toEqual(source.params)
    expect(next.scenarios[1].id).not.toBe(source.id)
    expect(next.scenarios[1].colorSlot).not.toBe(source.colorSlot)
  })

  it('wählt nach dem Löschen des aktiven ein verbliebenes aus', () => {
    const state = withScenarios(2)
    const next = reducer(state, actions.removeScenario(state.activeScenarioId))
    expect(next.scenarios.some((s) => s.id === next.activeScenarioId)).toBe(true)
  })

  it('bereinigt Parameterwerte beim Setzen', () => {
    const state = createInitialState()
    const id = state.scenarios[0].id
    const nan = reducer(state, actions.setParam(id, 'annualRate', NaN))
    expect(Number.isFinite(nan.scenarios[0].params.annualRate)).toBe(true)
    const tooHigh = reducer(state, actions.setParam(id, 'annualRate', 999))
    expect(tooHigh.scenarios[0].params.annualRate).toBeLessThanOrEqual(15)
  })
})

describe('Reducer-Identität', () => {
  it('gibt bei wirkungslosen Aktionen denselben State zurück', () => {
    // Wichtig für useSyncExternalStore: kein neues Objekt = kein Re-Render.
    const state = createInitialState()
    expect(reducer(state, actions.selectScenario('gibt-es-nicht'))).toBe(state)
    expect(reducer(state, actions.toggleSeries('gibt-es-nicht'))).toBe(state)
    expect(reducer(state, actions.setSidebarCollapsed(false))).toBe(state)
    expect(reducer(state, actions.renameScenario('gibt-es-nicht', 'x'))).toBe(state)
  })
})

describe('Serialisierung', () => {
  it('überlebt eine Runde verlustfrei', () => {
    const before = run(withScenarios(3), actions.toggleSeries('purchasingPower'))
    const after = deserialize(serialize(before))
    expect(after).not.toBeNull()
    expect(after!.scenarios.map((s) => [s.id, s.label, s.colorSlot])).toEqual(
      before.scenarios.map((s) => [s.id, s.label, s.colorSlot]),
    )
    expect(after!.enabledSeriesIds).toEqual(before.enabledSeriesIds)
    expect(after!.model).toEqual(before.model)
  })

  it('verweigert kaputte Eingaben, statt NaN durchzulassen', () => {
    expect(deserialize('kein json')).toBeNull()
    expect(deserialize('{"scenarios":[]}')).toBeNull()
    const repaired = deserialize('{"scenarios":[{"label":"X","params":{"annualRate":"viel"}}]}')
    expect(repaired).not.toBeNull()
    expect(Number.isFinite(repaired!.scenarios[0].params.annualRate)).toBe(true)
  })
})
