import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '@/core/domain/math'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'
import { buildProjection } from '@/core/projection'
import {
  effectiveMode,
  marketMonthOffset,
  sanitizeStartAge,
  sanitizeStartYear,
  yearLabel,
  yearLabels,
} from '@/core/timeAxis'

const model = (over: Partial<typeof DEFAULT_MODEL> = {}) => ({ ...DEFAULT_MODEL, ...over })

describe('effectiveMode', () => {
  it('greift nur mit passendem Anker', () => {
    // Sonst stünde „Alter" an der Achse und darunter dieselben Zahlen wie
    // vorher - ein stiller Fehlschlag, den niemand bemerkt.
    expect(effectiveMode(model({ timeAxis: 'age' }))).toBe('relative')
    expect(effectiveMode(model({ timeAxis: 'calendar' }))).toBe('relative')
    expect(effectiveMode(model({ timeAxis: 'age', startAge: 30 }))).toBe('age')
    expect(effectiveMode(model({ timeAxis: 'calendar', startYear: 1990 }))).toBe('calendar')
  })

  it('lässt einen ungenutzten Anker die Anzeige nicht verändern', () => {
    // Ein gesetztes Alter darf nichts tun, solange „Jahre ab 0" gewählt ist.
    expect(effectiveMode(model({ timeAxis: 'relative', startAge: 30, startYear: 1990 }))).toBe(
      'relative',
    )
  })
})

describe('yearLabel', () => {
  it('zählt ohne Anker schlicht hoch', () => {
    expect(yearLabels(3, model())).toEqual(['0', '1', '2'])
  })

  it('rechnet das Alter dazu', () => {
    const m = model({ timeAxis: 'age', startAge: 30 })
    expect(yearLabel(0, m)).toBe('30')
    expect(yearLabel(35, m)).toBe('65')
  })

  it('rechnet das Kalenderjahr dazu', () => {
    const m = model({ timeAxis: 'calendar', startYear: 1960 })
    expect(yearLabels(3, m)).toEqual(['1960', '1961', '1962'])
  })
})

describe('Grenzen der Anker', () => {
  it('hält Alter und Jahr im sinnvollen Bereich', () => {
    expect(sanitizeStartAge(-5)).toBe(0)
    expect(sanitizeStartAge(999)).toBe(100)
    expect(sanitizeStartAge(30.7)).toBe(31)
    expect(sanitizeStartYear(1500)).toBe(1900)
    expect(sanitizeStartYear(99999)).toBe(2100)
  })

  it('behält „nicht gesetzt" als gültigen Zustand', () => {
    // Ein geleertes Zahlenfeld liefert NaN - daraus muss null werden, nicht 0.
    expect(sanitizeStartAge(null)).toBeNull()
    expect(sanitizeStartAge(Number.NaN)).toBeNull()
    expect(sanitizeStartYear(Number.NaN)).toBeNull()
  })
})

describe('marketMonthOffset', () => {
  it('zählt die Monate vom Beginn der Historie bis zum Startjahr', () => {
    // Historie ab Oktober 1986, Start Januar 1990: 3 Jahre und 3 Monate.
    expect(marketMonthOffset('1986-10-01', 1990)).toBe(39)
    expect(marketMonthOffset('2000-01-01', 2000)).toBe(0)
  })

  it('wird negativ, wenn es das Papier im Startjahr noch nicht gab', () => {
    expect(marketMonthOffset('1986-10-01', 1980)).toBeLessThan(0)
  })

  it('lehnt unbrauchbare Daten ab', () => {
    expect(marketMonthOffset('unbekannt', 1990)).toBeNull()
  })
})

describe('Kursverlauf braucht ein Startjahr', () => {
  const kurs = (start: string, monate = 360) => ({
    symbol: 'TEST',
    name: 'Test AG',
    currency: 'USD',
    start,
    monthlyReturns: Array(monate).fill(0.005) as number[],
  })

  const bauen = (over: Partial<typeof DEFAULT_MODEL>, start = '1990-01-01') =>
    buildProjection({
      scenarios: [{ id: 'a', label: 'Basis', colorSlot: 1, params: DEFAULT_PARAMS }],
      seriesIds: ['marketReturn'],
      model: model(over),
      markets: [kurs(start)],
    })

  it('zeichnet ohne Startjahr nichts', () => {
    // Echte Monatsrenditen hängen an echten Monaten. Ohne Anker hieße der
    // Vergleich stillschweigend „ab dem Monat, in dem die Historie zufällig
    // beginnt" - und vorwärts lässt sich ein Kurs ohnehin nicht fortschreiben.
    const p = bauen({ startYear: null })
    expect(p.rows.every((row) => row[p.lines[0].key] === null)).toBe(true)
  })

  it('zeichnet mit Startjahr', () => {
    const p = bauen({ startYear: 1990 })
    expect(p.rows[10][p.lines[0].key]).toBeGreaterThan(0)
  })

  it('zeichnet nichts, wenn es das Papier im Startjahr noch nicht gab', () => {
    // Lieber eine leere Kurve als eine, die heimlich woanders anfängt.
    const p = bauen({ startYear: 1980 }, '1990-01-01')
    expect(p.rows.every((row) => row[p.lines[0].key] === null)).toBe(true)
  })

  it('verschiebt die Historie um das gewählte Startjahr', () => {
    // Später einsteigen heißt: weniger Historie übrig, die Kurve endet früher.
    const frueh = bauen({ startYear: 1990 }, '1990-01-01')
    const spaet = bauen({ startYear: 2010 }, '1990-01-01')
    const letztesJahr = (p: ReturnType<typeof bauen>) =>
      p.rows.map((row) => row[p.lines[0].key]).filter((v) => typeof v === 'number').length
    expect(letztesJahr(spaet)).toBeLessThan(letztesJahr(frueh))
  })
})

describe('Beschriftung in der Projektion', () => {
  const basis = { id: 'a', label: 'Basis', colorSlot: 1, params: DEFAULT_PARAMS }

  it('liefert eine Beschriftung je Zeile', () => {
    const p = buildProjection({
      scenarios: [basis],
      seriesIds: ['compound'],
      model: model({ timeAxis: 'calendar', startYear: 2000 }),
    })
    expect(p.yearLabels).toHaveLength(p.rows.length)
    expect(p.yearLabels[0]).toBe('2000')
  })

  it('ändert keine einzige Zahl', () => {
    // Der ganze Sinn der Trennung: die Achse ist Beschriftung, nicht Rechnung.
    const ohne = buildProjection({ scenarios: [basis], seriesIds: ['compound'], model: model() })
    const mit = buildProjection({
      scenarios: [basis],
      seriesIds: ['compound'],
      model: model({ timeAxis: 'age', startAge: 30 }),
    })
    expect(mit.rows).toEqual(ohne.rows)
    expect(mit.summaries).toEqual(ohne.summaries)
  })
})
