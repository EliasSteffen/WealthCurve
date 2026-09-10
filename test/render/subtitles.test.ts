import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEC, totalSeconds, type AnimationSpec } from '@/core/animation'
import { srtZeit, toSrt } from '@/render/subtitles'

const facts = { rate: '500 €', ansparjahre: '30', rendite: '7 %' }

const spec = (over: Partial<AnimationSpec> = {}): AnimationSpec => ({ ...DEFAULT_SPEC, ...over })

describe('srtZeit', () => {
  it('schreibt Stunden, Minuten, Sekunden und Millisekunden', () => {
    expect(srtZeit(0)).toBe('00:00:00,000')
    expect(srtZeit(2.5)).toBe('00:00:02,500')
    expect(srtZeit(61.25)).toBe('00:01:01,250')
    expect(srtZeit(3661.001)).toBe('01:01:01,001')
  })

  it('setzt ein Komma, keinen Punkt', () => {
    // SRT verlangt das Komma - mit Punkt lehnen die Plattformen die Datei ab.
    expect(srtZeit(1.5)).toContain(',')
    expect(srtZeit(1.5)).not.toContain('.')
  })

  it('bleibt bei negativen Werten bei null', () => {
    expect(srtZeit(-5)).toBe('00:00:00,000')
  })
})

describe('toSrt', () => {
  it('nummeriert fortlaufend und löst die Platzhalter auf', () => {
    const srt = toSrt(spec(), facts)
    expect(srt.startsWith('1\n00:00:00,000 --> ')).toBe(true)
    expect(srt).toContain('500 €')
    expect(srt).not.toContain('{{')
  })

  it('reiht die Szenen lückenlos aneinander', () => {
    // Das Ende einer Szene ist der Anfang der nächsten - eine Lücke wäre ein
    // stummer Moment, den es im Bild nicht gibt.
    const zeiten = toSrt(spec(), facts)
      .split('\n')
      .filter((z) => z.includes('-->'))
      .map((z) => z.split(' --> '))
    for (let i = 1; i < zeiten.length; i += 1) expect(zeiten[i][0]).toBe(zeiten[i - 1][1])
  })

  it('endet mit dem Video', () => {
    const letzte = toSrt(spec(), facts)
      .split('\n')
      .filter((z) => z.includes('-->'))
      .at(-1)!
      .split(' --> ')[1]
    expect(letzte).toBe(srtZeit(totalSeconds(spec())))
  })

  it('rückt die Nummern nach, wenn eine Szene übersprungen wird', () => {
    // Ein Untertitel ohne Inhalt ist im Abspielgerät ein leerer Kasten. Die
    // Nummerierung muss trotzdem bei 1 beginnen und lückenlos bleiben.
    const ohneAufhaenger = spec({
      scenes: DEFAULT_SPEC.scenes.map((s, i) => (i === 0 ? { ...s, seconds: 0 } : s)),
    })
    const srt = toSrt(ohneAufhaenger, facts)
    expect(srt.split('\n')[0]).toBe('1')
    // Die entfallene Szene dauert 0 s, die nächste beginnt also bei null.
    expect(srt).toContain('00:00:00,000 --> ')
  })

  it('zählt die Zeit einer übersprungenen Szene trotzdem mit', () => {
    /*
     * Der Fall, der wirklich schiefgehen kann: eine Szene läuft im Bild, hat
     * aber keinen Text. Fiele ihre Dauer mit weg, säßen alle folgenden
     * Untertitel zu früh - und zwar umso mehr, je weiter hinten sie stehen.
     */
    const stummerAufhaenger = spec({
      scenes: DEFAULT_SPEC.scenes.map((s, i) => (i === 0 ? { ...s, seconds: 4, text: '' } : s)),
    })
    const erste = toSrt(stummerAufhaenger, facts).split('\n')[1]
    expect(erste.startsWith('00:00:04,000 --> ')).toBe(true)
  })

  it('lässt Szenen ohne Text weg', () => {
    const stumm = spec({ scenes: DEFAULT_SPEC.scenes.map((s) => ({ ...s, text: '   ' })) })
    expect(toSrt(stumm, facts)).toBe('')
  })

  it('rechnet mit den tatsächlichen Bildern, nicht mit den eingegebenen Sekunden', () => {
    // 2,51 s bei 30 Bildern sind 75 Bilder und damit exakt 2,5 s. Eine Spur,
    // die um Bruchteile verschoben ist, fällt genau dann auf, wenn es zählt.
    const krumm = spec({
      fps: 30,
      scenes: [{ ...DEFAULT_SPEC.scenes[0], seconds: 2.51, text: 'Hallo' }],
    })
    expect(toSrt(krumm, facts)).toContain('00:00:00,000 --> 00:00:02,500')
  })
})
