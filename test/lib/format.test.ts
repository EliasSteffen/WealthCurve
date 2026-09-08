import { describe, expect, it } from 'vitest'
import { formatEur, formatEurCompact, formatPercent, parseGermanNumber } from '@/lib/format'

/*
 * de-DE setzt ein GESCHUETZTES Leerzeichen (U+00A0) vor das Euro-Zeichen.
 * Ein Vergleich mit normalem Leerzeichen schlaegt fehl, und der Diff ist im
 * Terminal unsichtbar - deshalb normalisieren wir.
 */
const normalize = (s: string) => s.replace(/[  ]/g, ' ')

describe('Formatierung', () => {
  it('formatiert Euro auf Deutsch', () => {
    expect(normalize(formatEur(1234.56))).toBe('1.235 €')
    expect(normalize(formatEur(0))).toBe('0 €')
  })

  it('benutzt tatsaechlich ein geschuetztes Leerzeichen', () => {
    expect(formatEur(1000)).toContain(' ')
  })

  it('kuerzt erst ab Millionen ab', () => {
    // Deutsches Compact lässt Tausender ausgeschrieben - das ist Absicht.
    expect(normalize(formatEurCompact(609_985))).toBe('609.985 €')
    expect(normalize(formatEurCompact(1_234_567))).toBe('1,2 Mio. €')
  })

  it('formatiert Prozentpunkte', () => {
    expect(normalize(formatPercent(7.25))).toBe('7,25 %')
    expect(normalize(formatPercent(0))).toBe('0 %')
    expect(normalize(formatPercent(-2))).toBe('-2 %')
  })
})

describe('parseGermanNumber', () => {
  it('akzeptiert Komma als Dezimaltrenner', () => {
    expect(parseGermanNumber('4,5')).toBe(4.5)
    expect(parseGermanNumber('7,25')).toBe(7.25)
  })

  it('akzeptiert auch den Punkt', () => {
    expect(parseGermanNumber('4.5')).toBe(4.5)
  })

  it('versteht Tausenderpunkte', () => {
    expect(parseGermanNumber('1.234,56')).toBe(1234.56)
    expect(parseGermanNumber('10.000')).toBe(10000)
    expect(parseGermanNumber('1.234.567')).toBe(1234567)
  })

  it('loest den mehrdeutigen Punkt nach der Gruppenregel auf', () => {
    // Drei Ziffern dahinter -> Tausenderpunkt. Sonst Dezimaltrenner.
    expect(parseGermanNumber('4.500')).toBe(4500)
    expect(parseGermanNumber('4.5')).toBe(4.5)
    expect(parseGermanNumber('4.25')).toBe(4.25)
  })

  it('ignoriert Einheiten', () => {
    expect(parseGermanNumber('500 €')).toBe(500)
    expect(parseGermanNumber('7,5 %')).toBe(7.5)
  })

  it('liefert NaN für Leereingaben', () => {
    expect(parseGermanNumber('')).toBeNaN()
    expect(parseGermanNumber('   ')).toBeNaN()
    expect(parseGermanNumber('-')).toBeNaN()
  })

  it('versteht negative Werte', () => {
    expect(parseGermanNumber('-2,5')).toBe(-2.5)
  })
})
