import { describe, expect, it } from 'vitest'
import { SLOT_COUNT, slotVar } from '@/core/palette'
import { AUTO_ENCODING, ENCODINGS, colorByScenario, colorBySeries, resolveEncoding } from '@/core/encoding/index'
import { DASH_PATTERNS, reportCapacity, type LineIdentity } from '@/core/encoding/types'

const line = (over: Partial<LineIdentity> = {}): LineIdentity => ({
  scenarioId: 'a',
  scenarioColorSlot: 1,
  seriesId: 'compound',
  seriesIndex: 0,
  seriesColorVar: 'var(--chart-1, #2a78d6)',
  ...over,
})

describe('Auswahl der Kodierung', () => {
  it('färbt bei einem Szenario nach Serie', () => {
    // Sonst wären alle Serien gleichfarbig - es gibt keine zweite Dimension.
    const encoding = resolveEncoding(AUTO_ENCODING, { scenarioCount: 1, seriesCount: 4 })
    expect(encoding.id).toBe(colorBySeries.id)
  })

  it('färbt ab zwei Szenarien nach Szenario', () => {
    const encoding = resolveEncoding(AUTO_ENCODING, { scenarioCount: 2, seriesCount: 2 })
    expect(encoding.id).toBe(colorByScenario.id)
  })

  it('respektiert eine ausdrückliche Wahl', () => {
    const encoding = resolveEncoding(colorBySeries.id, { scenarioCount: 5, seriesCount: 1 })
    expect(encoding.id).toBe(colorBySeries.id)
  })

  it('fällt bei unbekannter Wahl auf die Automatik zurück', () => {
    const encoding = resolveEncoding('gibt-es-nicht', { scenarioCount: 3, seriesCount: 1 })
    expect(encoding.id).toBe(colorByScenario.id)
  })

  it('vergibt eindeutige IDs im Registry', () => {
    const ids = ENCODINGS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('colorBySeries', () => {
  it('nimmt die Farbe der Serie und zeichnet durchgezogen', () => {
    const style = colorBySeries.style(line(), { scenarioCount: 1, seriesCount: 3 })
    expect(style.colorVar).toBe('var(--chart-1, #2a78d6)')
    expect(style.dash).toBeUndefined()
  })
})

describe('colorByScenario', () => {
  const input = { scenarioCount: 3, seriesCount: 3 }

  it('nimmt die Farbe des Szenario-Slots', () => {
    expect(colorByScenario.style(line({ scenarioColorSlot: 2 }), input).colorVar).toBe(slotVar(2))
    expect(colorByScenario.style(line({ scenarioColorSlot: 5 }), input).colorVar).toBe(slotVar(5))
  })

  it('unterscheidet Serien über den Strich', () => {
    const dashes = [0, 1, 2, 3].map((seriesIndex) =>
      colorByScenario.style(line({ seriesIndex }), input).dash,
    )
    expect(new Set(dashes).size).toBe(4)
    expect(dashes).toEqual([...DASH_PATTERNS])
  })

  it('verzichtet bei einer einzigen Serie auf den Strichwechsel', () => {
    const style = colorByScenario.style(line(), { scenarioCount: 4, seriesCount: 1 })
    expect(style.dash).toBeUndefined()
  })

  it('erklärt beide Kanäle in der Legende', () => {
    expect(colorByScenario.describe(input)).toContain('Farbe')
    expect(colorByScenario.describe(input)).toContain('Strich')
    expect(colorByScenario.describe({ scenarioCount: 4, seriesCount: 1 })).not.toContain('Strich')
  })
})

describe('Farb-Slots', () => {
  it('bleibt innerhalb der geprüften Palette', () => {
    // Ein neunter Ton wäre unter Farbfehlsichtigkeit nicht mehr zu trennen -
    // deshalb faltet slotVar zurück, statt eine neue Farbe zu erfinden.
    const alle = Array.from({ length: SLOT_COUNT }, (_, i) => slotVar(i + 1))
    expect(new Set(alle).size).toBe(SLOT_COUNT)
    expect(slotVar(SLOT_COUNT + 1)).toBe(slotVar(1))
  })
})

describe('Kapazität', () => {
  it('stuft nach der Zahl sichtbarer Linien ab', () => {
    expect(reportCapacity({ scenarioCount: 2, seriesCount: 4 }).level).toBe('ok')
    expect(reportCapacity({ scenarioCount: 3, seriesCount: 4 }).level).toBe('crowded')
    expect(reportCapacity({ scenarioCount: 5, seriesCount: 4 }).level).toBe('over')
  })

  it('schweigt, solange es übersichtlich bleibt', () => {
    expect(reportCapacity({ scenarioCount: 1, seriesCount: 4 }).message).toBeNull()
    expect(reportCapacity({ scenarioCount: 4, seriesCount: 4 }).message).toBeTruthy()
  })
})
