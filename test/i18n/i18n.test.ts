import { describe, expect, it } from 'vitest'
import { en } from '@/i18n/en'
import { createTranslate, intlLocale, LOCALES } from '@/i18n'
import { CHART_STYLES } from '@/core/chart-style'
import { PARAM_IDS } from '@/core/domain/parameters'
import { SERIES } from '@/core/domain/series'
import { WITHDRAWAL_STRATEGIES } from '@/core/domain/withdrawal'
import { SETTINGS_CATEGORIES, SETTINGS_SCOPE_META } from '@/core/settings'

describe('Sprachen', () => {
  it('vergibt eindeutige IDs', () => {
    expect(new Set(LOCALES.map((l) => l.id)).size).toBe(LOCALES.length)
  })

  it('bildet auf gültige Intl-Kennungen ab', () => {
    for (const { id, intl } of LOCALES) {
      expect(() => new Intl.NumberFormat(intl), id).not.toThrow()
      expect(intlLocale(id)).toBe(intl)
    }
  })
})

describe('createTranslate', () => {
  it('gibt auf Deutsch den Originaltext zurück', () => {
    // Deutsch ist die Ausgangssprache und braucht keinen Katalog.
    expect(createTranslate('de')('app.title', 'Zinseszins')).toBe('Zinseszins')
  })

  it('übersetzt bekannte Schlüssel', () => {
    expect(createTranslate('en')('app.title', 'Zinseszins')).toBe('Compound interest')
  })

  it('fällt bei fehlendem Schlüssel auf den deutschen Text zurück', () => {
    // Das ist der Kern der Entscheidung: eine Lücke zeigt lesbaren Text statt
    // eines rohen Schlüssels - und eine neue Serie funktioniert sofort.
    expect(createTranslate('en')('gibt.es.nicht', 'Deutscher Text')).toBe('Deutscher Text')
  })

  it('setzt Platzhalter ein', () => {
    expect(
      createTranslate('en')('stat.lasts.until', 'bis Jahr {year}', { year: 46 }),
    ).toBe('until year 46')
  })

  it('ersetzt jeden Platzhalter, auch mehrfach vorkommend', () => {
    expect(createTranslate('de')('x', '{a} und {a} und {b}', { a: '1', b: '2' })).toBe(
      '1 und 1 und 2',
    )
  })
})

describe('Katalog-Abdeckung', () => {
  const fehlt = (schluessel: string) => !(schluessel in en)

  it('übersetzt jede Serie', () => {
    const luecken = SERIES.flatMap((s) =>
      [`series.${s.id}.label`, `series.${s.id}.description`].filter(fehlt),
    )
    expect(luecken).toEqual([])
  })

  it('übersetzt jeden Parameter', () => {
    expect(PARAM_IDS.map((id) => `param.${id}.label`).filter(fehlt)).toEqual([])
  })

  it('übersetzt jede Entnahmeregel und jeden Stil', () => {
    expect(WITHDRAWAL_STRATEGIES.map((s) => `withdrawal.${s.id}.label`).filter(fehlt)).toEqual([])
    expect(CHART_STYLES.map((s) => `style.${s.id}.label`).filter(fehlt)).toEqual([])
  })

  it('übersetzt jede Einstellungs-Kategorie', () => {
    const luecken = SETTINGS_CATEGORIES.flatMap((c) =>
      [`category.${c.id}.label`, `category.${c.id}.hint`].filter(fehlt),
    )
    expect(luecken).toEqual([])
  })

  it('übersetzt beide Einstellungs-Bereiche', () => {
    const luecken = SETTINGS_SCOPE_META.flatMap((b) =>
      [`scope.${b.id}.label`, `scope.${b.id}.hint`].filter(fehlt),
    )
    expect(luecken).toEqual([])
    // Der Bereich des Szenarios trägt zusätzlich dessen Namen.
    expect(fehlt('scope.scenario.labelNamed')).toBe(false)
  })

  it('enthält keine leeren Übersetzungen', () => {
    const leer = Object.entries(en).filter(([, wert]) => !wert.trim())
    expect(leer).toEqual([])
  })
})
