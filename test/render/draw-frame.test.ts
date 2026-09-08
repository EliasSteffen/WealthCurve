import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SPEC, frameAt, resolveFormat } from '@/core/animation'
import { clean, sketch } from '@/core/chart-style'
import { DEFAULT_MODEL } from '@/core/domain/math'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'
import { buildProjection } from '@/core/projection'
import { drawFrame, resolveText, type RenderTheme } from '@/render/canvas/drawFrame'

const projection = buildProjection({
  scenarios: [{ id: 'a', label: 'Basis', colorSlot: 1, params: DEFAULT_PARAMS }],
  seriesIds: ['compound', 'contributions'],
  model: DEFAULT_MODEL,
})

const theme: RenderTheme = {
  surface: '#111111',
  text: '#ffffff',
  textMuted: '#999999',
  grid: '#333333',
  axis: '#444444',
}

const colors = Object.fromEntries(projection.lines.map((l, i) => [l.key, `#00ff0${i}`]))

/** Zeichenbefehle mitschreiben, statt echte Pixel zu erzeugen. */
function spionCtx() {
  const aufrufe: string[] = []
  const zahlen: Record<string, number[]> = {}
  const merke = (name: string) => (...args: unknown[]) => {
    aufrufe.push(name)
    if (name === 'lineTo' || name === 'moveTo') {
      zahlen[name] = [...(zahlen[name] ?? []), ...(args as number[])]
    }
  }
  const ctx = {
    save: merke('save'), restore: merke('restore'),
    beginPath: merke('beginPath'), closePath: merke('closePath'),
    moveTo: merke('moveTo'), lineTo: merke('lineTo'),
    stroke: merke('stroke'), fill: merke('fill'), fillRect: merke('fillRect'),
    fillText: merke('fillText'), setLineDash: merke('setLineDash'),
    measureText: vi.fn(() => ({ width: 10 })),
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
    globalAlpha: 1, font: '', textAlign: '',
  } as unknown as CanvasRenderingContext2D
  return { ctx, aufrufe, zahlen }
}

const HOOK_BILDER = 75
const zeichnen = (index: number, style = clean) => {
  const { ctx, aufrufe, zahlen } = spionCtx()
  drawFrame(ctx, {
    frame: frameAt(DEFAULT_SPEC, projection, index),
    projection,
    style,
    format: resolveFormat('reel'),
    theme,
    colors,
    title: 'Basis',
    facts: { rate: '500 €', zinsertrag: '404.726 €', ansparjahre: '30' },
  })
  return { aufrufe, zahlen }
}

describe('drawFrame', () => {
  it('füllt zuerst den Hintergrund', () => {
    const { aufrufe } = zeichnen(HOOK_BILDER + 30)
    expect(aufrufe[0]).toBe('save')
    expect(aufrufe).toContain('fillRect')
  })

  it('zeichnet im ersten Bild noch keine Kurve', () => {
    // Bei Fortschritt 0 gibt es genau einen Punkt - eine Linie braucht zwei.
    const { aufrufe } = zeichnen(HOOK_BILDER)
    expect(aufrufe.filter((a) => a === 'stroke').length).toBeLessThanOrEqual(
      // Gitter und Legende dürfen zeichnen, die Kurven nicht.
      5 + projection.lines.length,
    )
  })

  it('zeichnet mit fortschreitender Zeit mehr Punkte', () => {
    const frueh = zeichnen(HOOK_BILDER + 20).zahlen.lineTo?.length ?? 0
    const spaet = zeichnen(HOOK_BILDER + 200).zahlen.lineTo?.length ?? 0
    expect(spaet).toBeGreaterThan(frueh)
  })

  it('bleibt innerhalb der Bildfläche', () => {
    const format = resolveFormat('reel')
    const { zahlen } = zeichnen(HOOK_BILDER + 200)
    const punkte = [...(zahlen.moveTo ?? []), ...(zahlen.lineTo ?? [])]
    for (let i = 0; i < punkte.length; i += 2) {
      expect(punkte[i]).toBeGreaterThanOrEqual(-1)
      expect(punkte[i]).toBeLessThanOrEqual(format.width + 1)
      expect(punkte[i + 1]).toBeGreaterThanOrEqual(-1)
      expect(punkte[i + 1]).toBeLessThanOrEqual(format.height + 1)
    }
  })

  it('liefert bei gleicher Eingabe identische Befehle', () => {
    // Zwei Aufnahmen desselben Bildes müssen deckungsgleich sein, sonst
    // flimmerte das Video zwischen den Einzelbildern.
    expect(zeichnen(HOOK_BILDER + 120, sketch).zahlen).toEqual(zeichnen(HOOK_BILDER + 120, sketch).zahlen)
  })

  it('lässt bei "minimal" Gitter und Achsen weg', () => {
    const mitGitter = zeichnen(HOOK_BILDER + 120, clean).aufrufe.filter((a) => a === 'stroke').length
    const ohne = zeichnen(HOOK_BILDER + 120, {
      ...clean,
      grid: { show: false, dash: null },
      axis: { show: false, tickLine: false, fontSize: 12 },
    }).aufrufe.filter((a) => a === 'stroke').length
    expect(ohne).toBeLessThan(mitGitter)
  })

  it('füllt nur bei Stilen mit Fläche', () => {
    const ohne = zeichnen(HOOK_BILDER + 120, clean).aufrufe.filter((a) => a === 'fill').length
    const mit = zeichnen(HOOK_BILDER + 120, { ...clean, area: { opacity: 0.2 } }).aufrufe.filter(
      (a) => a === 'fill',
    ).length
    expect(mit).toBeGreaterThan(ohne)
  })

  it('stürzt bei leerer Projektion nicht ab', () => {
    const leer = buildProjection({ scenarios: [], seriesIds: [], model: DEFAULT_MODEL })
    const { ctx } = spionCtx()
    expect(() =>
      drawFrame(ctx, {
        frame: frameAt(DEFAULT_SPEC, leer, 100),
        projection: leer,
        style: clean,
        format: resolveFormat('reel'),
        theme,
        colors: {},
        title: 'Leer',
        facts: {},
      }),
    ).not.toThrow()
  })
})

describe('resolveText', () => {
  it('setzt Platzhalter ein', () => {
    expect(resolveText('{{rate}} im Monat', { rate: '500 €' })).toBe('500 € im Monat')
  })

  it('lässt unbekannte Platzhalter leer, statt sie anzuzeigen', () => {
    // Ein rohes {{foo}} im fertigen Video wäre schlimmer als eine Lücke.
    expect(resolveText('a {{gibtsnicht}} b', {})).toBe('a  b')
  })

  it('verträgt Leerzeichen in den Klammern', () => {
    expect(resolveText('{{ rate }}', { rate: 'X' })).toBe('X')
  })
})
