import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '@/i18n/en'

/**
 * Jeder Schlüssel, der im Code über `t('…', …)` benutzt wird, braucht einen
 * englischen Eintrag.
 *
 * Fehlt er, zeigt die englische Oberfläche stillschweigend Deutsch - genau die
 * Lücke, die niemand beim Tippen bemerkt. Der Test liest den Quelltext statt
 * die Laufzeit, weil er sonst jeden Zweig der Oberfläche rendern müsste.
 */

const SRC = join(__dirname, '..', '..', 'src')

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.tsx?$/.test(name) ? [pfad] : []
  })
}

/**
 * Schlüssel, die absichtlich nur deutsch bleiben. Jeder Eintrag braucht einen
 * Grund - eine Ausnahme ohne Begründung ist eine versteckte Lücke.
 */
const NUR_DEUTSCH: ReadonlySet<string> = new Set<string>([
  // (derzeit keine)
])

// `t('schluessel'` bzw. `t("schluessel"` - das erste Argument als Literal.
// Template-Literale (dynamische Schlüssel wie `series.${id}.label`) bleiben
// bewusst außen vor; sie deckt test/i18n/i18n.test.ts über die Registries ab.
const AUFRUF = /(?<![\w.$])t\(\s*(['"])([^'"\n]+)\1/g

function benutzteSchluessel(): Map<string, string[]> {
  const gefunden = new Map<string, string[]>()
  for (const datei of dateien(SRC)) {
    const text = readFileSync(datei, 'utf8')
    for (const treffer of text.matchAll(AUFRUF)) {
      const orte = gefunden.get(treffer[2]) ?? []
      orte.push(relative(SRC, datei))
      gefunden.set(treffer[2], orte)
    }
  }
  return gefunden
}

describe('Schlüssel-Abdeckung', () => {
  const benutzt = benutzteSchluessel()

  it('findet überhaupt Schlüssel (der Scan läuft nicht ins Leere)', () => {
    expect(benutzt.size).toBeGreaterThan(100)
    expect(benutzt.has('app.title')).toBe(true)
  })

  it('hat für jeden benutzten Schlüssel einen englischen Eintrag', () => {
    const luecken = [...benutzt.entries()]
      .filter(([schluessel]) => !(schluessel in en) && !NUR_DEUTSCH.has(schluessel))
      .map(([schluessel, orte]) => `${schluessel}  (${[...new Set(orte)].join(', ')})`)
    expect(luecken).toEqual([])
  })

  it('führt keine Ausnahme, die gar nicht mehr gebraucht wird', () => {
    const veraltet = [...NUR_DEUTSCH].filter((k) => !benutzt.has(k) || k in en)
    expect(veraltet).toEqual([])
  })
})
