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

describe('Mehrere Wertpapiere', () => {
  const kurs = (symbol: string, monatsrendite: number, monate = 240) => ({
    symbol,
    name: `${symbol} Inc.`,
    currency: 'USD',
    start: '2000-01-01',
    monthlyReturns: Array(monate).fill(monatsrendite) as number[],
  })

  const mitKursen = (...markets: ReturnType<typeof kurs>[]) =>
    build({ seriesIds: ['compound', 'marketReturn'], markets })

  it('macht aus einer Serie eine Linie je Wertpapier', () => {
    const p = mitKursen(kurs('AAPL', 0.006), kurs('MSFT', 0.004))
    const kurslinien = p.lines.filter((l) => l.seriesId === 'marketReturn')
    expect(kurslinien).toHaveLength(2)
    expect(kurslinien.map((l) => l.variantLabel)).toEqual(['AAPL', 'MSFT'])
    // Die Registry bleibt statisch - beide Linien stammen aus derselben Serie.
    expect(new Set(kurslinien.map((l) => l.seriesId)).size).toBe(1)
  })

  it('gibt jedem Wertpapier eine eigene Farbe', () => {
    // Zwei gleichfarbige Kurven wären nicht auseinanderzuhalten.
    const p = mitKursen(kurs('AAPL', 0.006), kurs('MSFT', 0.004))
    const farben = p.lines.filter((l) => l.seriesId === 'marketReturn').map((l) => l.colorVar)
    expect(new Set(farben).size).toBe(2)
  })

  it('greift dabei keine Farbe ab, die schon eine andere Serie trägt', () => {
    // "Ohne Rendite" hat einen festen Slot aus der Registry. Bekäme ein
    // Wertpapier denselben, stünden zwei verschiedene Aussagen in einer Farbe.
    const p = build({
      seriesIds: ['compound', 'contributions', 'savingsAccount', 'marketReturn'],
      markets: [kurs('AAPL', 0.006), kurs('MSFT', 0.004)],
    })
    const alle = p.lines.map((l) => l.colorVar)
    expect(new Set(alle).size).toBe(alle.length)
  })

  it('rechnet jede Linie mit ihrem eigenen Verlauf', () => {
    const p = mitKursen(kurs('HOCH', 0.01), kurs('FLACH', 0.001))
    const hoch = p.lines.find((l) => l.variantLabel === 'HOCH')!
    const flach = p.lines.find((l) => l.variantLabel === 'FLACH')!
    // Jahr 15 liegt in beiden Historien (240 Monate = 20 Jahre).
    expect(p.rows[15][hoch.key]).toBeGreaterThan(p.rows[15][flach.key] as number)
  })

  it('lässt jede Kurve am Ende ihrer eigenen Historie aufhören', () => {
    // Eine kurze und eine lange Reihe enden zu verschiedenen Zeitpunkten -
    // fortgeschrieben wäre keine, das wäre eine Behauptung statt einer Auskunft.
    const p = mitKursen(kurs('KURZ', 0.005, 120), kurs('LANG', 0.005, 360))
    const kurzeLinie = p.lines.find((l) => l.variantLabel === 'KURZ')!
    const langeLinie = p.lines.find((l) => l.variantLabel === 'LANG')!
    expect(p.rows[25][kurzeLinie.key]).toBeNull()
    expect(p.rows[25][langeLinie.key]).toBeGreaterThan(0)
  })

  it('zählt aufgefächerte Linien in die Kapazität', () => {
    // Sonst meldete die Warnung "ok", während der Chart überquillt.
    const p = build({
      scenarios: [scenario('a'), scenario('b', { colorSlot: 2 })],
      seriesIds: ['compound', 'marketReturn'],
      markets: [kurs('A', 0.005), kurs('B', 0.005), kurs('C', 0.005), kurs('D', 0.005)],
    })
    expect(p.lines).toHaveLength(10)
    expect(p.capacity.lineCount).toBe(10)
    expect(p.capacity.level).not.toBe('ok')
  })

  it('behält ohne Wertpapier genau eine Linie', () => {
    // Die Serie soll nicht aus der Legende verschwinden, nur weil noch kein
    // Kurs geladen ist - sie zeichnet dann eben nichts.
    const p = build({ seriesIds: ['marketReturn'], markets: [] })
    expect(p.lines).toHaveLength(1)
    expect(p.lines[0].variantLabel).toBeUndefined()
    expect(p.rows.at(-1)![p.lines[0].key]).toBeNull()
  })

  it('vergibt Schlüssel je Szenario und Wertpapier eindeutig', () => {
    const p = build({
      scenarios: [scenario('a'), scenario('b', { colorSlot: 2 })],
      seriesIds: ['marketReturn'],
      markets: [kurs('AAPL', 0.006), kurs('MSFT', 0.004)],
    })
    const keys = p.lines.map((l) => l.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('a:marketReturn:AAPL')
    expect(keys).toContain('b:marketReturn:MSFT')
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
