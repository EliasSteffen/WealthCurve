import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAbortError, paceFrames } from '../../src/lib/recordCanvas'

afterEach(() => vi.useRealTimers())

describe('paceFrames', () => {
  it('plant gegen absolute Termine statt Intervall + Zeichenzeit', async () => {
    let jetzt = 0
    const waits: number[] = []
    const gezeichnet: number[] = []
    await paceFrames({
      frameCount: 4,
      intervalMs: 100,
      now: () => jetzt,
      wait: async (ms) => {
        waits.push(ms)
        jetzt += ms
      },
      onFrame: (i) => {
        gezeichnet.push(i)
        jetzt += 30 // Zeichnen dauert 30 ms
      },
    })
    expect(gezeichnet).toEqual([0, 1, 2, 3])
    // Je Bild nur der Rest bis zum Termin: kein Drift.
    expect(waits).toEqual([70, 70, 70, 70])
    expect(jetzt).toBe(400)
  })

  it('holt auf, wenn ein Bild zu lange braucht', async () => {
    let jetzt = 0
    const waits: number[] = []
    await paceFrames({
      frameCount: 3,
      intervalMs: 100,
      now: () => jetzt,
      wait: async (ms) => {
        waits.push(ms)
        jetzt += ms
      },
      onFrame: (i) => {
        jetzt += i === 0 ? 250 : 10
      },
    })
    expect(waits).toEqual([0, 0, 30])
    expect(jetzt).toBe(300)
  })

  it('läuft mit Fake-Timern in Echtzeit', async () => {
    vi.useFakeTimers()
    let n = 0
    let fertig = false
    void paceFrames({ frameCount: 5, intervalMs: 50, onFrame: () => void (n += 1) }).then(
      () => (fertig = true),
    )
    await vi.advanceTimersByTimeAsync(199)
    expect(n).toBe(4)
    expect(fertig).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(n).toBe(5)
    // Das letzte Bild bekommt noch seine volle Dauer.
    await vi.advanceTimersByTimeAsync(50)
    expect(fertig).toBe(true)
  })

  it('bricht ab, ohne weitere Bilder zu zeichnen', async () => {
    vi.useFakeTimers()
    const ctrl = new AbortController()
    let n = 0
    const fehler = paceFrames({
      frameCount: 100,
      intervalMs: 50,
      signal: ctrl.signal,
      onFrame: () => void (n += 1),
    }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(120)
    ctrl.abort()
    await vi.advanceTimersByTimeAsync(10)
    expect(isAbortError(await fehler)).toBe(true)
    const gesehen = n
    await vi.advanceTimersByTimeAsync(1000)
    expect(n).toBe(gesehen)
  })
})
