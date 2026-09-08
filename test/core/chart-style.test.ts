import { describe, expect, it } from 'vitest'
import { CHART_STYLES, DEFAULT_CHART_STYLE_ID, resolveChartStyle } from '@/core/chart-style'

describe('Stil-Registry', () => {
  it('vergibt eindeutige IDs und Bezeichnungen', () => {
    expect(new Set(CHART_STYLES.map((s) => s.id)).size).toBe(CHART_STYLES.length)
    expect(new Set(CHART_STYLES.map((s) => s.label)).size).toBe(CHART_STYLES.length)
  })

  it('kennt den Standardstil', () => {
    expect(CHART_STYLES.some((s) => s.id === DEFAULT_CHART_STYLE_ID)).toBe(true)
  })

  it('fällt bei unbekannter ID auf den Standard zurück', () => {
    expect(resolveChartStyle('gibt-es-nicht').id).toBe(DEFAULT_CHART_STYLE_ID)
  })

  it('liefert für jeden Stil plausible Werte', () => {
    for (const style of CHART_STYLES) {
      expect(style.line.width, style.id).toBeGreaterThan(0)
      expect(style.line.jitter, style.id).toBeGreaterThanOrEqual(0)
      expect(style.area.opacity, style.id).toBeGreaterThanOrEqual(0)
      expect(style.area.opacity, style.id).toBeLessThanOrEqual(1)
      expect(style.axis.fontSize, style.id).toBeGreaterThan(0)
      expect(style.description, style.id).toBeTruthy()
    }
  })

  it('unterscheidet die Stile sichtbar voneinander', () => {
    // Zwei Stile mit identischer Geometrie wären im Umschalter nicht erklärbar.
    const abdruecke = CHART_STYLES.map((s) =>
      JSON.stringify([s.line, s.area, s.grid, s.axis, s.labels, s.fontFamily]),
    )
    expect(new Set(abdruecke).size).toBe(CHART_STYLES.length)
  })

  it('gibt genau dem gezeichneten Stil einen Versatz', () => {
    for (const style of CHART_STYLES) {
      expect(style.line.jitter > 0, style.id).toBe(style.id === 'sketch')
    }
  })

  it('bleibt reines JSON', () => {
    // Der Canvas-Renderer bekommt den Stil später über eine Prozessgrenze.
    expect(JSON.parse(JSON.stringify(CHART_STYLES))).toEqual(CHART_STYLES)
  })
})
