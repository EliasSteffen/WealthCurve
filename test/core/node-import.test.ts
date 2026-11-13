import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Architektonische Wache, zweiter Teil.
 *
 * Andere Projekte laden den Kern als Paket `wealthcurve` mit reinem Node - ohne
 * tsx und ohne Vite (siehe `exports` in package.json). Installiert von GitHub,
 * baut `prepare` dafür `lib/` mit tsconfig.lib.json: Node entfernt in
 * node_modules keine Typen. Der Build schreibt `.ts` in `.js` um und kennt nur
 * Importe mit Endung; Vite und tsx verzeihen eine fehlende, deshalb fiele ein
 * vergessenes `.ts` sonst erst im fremden Projekt auf.
 */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.ts') ? [full] : []
  })

describe('Kern lädt mit reinem Node', () => {
  const files = [...walk('src/core'), 'server/quotes.ts', 'server/profile.ts']

  it('schreibt jeden relativen Import mit Endung', () => {
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}(?:\/[^'"]*)?)['"]/g)) {
        if (!match[1].endsWith('.ts')) offenders.push(`${file} -> ${match[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('lässt sich über die Paket-Einstiege importieren', () => {
    // Erst der Paket-Build, wie ihn `prepare` bei der Installation ausführt.
    execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.lib.json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // Ein eigener Prozess statt eines Imports hier: nur so gilt Nodes eigene
    // Auflösung und nicht die von Vitest. Das Paket importiert sich dabei über
    // seinen Namen selbst - genau der Weg, den ein fremdes Projekt nimmt.
    const skript = `
      const kern = await import('wealthcurve')
      const kurse = await import('wealthcurve/quotes')
      const profile = await import('wealthcurve/profile')
      console.log(typeof kern.buildProjection, typeof kern.marketFromPrices, typeof kurse.fetchQuotes, typeof profile.fetchProfiles)
    `
    const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(ausgabe.trim()).toBe('function function function function')
  }, 30_000)
})
