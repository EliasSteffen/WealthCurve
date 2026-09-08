import { describe, expect, it } from 'vitest'
import { projectionToCsv } from '@/core/csv'
import { DEFAULT_MODEL } from '@/core/domain/math'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'
import { buildProjection, type ProjectionInput, type ProjectionScenario } from '@/core/projection'

const scenario = (id: string, over: Partial<ProjectionScenario> = {}): ProjectionScenario => ({
  id,
  label: id,
  colorSlot: 1,
  params: DEFAULT_PARAMS,
  ...over,
})

const build = (over: Partial<ProjectionInput> = {}) =>
  buildProjection({
    scenarios: [scenario('a')],
    seriesIds: ['compound', 'contributions'],
    model: DEFAULT_MODEL,
    ...over,
  })

describe('buildProjection', () => {
  it('legt für jede Szenario-Serie-Kombination eine Linie an', () => {
    const p = build({
      scenarios: [scenario('a', { colorSlot: 1 }), scenario('b', { colorSlot: 2 })],
    })
    expect(p.lines).toHaveLength(4)
    expect(new Set(p.lines.map((l) => l.key)).size).toBe(4)
  })

  it('setzt alle Szenarien auf dieselbe Zeitachse', () => {
    // Die Laufzeit steckt im Modell, nicht in den Szenario-Parametern - deshalb
    // kann kein Szenario aus der gemeinsamen X-Achse ausbrechen.
    const p = build({
      scenarios: [scenario('a'), scenario('b'), scenario('c')],
    })
    const erwartet = DEFAULT_MODEL.accumulationYears + DEFAULT_MODEL.withdrawalYears + 1
    expect(p.rows).toHaveLength(erwartet)
    for (const line of p.lines) {
      expect(p.rows.every((row) => typeof row[line.key] === 'number'), line.key).toBe(true)
    }
  })

  it('meldet das Jahr des Phasenwechsels', () => {
    expect(build().retirementYear).toBe(DEFAULT_MODEL.accumulationYears)
  })

  it('färbt bei einem Szenario nach Serie', () => {
    const p = build()
    expect(new Set(p.lines.map((l) => l.colorVar)).size).toBe(2)
    expect(p.lines.every((l) => l.dash === undefined)).toBe(true)
    expect(p.encodingDescription).toBe('Farbe = Serie')
  })

  it('färbt ab zwei Szenarien nach Szenario und trennt Serien per Strich', () => {
    const p = build({
      scenarios: [scenario('a', { colorSlot: 1 }), scenario('b', { colorSlot: 2 })],
    })
    const vonA = p.lines.filter((l) => l.scenarioId === 'a')
    const vonB = p.lines.filter((l) => l.scenarioId === 'b')
    // Innerhalb eines Szenarios: eine Farbe, verschiedene Striche.
    expect(new Set(vonA.map((l) => l.colorVar)).size).toBe(1)
    expect(new Set(vonA.map((l) => l.dash)).size).toBe(2)
    // Zwischen den Szenarien: verschiedene Farben.
    expect(vonA[0].colorVar).not.toBe(vonB[0].colorVar)
    expect(p.encodingDescription).toContain('Strich')
  })

  it('benennt Linien nur beim Vergleich mit dem Szenario', () => {
    expect(build().lines[0].label).not.toContain('·')
    const verglichen = build({ scenarios: [scenario('a'), scenario('b')] })
    expect(verglichen.lines[0].label).toContain('·')
  })

  it('stuft die Kapazität nach sichtbaren Linien ab', () => {
    const viele = build({
      scenarios: ['a', 'b', 'c', 'd'].map((id) => scenario(id)),
      seriesIds: ['compound', 'contributions', 'purchasingPower', 'savingsAccount'],
    })
    expect(viele.capacity.lineCount).toBe(16)
    expect(viele.capacity.level).toBe('over')
    expect(viele.capacity.message).toBeTruthy()
  })

  it('kommt ohne Szenarien und ohne Serien zurecht', () => {
    expect(build({ scenarios: [] }).lines).toEqual([])
    expect(build({ seriesIds: [] }).lines).toEqual([])
  })

  it('bleibt reines JSON', () => {
    // Voraussetzung dafür, das Ergebnis über eine Prozessgrenze zu schicken.
    const p = build()
    expect(JSON.parse(JSON.stringify(p))).toEqual(p)
  })
})

describe('CSV-Export', () => {
  it('schreibt Kopfzeile und eine Zeile je Jahr', () => {
    const p = build()
    const zeilen = projectionToCsv(p).split('\n')
    expect(zeilen).toHaveLength(p.rows.length + 1)
    expect(zeilen[0]).toBe('Jahr;Zinseszins;Ohne Rendite')
  })

  it('nutzt deutsche Zahlenkonvention', () => {
    // Semikolon als Trenner, Komma als Dezimalzeichen - so öffnet Excel in
    // deutscher Einstellung ohne Nachfrage.
    const zeile = projectionToCsv(build()).split('\n')[2]
    expect(zeile).toMatch(/^\d+;\d+,\d{2};\d+,\d{2}$/)
  })

  it('maskiert Trennzeichen in Beschriftungen', () => {
    const p = build({ scenarios: [scenario('a', { label: 'Mit;Semikolon' }), scenario('b')] })
    expect(projectionToCsv(p).split('\n')[0]).toContain('"Zinseszins · Mit;Semikolon"')
  })
})
