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

  it('übernimmt die Kategorie aus der Registry, statt sie pauschal zu setzen', () => {
    // Der eigentliche Zweck des `category`-Feldes: Sparrate und Entnahme sind
    // beide Geldbeträge und landeten früher zwangsläufig in derselben Karte.
    const kategorieVon = (id: string) => index.find((e) => e.id === id)?.category
    expect(kategorieVon('param:monthlyContribution')).toBe('einzahlung')
    expect(kategorieVon('param:monthlyWithdrawal')).toBe('auszahlung')
    expect(kategorieVon('param:annualRate')).toBe('kapital')
    expect(kategorieVon('param:initialCapital')).toBe('kapital')
  })

  it('legt die Zeitraum-Felder zu ihrer jeweiligen Phase', () => {
    // "dort kann dann jeweils betrag, zeitraum, ... eingestellt werden" -
    // die Jahre stehen bei dem Betrag, auf den sie sich beziehen.
    const kategorieVon = (id: string) => index.find((e) => e.id === id)?.category
    expect(kategorieVon('timeline:accumulationYears')).toBe('einzahlung')
    expect(kategorieVon('timeline:withdrawalYears')).toBe('auszahlung')
  })

  it('ordnet jeden Parameter genau einer Kategorie zu', () => {
    for (const id of PARAM_IDS) {
      const treffer = index.filter((e) => e.id === `param:${id}`)
      expect(new Set(treffer.map((e) => e.category)).size, id).toBe(1)
    }
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
    expect([...kategorien]).toEqual(['annahmen'])
  })

  it('liefert bei fehlendem Treffer gar keine Kategorie', () => {
    expect(matchingCategories(index, matchSettings(index, 'xyzabc')).size).toBe(0)
  })
})
