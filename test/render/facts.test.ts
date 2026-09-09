import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '@/core/domain/math'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'
import { buildProjection } from '@/core/projection'
import { resolveText } from '@/render/canvas/drawFrame'
import { buildFacts, suggestedFactKeys } from '@/render/facts'

const fmt = {
  eur: (v: number) => `${Math.round(v)} €`,
  percent: (v: number) => `${v} %`,
  years: (v: number) => `${v} Jahre`,
}

const bauen = (...renditen: number[]) =>
  buildProjection({
    scenarios: renditen.map((annualRate, i) => ({
      id: `s${i}`,
      label: i === 0 ? 'Basis' : 'Aggressiv',
      colorSlot: i + 1,
      params: { ...DEFAULT_PARAMS, annualRate },
    })),
    seriesIds: ['compound'],
    model: DEFAULT_MODEL,
  })

describe('buildFacts', () => {
  it('nennt jedes Szenario einzeln', () => {
    // Der Kern: {{rendite}} nannte bei einem Vergleich nur die erste - und
    // nichts im Bild verriet, welche.
    const facts = buildFacts(bauen(7, 9), DEFAULT_MODEL, fmt)
    expect(facts['s1.rendite']).toBe('7 %')
    expect(facts['s2.rendite']).toBe('9 %')
    expect(facts['s1.name']).toBe('Basis')
    expect(facts['s2.name']).toBe('Aggressiv')
  })

  it('lässt die Formen ohne Präfix auf das erste Szenario zeigen', () => {
    // Sonst wären alle vorhandenen Videotexte still leer geworden.
    const facts = buildFacts(bauen(7, 9), DEFAULT_MODEL, fmt)
    expect(facts.rendite).toBe(facts['s1.rendite'])
    expect(facts.endkapital).toBe(facts['s1.endkapital'])
  })

  it('fasst die Renditen zusammen wie die Szenarien', () => {
    const facts = buildFacts(bauen(7, 9), DEFAULT_MODEL, fmt)
    expect(facts.renditen).toBe('Basis: 7 % · Aggressiv: 9 %')
  })

  it('wächst mit einem dritten Szenario mit, ohne Zutun', () => {
    const facts = buildFacts(bauen(5, 7, 9), DEFAULT_MODEL, fmt)
    expect(facts['s3.rendite']).toBe('9 %')
    expect(facts.renditen.split(' · ')).toHaveLength(3)
  })

  it('bleibt ohne sichtbares Szenario benutzbar', () => {
    const facts = buildFacts(bauen(), DEFAULT_MODEL, fmt)
    expect(facts.szenarien).toBe('')
    expect(facts.rendite).toBeUndefined()
  })
})

describe('resolveText mit Szenario-Platzhaltern', () => {
  it('löst den Punkt in der Kennung mit auf', () => {
    // Der Ausdruck kannte nur Wortzeichen und brach am Punkt ab - „{{s2" wäre
    // so im fertigen Video stehen geblieben.
    const facts = buildFacts(bauen(7, 9), DEFAULT_MODEL, fmt)
    expect(
      resolveText('{{s1.name}} mit {{s1.rendite}}, {{s2.name}} mit {{s2.rendite}}', facts),
    ).toBe('Basis mit 7 %, Aggressiv mit 9 %')
  })

  it('lässt einen Platzhalter ohne Wert leer, statt ihn stehen zu lassen', () => {
    expect(resolveText('a {{s9.rendite}} b', buildFacts(bauen(7), DEFAULT_MODEL, fmt))).toBe('a  b')
  })
})

describe('suggestedFactKeys', () => {
  it('verschweigt die Szenario-Formen bei nur einem Szenario', () => {
    const facts = buildFacts(bauen(7), DEFAULT_MODEL, fmt)
    expect(suggestedFactKeys(facts, 1).some((k) => k.includes('.'))).toBe(false)
    // Funktionieren tun sie trotzdem - sie stehen nur nicht in der Liste.
    expect(facts['s1.rendite']).toBe('7 %')
  })

  it('zeigt sie, sobald es etwas zu vergleichen gibt', () => {
    const facts = buildFacts(bauen(7, 9), DEFAULT_MODEL, fmt)
    expect(suggestedFactKeys(facts, 2)).toContain('s2.rendite')
  })
})
