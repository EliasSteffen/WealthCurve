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

describe('Kopfzeilen bei mehreren Szenarien', () => {
  const zweiSzenarien = buildProjection({
    scenarios: [
      { id: 'a', label: 'Basis', colorSlot: 1, params: DEFAULT_PARAMS },
      { id: 'b', label: 'Aggressiv', colorSlot: 2, params: { ...DEFAULT_PARAMS, annualRate: 9 } },
    ],
    seriesIds: ['compound', 'contributions'],
    model: DEFAULT_MODEL,
  })

  /** Schreibt jeden Textkasten mit Grundlinie und Schriftgröße mit. */
  function messCtx() {
    const kaesten: Array<{ text: string; x: number; y: number; size: number }> = []
    let size = 16
    const ctx = {
      save() {}, restore() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, stroke() {}, fill() {}, fillRect() {},
      setLineDash() {},
      measureText: (t: string) => ({ width: t.length * 0.5 * size }),
      fillText: (text: string, x: number, y: number) => kaesten.push({ text, x, y, size }),
      fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
      globalAlpha: 1, textAlign: 'left',
      set font(wert: string) {
        size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(wert)?.[1] ?? '16')
      },
      get font() {
        return `${size}px sans`
      },
    } as unknown as CanvasRenderingContext2D
    return { ctx, kaesten }
  }

  const zeichneAufbau = (formatId: string, projektion = zweiSzenarien) => {
    const { ctx, kaesten } = messCtx()
    drawFrame(ctx, {
      // Der Aufbau zeigt Kopfzeilen, Untertitel, Achsen und Legende gleichzeitig -
      // die dichteste Belegung, die im Video vorkommt.
      frame: frameAt(DEFAULT_SPEC, projektion, HOOK_BILDER + 150),
      projection: projektion,
      style: clean,
      format: resolveFormat(formatId),
      theme,
      colors: Object.fromEntries(projektion.lines.map((l, i) => [l.key, `#00ff0${i}`])),
      title: 'Basis',
      facts: { rendite: '7 %' },
    })
    return kaesten
  }

  for (const formatId of ['reel', 'square', 'wide']) {
    it(`stapelt im Format "${formatId}" keine Zeile auf eine andere`, () => {
      // Der eigentliche Fehler: der Zeilenabstand kam aus der Bildhöhe, die
      // Schriftgröße aus der Bildbreite. Im Quadrat standen 35 px Abstand gegen
      // 56 px Schrift - die Zeilen lagen übereinander.
      const kaesten = zeichneAufbau(formatId)
      const kasten = (k: (typeof kaesten)[number]) => ({
        links: k.x,
        rechts: k.x + k.text.length * 0.5 * k.size,
        oben: k.y - k.size * 0.8,
        unten: k.y + k.size * 0.25,
      })

      for (let i = 0; i < kaesten.length; i += 1) {
        for (let j = i + 1; j < kaesten.length; j += 1) {
          const a = kasten(kaesten[i])
          const b = kasten(kaesten[j])
          const ueberlappt =
            a.links < b.rechts && b.links < a.rechts && a.oben < b.unten && b.oben < a.unten
          expect(ueberlappt, `"${kaesten[i].text}" überlappt "${kaesten[j].text}"`).toBe(false)
        }
      }
    })

    it(`hält im Format "${formatId}" allen Text im Bild`, () => {
      const format = resolveFormat(formatId)
      for (const k of zeichneAufbau(formatId)) {
        expect(k.x + k.text.length * 0.5 * k.size, k.text).toBeLessThanOrEqual(format.width)
        expect(k.y, k.text).toBeLessThanOrEqual(format.height)
      }
    })
  }

  it('nennt beide Szenarien im Kopf', () => {
    const texte = zeichneAufbau('reel').map((k) => k.text)
    expect(texte).toContain('Basis')
    expect(texte).toContain('Aggressiv')
  })

  it('nennt in der Legende die Serien, nicht ein herausgegriffenes Szenario', () => {
    // In die Fußzeile passen zwei Zeilen. Von vier Linien blieben sonst zwei
    // übrig, beide mit "· Basis" beschriftet - das zweite Szenario käme unten
    // gar nicht vor und die Legende behauptete etwas Falsches.
    const texte = zeichneAufbau('reel').map((k) => k.text)
    expect(texte).toContain('Zinseszins')
    expect(texte.some((t) => t.includes(' · '))).toBe(false)
  })

  it('behält bei einem Szenario die volle Beschriftung', () => {
    // Ohne Vergleich ist der Serienname allein schon eindeutig - und war es
    // immer. Die Kürzung darf nur beim Vergleich greifen.
    const texte = zeichneAufbau('reel', projection).map((k) => k.text)
    expect(texte).toContain('Zinseszins')
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

describe('Textumbruch', () => {
  it('haelt langen Text innerhalb der Bildbreite', () => {
    // Platzhalter wie {{szenarien}} werden mit mehreren Szenarien beliebig
    // lang. Laeuft der Text aus dem Bild, ist das im fertigen Video verloren.
    const format = resolveFormat('reel')
    const lang =
      'Basis: 1.647.345 € · Szenario 2: 6.934.890 € · Szenario 3: 178.088 € · Szenario 4: 1 €'

    let maxRechts = 0
    const ctx = {
      save() {}, restore() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, stroke() {}, fill() {}, fillRect() {},
      setLineDash() {},
      // Grobe Breitenschaetzung genuegt: 0,5 em je Zeichen.
      measureText: (t: string) => ({ width: t.length * 0.5 * 40 }),
      fillText: (t: string, x: number) => {
        maxRechts = Math.max(maxRechts, x + t.length * 0.5 * 40)
      },
      fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
      globalAlpha: 1, font: '40px sans', textAlign: 'left',
    } as unknown as CanvasRenderingContext2D

    drawFrame(ctx, {
      frame: { ...frameAt(DEFAULT_SPEC, projection, 400), scene: { kind: 'punchline', text: lang, progress: 1 } },
      projection, style: clean, format, theme, colors, title: 'Basis',
      facts: {},
    })
    expect(maxRechts).toBeLessThanOrEqual(format.width)
  })
})

/*
 * Für die Beschriftung reicht der Spion oben nicht - er merkt sich nur die
 * Namen der Aufrufe, nicht ihre Argumente.
 */
function textSpion() {
  const texte: string[] = []
  const striche: Array<[number, number]> = []
  const nichts = () => {}
  const ctx = {
    save: nichts, restore: nichts, beginPath: nichts, closePath: nichts,
    moveTo: (x: number, y: number) => striche.push([x, y]),
    lineTo: nichts, stroke: nichts, fill: nichts, fillRect: nichts,
    fillText: (text: string) => texte.push(text),
    setLineDash: nichts,
    measureText: vi.fn(() => ({ width: 10 })),
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
    globalAlpha: 1, font: '', textAlign: '',
  } as unknown as CanvasRenderingContext2D
  return { ctx, texte, striche }
}

const zeichneMit = (extra: Record<string, unknown>, index = 75 + 60) => {
  const spion = textSpion()
  drawFrame(spion.ctx, {
    frame: frameAt(DEFAULT_SPEC, projection, index),
    projection,
    style: clean,
    format: resolveFormat('reel'),
    theme,
    colors,
    title: 'Basis',
    facts: {},
    ...extra,
  })
  return spion
}

describe('Beginn der Entnahme', () => {
  it('markiert den Übergang, wenn es eine Entnahmephase gibt', () => {
    // Ohne die Linie ist der Knick in der Kurve nicht zu deuten - dass ab dort
    // entnommen wird, ist die halbe Aussage des Videos.
    expect(zeichneMit({ hasWithdrawalPhase: true }).texte).toContain('Rentenbeginn')
  })

  it('markiert nichts, wenn gar nicht entnommen wird', () => {
    // projection.retirementYear steht auch dann da - die Linie zeigte sonst
    // einen Übergang an, den es nicht gibt.
    expect(zeichneMit({}).texte).not.toContain('Rentenbeginn')
    expect(zeichneMit({ hasWithdrawalPhase: false }).texte).not.toContain('Rentenbeginn')
  })

  it('übernimmt die Beschriftung der Oberfläche', () => {
    const texte = zeichneMit({ hasWithdrawalPhase: true, retirementLabel: 'Retirement' }).texte
    expect(texte).toContain('Retirement')
  })

  it('zieht die Linie über die volle Höhe der Zeichenfläche', () => {
    const { striche } = zeichneMit({ hasWithdrawalPhase: true })
    const senkrecht = striche.filter(([, y]) => y > 0)
    expect(senkrecht.length).toBeGreaterThan(0)
  })
})

describe('Jahreszahl', () => {
  it('steht standardmäßig unter der Achse', () => {
    expect(zeichneMit({}).texte.some((t) => t.startsWith('Jahr '))).toBe(true)
  })

  it('lässt sich abschalten, ohne sonst etwas zu ändern', () => {
    const mit = zeichneMit({})
    const ohne = zeichneMit({ showYear: false })
    expect(ohne.texte.some((t) => t.startsWith('Jahr '))).toBe(false)
    // Nur diese eine Zeile fällt weg - Kopf, Achse und Legende bleiben.
    expect(ohne.texte.length).toBe(mit.texte.length - 1)
  })

  it('zeigt sie bei showYear: true weiterhin', () => {
    expect(zeichneMit({ showYear: true }).texte.some((t) => t.startsWith('Jahr '))).toBe(true)
  })
})
