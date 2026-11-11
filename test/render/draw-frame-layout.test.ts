import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, frameAt, resolveFormat, type AnimationSpec } from '@/core/animation'
import { clean } from '@/core/chart-style'
import { DEFAULT_MODEL } from '@/core/domain/math'
import { DEFAULT_PARAMS } from '@/core/domain/parameters'
import { buildProjection, type Projection } from '@/core/projection'
import { drawFrame, type DrawInput, type RenderTheme } from '@/render/canvas/drawFrame'
import { themeLineColors } from '@/render/canvas/themes'

const theme: RenderTheme = {
  surface: '#ffffff',
  text: '#000000',
  textMuted: '#999999',
  grid: '#eeeeee',
  axis: '#cccccc',
}

interface Text {
  text: string
  x: number
  y: number
  size: number
  align: string
  stroke: string
}

const szenarien = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    label: `Szenario ${i + 1}`,
    colorSlot: i + 1,
    params: { ...DEFAULT_PARAMS, annualRate: 5 + i },
  }))

const bauen = (n: number, over: Partial<Parameters<typeof buildProjection>[0]> = {}) =>
  buildProjection({
    scenarios: szenarien(n),
    seriesIds: ['compound', 'contributions'],
    model: DEFAULT_MODEL,
    ...over,
  })

/** Zeichnet mit einem Spion, der jeden Text samt Schrift und Position merkt. */
function zeichnen(
  projection: Projection,
  formatId: string,
  index: number,
  extra: Partial<DrawInput> = {},
  spec: AnimationSpec = DEFAULT_SPEC,
  facts: Record<string, string> = {},
) {
  const texte: Text[] = []
  let size = 16
  let align = 'left'
  let stroke = ''
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    fillRect() {},
    setLineDash() {},
    measureText: (t: string) => ({ width: t.length * 0.5 * size }),
    fillText: (text: string, x: number, y: number) =>
      texte.push({ text, x, y, size, align, stroke }),
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    globalAlpha: 1,
    set strokeStyle(v: string) {
      stroke = v
    },
    get strokeStyle() {
      return stroke
    },
    set textAlign(v: string) {
      align = v
    },
    get textAlign() {
      return align
    },
    set font(v: string) {
      size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(v)?.[1] ?? '16')
    },
    get font() {
      return `${size}px`
    },
  } as unknown as CanvasRenderingContext2D
  const format = resolveFormat(formatId as 'reel')
  drawFrame(ctx, {
    frame: frameAt(spec, projection, index),
    projection,
    style: clean,
    format,
    theme,
    colors: themeLineColors(projection.lines, 'light'),
    title: 'x',
    facts,
    ...extra,
  })
  return { texte, format }
}

const kasten = (k: Text) => {
  const w = k.text.length * 0.5 * k.size
  const l = k.align === 'center' ? k.x - w / 2 : k.align === 'right' ? k.x - w : k.x
  return { l, r: l + w, o: k.y - k.size * 0.8, u: k.y + k.size * 0.25 }
}

function schneiden(a: Text, b: Text): boolean {
  const ka = kasten(a)
  const kb = kasten(b)
  return ka.l < kb.r && kb.l < ka.r && ka.o < kb.u && kb.o < ka.u
}

function ueberlappungen(texte: readonly Text[]): string[] {
  return texte.flatMap((a, i) =>
    texte
      .slice(i + 1)
      .filter((b) => schneiden(a, b))
      .map((b) => `${a.text} x ${b.text}`),
  )
}

const BUILD = 75 + 150

describe('Legende', () => {
  // Ausdrücklich nach Serie gefärbt: nur dann trägt die Linienfarbe die Serie.
  const p = bauen(2, { encoding: 'colorBySeries' })

  it('nimmt die Farbe der ersten Linie je Serie, nicht der letzten', () => {
    // Zwei Szenarien, deren Linien derselben Serie verschieden gefärbt sind;
    // der Schlüssel gehört zum ersten Szenario (blau), nicht zum letzten.
    const nachSzenario = bauen(2, { encoding: 'colorByScenario' })
    const f = themeLineColors(nachSzenario.lines, 'light')
    const linien = nachSzenario.lines.filter((l) => l.seriesId === 'compound')
    expect(f[linien[0].key]).not.toBe(f[linien[1].key])
    const { texte } = zeichnen({ ...nachSzenario, encodingId: 'colorBySeries' }, 'reel', BUILD)
    expect(texte.find((t) => t.text.startsWith('Zinseszins'))!.stroke).toBe(f[linien[0].key])
  })

  it('führt beim Kursverlauf jedes Wertpapier einzeln', () => {
    const kurs = (symbol: string, monatsrendite: number) => ({
      symbol,
      name: `${symbol} Inc.`,
      currency: 'USD',
      start: '2000-01-01',
      monthlyReturns: Array(240).fill(monatsrendite) as number[],
    })
    const m = bauen(2, {
      seriesIds: ['marketReturn'],
      markets: [kurs('AAPL', 0.006), kurs('MSFT', 0.004)],
      model: { ...DEFAULT_MODEL, startYear: 2000 },
      encoding: 'colorBySeries',
    })
    const { texte } = zeichnen(m, 'reel', BUILD)
    const namen = texte.map((t) => t.text)
    // Je Wertpapier ein Eintrag, nicht einer je Serie.
    expect(namen.filter((n) => n.includes('AAPL'))).toHaveLength(1)
    expect(namen.filter((n) => n.includes('MSFT'))).toHaveLength(1)
    // Und die Farbe stammt vom ersten Szenario.
    const aapl = m.lines.find((l) => l.variantLabel === 'AAPL')!
    expect(texte.find((t) => t.text.includes('AAPL'))!.stroke).toBe(
      themeLineColors(m.lines, 'light')[aapl.key],
    )
  })

  it('zeichnet bei Färbung nach Szenario den Schlüssel in Textfarbe', () => {
    const { texte } = zeichnen({ ...p, encodingId: 'colorByScenario' }, 'reel', BUILD)
    const eintrag = texte.find((t) => t.text.startsWith('Zinseszins'))!
    expect(eintrag.stroke).toBe(theme.text)
  })

  it('übernimmt eine übersetzte Beschriftung', () => {
    const { texte } = zeichnen(p, 'reel', BUILD, {
      lineLabel: (l) => `EN ${l.seriesId} · ${l.scenarioLabel}`,
    })
    expect(texte.some((t) => t.text === 'EN compound')).toBe(true)
  })
})

