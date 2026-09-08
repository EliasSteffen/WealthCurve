import { describe, expect, it } from 'vitest'
import {
  SETTINGS_CATEGORIES,
  buildSettingsIndex,
  matchSettings,
  matchingCategories,
} from '@/core/settings'
import { PARAM_IDS } from '@/core/domain/parameters'
import { SERIES } from '@/core/domain/series'

const index = buildSettingsIndex()

describe('Suchindex', () => {
  it('vergibt eindeutige Kategorien', () => {
    const ids = SETTINGS_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ordnet jeden Eintrag einer bekannten Kategorie zu', () => {
    const bekannt = new Set(SETTINGS_CATEGORIES.map((c) => c.id))
    for (const entry of index) expect(bekannt, entry.id).toContain(entry.category)
  })

  it('nimmt jeden Parameter und jede Serie auf', () => {
    // Der Index wird aus den Registries abgeleitet - eine neue Serie ist damit
    // automatisch auffindbar, ohne dass jemand daran denken muss.
    for (const id of PARAM_IDS) expect(index.some((e) => e.id === `param:${id}`), id).toBe(true)
    for (const s of SERIES) expect(index.some((e) => e.id === `series:${s.id}`), s.id).toBe(true)
  })
})

describe('matchSettings', () => {
  it('liefert bei leerer Suche null statt einer leeren Menge', () => {
    // null heißt "keine Suche" - eine leere Menge hieße "nichts gefunden".
    expect(matchSettings(index, '')).toBeNull()
    expect(matchSettings(index, '   ')).toBeNull()
  })

  it('findet über das Label', () => {
    const treffer = matchSettings(index, 'Sparrate')
    expect(treffer).not.toBeNull()
    expect(treffer!.has('param:monthlyContribution')).toBe(true)
  })

  it('findet über Schlagworte, nicht nur über das Label', () => {
    expect(matchSettings(index, 'kaufkraft')!.has('series:purchasingPower')).toBe(true)
    expect(matchSettings(index, 'skizze')!.has('style')).toBe(true)
  })

  it('ignoriert Groß- und Kleinschreibung', () => {
    expect(matchSettings(index, 'RENDITE')!.has('param:annualRate')).toBe(true)
  })

  it('findet Umlaute auch ohne Umlaut', () => {
    // "jaehrlich" soll "Jährlich" finden - sonst scheitert die Suche an der Tastatur.
    expect(matchSettings(index, 'jahrlich')!.has('model:compounding')).toBe(true)
    expect(matchSettings(index, 'nachschussig')!.has('model:timing')).toBe(true)
  })

  it('liefert bei fehlendem Treffer eine leere Menge', () => {
    const treffer = matchSettings(index, 'xyzabc')
    expect(treffer).not.toBeNull()
    expect(treffer!.size).toBe(0)
  })
})

describe('matchingCategories', () => {
  it('zeigt ohne Suche alle Kategorien', () => {
    expect(matchingCategories(index, null).size).toBe(SETTINGS_CATEGORIES.length)
  })

  it('reduziert auf die Kategorien mit Treffern', () => {
    const kategorien = matchingCategories(index, matchSettings(index, 'Zinsmodus'))
    expect([...kategorien]).toEqual(['berechnung'])
  })

  it('liefert bei fehlendem Treffer gar keine Kategorie', () => {
    expect(matchingCategories(index, matchSettings(index, 'xyzabc')).size).toBe(0)
  })
})
