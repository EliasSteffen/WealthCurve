import { describe, expect, it } from 'vitest'
import { CSV_BOM, csvBlob, csvFilename } from '@/lib/download'

describe('CSV-Download', () => {
  it('Dateiname mit lokalem Datum', () => {
    expect(csvFilename(new Date(2026, 0, 5, 23, 59))).toBe('wealthcurve-2026-01-05.csv')
    expect(csvFilename(new Date(2026, 10, 11))).toBe('wealthcurve-2026-11-11.csv')
  })

  it('beginnt mit UTF-8-BOM und behält € und Umlaute', async () => {
    const text = 'Jahr;Größe\n1;5,00 €'
    const blob = csvBlob(text)
    expect(blob.type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(CSV_BOM + text)
  })
})
