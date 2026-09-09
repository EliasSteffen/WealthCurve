import { describe, expect, it } from 'vitest'
import {
  MAX_MARKETS,
  MAX_SCENARIOS,
  actions,
  createInitialState,
  deserialize,
  reducer,
  serialize,
} from '@/core/state'
import type { AppState } from '@/core/state'

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

describe('Eingeklappte Karten', () => {
  it('startet mit lauter offenen Karten', () => {
    expect(createInitialState().collapsedCards).toEqual([])
  })

  it('klappt zu und wieder auf', () => {
    const zu = reducer(createInitialState(), actions.toggleSettingsCard('global:auszahlung'))
    expect(zu.collapsedCards).toEqual(['global:auszahlung'])
    expect(reducer(zu, actions.toggleSettingsCard('global:auszahlung')).collapsedCards).toEqual([])
  })

  it('hält die beiden Hälften einer Kategorie auseinander', () => {
    // "Einzahlung" gibt es zweimal - die eine zuzuklappen darf die andere
    // nicht mitnehmen.
    const zu = reducer(createInitialState(), actions.toggleSettingsCard('scenario:einzahlung'))
    expect(zu.collapsedCards).toEqual(['scenario:einzahlung'])
    expect(zu.collapsedCards).not.toContain('global:einzahlung')
  })

  it('überlebt die Serialisierung', () => {
    // Der eigentliche Grund, warum der Zustand im Store liegt: das Bottom-Sheet
    // montiert das Panel neu, lokaler State wäre danach vergessen.
    const state = reducer(createInitialState(), actions.toggleSettingsCard('scenario:kapital'))
    expect(deserialize(serialize(state))!.collapsedCards).toEqual(['scenario:kapital'])
  })

  it('lässt erfundene Karten nicht in den Zustand', () => {
    const state = createInitialState()
    // @ts-expect-error - genau der Fall, den der Reducer abfangen soll
    expect(reducer(state, actions.toggleSettingsCard('gibt-es-nicht'))).toBe(state)
    const fremd = deserialize('{"scenarios":[{"label":"X"}],"collapsedCards":["quatsch"]}')
    expect(fremd!.collapsedCards).toEqual([])
  })

  it('verwirft die alten Schlüssel ohne Bereich', () => {
    // Aus einem gespeicherten Zustand von vorher: "kapital" ohne Bereich meint
    // keine Karte mehr. Alles offen ist die richtige Antwort darauf.
    const alt = deserialize('{"scenarios":[{"label":"X"}],"collapsedCategories":["kapital"]}')
    expect(alt!.collapsedCards).toEqual([])
  })
})

describe('Wertpapiere', () => {
  const kurs = (symbol: string, start = '2000-01-01') => ({
    symbol,
    name: `${symbol} Inc.`,
    currency: 'USD',
    start,
    monthlyReturns: Array(24).fill(0.005) as number[],
  })

  it('nimmt mehrere auf', () => {
    const state = run(createInitialState(), actions.addMarket(kurs('AAPL')), actions.addMarket(kurs('MSFT')))
    expect(state.markets.map((m) => m.symbol)).toEqual(['AAPL', 'MSFT'])
  })

  it('ersetzt dasselbe Papier, statt es zu verdoppeln', () => {
    // Zwei identische Kurven in zwei Farben wären eine Falschaussage.
    const state = run(
      createInitialState(),
      actions.addMarket(kurs('AAPL', '2000-01-01')),
      actions.addMarket(kurs('AAPL', '1990-01-01')),
    )
    expect(state.markets).toHaveLength(1)
    expect(state.markets[0].start).toBe('1990-01-01')
  })

  it('nimmt nicht mehr auf, als die Palette an Farben hergibt', () => {
    const voll = run(
      createInitialState(),
      ...['A', 'B', 'C', 'D'].map((s) => actions.addMarket(kurs(s))),
    )
    expect(voll.markets).toHaveLength(MAX_MARKETS)
    // Wie bei den Szenarien: lieber nichts tun als eine Farbe wiederholen.
    expect(reducer(voll, actions.addMarket(kurs('E')))).toBe(voll)
  })

  it('entfernt gezielt und lässt Unbekanntes unberührt', () => {
    const state = run(createInitialState(), actions.addMarket(kurs('AAPL')), actions.addMarket(kurs('MSFT')))
    expect(reducer(state, actions.removeMarket('AAPL')).markets.map((m) => m.symbol)).toEqual(['MSFT'])
    expect(reducer(state, actions.removeMarket('GIBTESNICHT'))).toBe(state)
  })

  it('überlebt die Serialisierung und siebt Unbrauchbares aus', () => {
    const state = run(createInitialState(), actions.addMarket(kurs('AAPL')))
    expect(deserialize(serialize(state))!.markets[0].symbol).toBe('AAPL')

    // Eine Reihe ohne Renditen zeichnet nichts und wäre nicht mehr loszuwerden.
    const kaputt = deserialize('{"scenarios":[{"label":"X"}],"markets":[{"symbol":"X"},null]}')
    expect(kaputt!.markets).toEqual([])
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

describe('Farbe eines Szenarios', () => {
  const mitZwei = () => reducer(createInitialState(), actions.addScenario('Zweites'))

  it('lässt sich auf einen freien Slot setzen', () => {
    const state = createInitialState()
    const id = state.scenarios[0].id
    expect(reducer(state, actions.setScenarioColor(id, 5)).scenarios[0].colorSlot).toBe(5)
  })

  it('lehnt eine Farbe ab, die ein anderes Szenario trägt', () => {
    // Zwei gleichfarbige Kurven sind im Diagramm nicht zu trennen - damit wäre
    // der Vergleich wertlos.
    const state = mitZwei()
    const [erstes, zweites] = state.scenarios
    expect(reducer(state, actions.setScenarioColor(erstes.id, zweites.colorSlot))).toBe(state)
  })

  it('lehnt alles außerhalb der acht geprüften Farben ab', () => {
    // Die Grenze ist keine Willkür: ein neunter Ton wäre unter
    // Farbfehlsichtigkeit von einem vorhandenen nicht mehr zu trennen.
    const state = createInitialState()
    const id = state.scenarios[0].id
    expect(reducer(state, actions.setScenarioColor(id, 0))).toBe(state)
    expect(reducer(state, actions.setScenarioColor(id, 9))).toBe(state)
    expect(reducer(state, actions.setScenarioColor(id, 2.5))).toBe(state)
  })

  it('gibt bei unveränderter Farbe denselben State zurück', () => {
    const state = createInitialState()
    const s0 = state.scenarios[0]
    expect(reducer(state, actions.setScenarioColor(s0.id, s0.colorSlot))).toBe(state)
  })

  it('überlebt die Serialisierung', () => {
    const state = createInitialState()
    const geaendert = reducer(state, actions.setScenarioColor(state.scenarios[0].id, 7))
    expect(deserialize(serialize(geaendert))!.scenarios[0].colorSlot).toBe(7)
  })

  it('gibt die freigewordene Farbe wieder frei', () => {
    // Nach dem Umfärben muss der alte Slot für ein neues Szenario zu haben
    // sein - sonst schrumpfte die Palette bei jedem Wechsel.
    const state = mitZwei()
    const [erstes] = state.scenarios
    const alt = erstes.colorSlot
    const um = reducer(state, actions.setScenarioColor(erstes.id, 6))
    expect(reducer(um, actions.setScenarioColor(um.scenarios[1].id, alt)).scenarios[1].colorSlot).toBe(alt)
  })
})