describe('Übersetzung der festen Texte', () => {
  it('bleibt ohne t deutsch und nutzt sonst den Katalog', () => {
    const p = bauen(1)
    const de = zeichnen(p, 'reel', BUILD).texte.map((t) => t.text)
    expect(de.some((t) => /^Jahr \d+$/.test(t))).toBe(true)
    const en = zeichnen(p, 'reel', BUILD, {
      t: (k, fb, v) => (k === 'video.frame.year' ? `Year ${v?.year}` : fb),
    }).texte.map((t) => t.text)
    expect(en.some((t) => /^Year \d+$/.test(t))).toBe(true)
  })

  it('übersetzt "+ N weitere"', () => {
    const p = bauen(4)
    expect(zeichnen(p, 'reel', BUILD).texte.some((t) => t.text === '+ 1 weitere')).toBe(true)
    const { texte } = zeichnen(p, 'reel', BUILD, {
      t: (k, fb, v) => (k === 'video.frame.more' ? `+ ${v?.count} more` : fb),
    })
    expect(texte.some((t) => t.text === '+ 1 more')).toBe(true)
  })
})

describe('Textgrößen und Überlappung', () => {
  const lang: AnimationSpec = {
    ...DEFAULT_SPEC,
    scenes: [
      ...DEFAULT_SPEC.scenes.slice(0, 2),
      {
        kind: 'punchline',
        seconds: 3.5,
        text: 'Eingezahlt: {{eingezahlt}}\nZinsen: {{zinsertrag}}\nEndkapital: {{endkapital}}\nRendite: {{rendite}}',
      },
    ],
  }
  const facts = {
    eingezahlt: '180.000 €',
    zinsertrag: '404.726 €',
    endkapital: '584.726 €',
    rendite: '7 %',
  }
  const punchlineBild = 75 + 150 + 300

  for (const id of ['wide', 'reel', 'square']) {
    for (const n of [2, 4]) {
      it(`überlappt im Format ${id} mit ${n} Szenarien nichts`, () => {
        const p = bauen(n)
        expect(frameAt(lang, p, punchlineBild).scene.kind).toBe('punchline')
        const { texte, format } = zeichnen(p, id, punchlineBild, {}, lang, facts)
        // Die Pointe liegt bewusst auf einem deckenden Grund über Kurve und
        // Achsenzahlen; die dürfen sich also überdecken. Alles andere nicht.
        const achse = Math.round(Math.min(format.width, format.height) * 0.024)
        const sichtbar = texte.filter((t) => t.size !== achse)
        const pointe = sichtbar.filter((t) => /^(Eingezahlt|Zinsen|Endkapital|Rendite):/.test(t.text))
        expect(pointe).toHaveLength(4)
        const rest = sichtbar.filter((t) => !pointe.includes(t))
        const kollisionen = pointe.flatMap((z) =>
          rest.filter((r) => schneiden(z, r)).map((r) => `${z.text} x ${r.text}`),
        )
        expect(kollisionen).toEqual([])
        expect(ueberlappungen(pointe)).toEqual([])
        for (const t of texte) {
          const k = kasten(t)
          expect(k.o).toBeGreaterThanOrEqual(0)
          expect(k.u).toBeLessThanOrEqual(format.height)
        }
      })
    }
  }

  it('bemisst Aufhänger im Querformat nach der kürzeren Kante', () => {
    const { texte, format } = zeichnen(bauen(1), 'wide', 10)
    const haken = Math.max(...texte.map((t) => t.size))
    expect(haken).toBe(Math.round(format.height * 0.082))
  })

  it('setzt "+ N weitere" im Querformat unter die letzte Wertzeile', () => {
    const { texte } = zeichnen(bauen(4), 'wide', BUILD)
    expect(texte.some((t) => t.text === '+ 1 weitere')).toBe(true)
    expect(ueberlappungen(texte)).toEqual([])
  })
})
