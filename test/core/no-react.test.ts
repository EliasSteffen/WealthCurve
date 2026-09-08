import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Architektonische Wache.
 *
 * Der Kern muss ohne React, ohne DOM und ohne Chart-Bibliothek laufen - das ist
 * die Voraussetzung dafür, dass dieselbe Logik aus Node, einem späteren
 * MCP-Server oder einem Video-Renderer heraus nutzbar ist. Diese Grenze ist
 * leicht versehentlich zu durchbrechen, deshalb prüft sie ein Test statt eines
 * Kommentars.
 */
const FORBIDDEN = ['react', 'react-dom', 'recharts', 'lucide-react']

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })

describe('Kern bleibt framework-frei', () => {
  const files = walk('src/core').filter((f) => !f.endsWith('.test.ts'))

  it('findet überhaupt Dateien', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('importiert nirgends React, Recharts oder DOM-Bibliotheken', () => {
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1]
        if (FORBIDDEN.includes(specifier)) offenders.push(`${file} -> ${specifier}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('enthält kein JSX', () => {
    expect(files.filter((f) => f.endsWith('.tsx'))).toEqual([])
  })

  it('greift nicht auf document oder window zu', () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /\b(document|window|localStorage)\s*\./.test(source)
    })
    expect(offenders).toEqual([])
  })
})
