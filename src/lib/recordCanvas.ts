/**
 * Nimmt ein Canvas Bild für Bild als Video auf.
 *
 * Nutzt die eingebaute MediaRecorder-API - kein ffmpeg, kein Remotion.
 */

export interface RecordingFormat {
  readonly mimeType: string
  readonly extension: 'mp4' | 'webm'
}

/**
 * MP4 zuerst: WebM lässt sich zwar überall abspielen, aber Instagram und
 * TikTok nehmen es nicht direkt an. Welches Format es geworden ist, gibt die
 * Funktion zurück - die Oberfläche sagt es weiter, statt es zu verschweigen.
 */
const KANDIDATEN: readonly RecordingFormat[] = [
  // Level 4.0 (High, dann Main) reicht für 1080×1920; Baseline 3.0 liegt
  // darunter, manche Encoder lehnen die Größe dann ab oder skalieren herunter.
  { mimeType: 'video/mp4;codecs=avc1.640028', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1.4D0028', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
]

/**
 * Dieselbe Reihenfolge, aber mit Tonspur im Typ.
 *
 * Ein mimeType, der nur einen Videocodec nennt, nimmt die Tonspur zwar
 * entgegen - manche Browser lassen sie dann still weg. Das Ergebnis wäre ein
 * stummes Video ohne jede Fehlermeldung.
 */
const KANDIDATEN_MIT_TON: readonly RecordingFormat[] = [
  { mimeType: 'video/mp4;codecs=avc1.640028,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1.4D0028,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
]

export function pickRecordingFormat(mitTon = false): RecordingFormat | null {
  if (typeof MediaRecorder === 'undefined') return null
  const kandidaten = mitTon ? KANDIDATEN_MIT_TON : KANDIDATEN
  return kandidaten.find((k) => MediaRecorder.isTypeSupported(k.mimeType)) ?? null
}

/** Der Tab ging in den Hintergrund - dort drosselt der Browser Timer auf ~1 s. */
export class TabHiddenError extends Error {
  constructor() {
    super('Die Aufnahme wurde abgebrochen, weil der Tab in den Hintergrund ging.')
    this.name = 'TabHiddenError'
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError'
}

function abortError(): Error {
  const e = new Error('Aufnahme abgebrochen')
  e.name = 'AbortError'
  return e
}

export interface PaceOptions {
  readonly frameCount: number
  readonly intervalMs: number
  readonly onFrame: (index: number) => void
  readonly signal?: AbortSignal
  /** Injizierbar für Tests. */
  readonly now?: () => number
  readonly wait?: (ms: number, signal?: AbortSignal) => Promise<void>
}

function defaultWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const fertig = () => {
      clearTimeout(id)
      signal?.removeEventListener('abort', fertig)
      resolve()
    }
    const id = setTimeout(fertig, ms)
    signal?.addEventListener('abort', fertig, { once: true })
  })
}

/**
 * Taktet Bilder gegen absolute Termine (`t0 + i * Intervall`).
 *
 * Ein festes `setTimeout(Intervall)` je Bild addiert die Laufzeit des
 * Zeichnens jedes Mal obendrauf - das Video würde länger als geplant. Hinkt
 * die Schleife hinterher, wartet sie nicht, sondern holt auf.
 */
export async function paceFrames(options: PaceOptions): Promise<void> {
  const { frameCount, intervalMs, onFrame, signal } = options
  const now = options.now ?? (() => performance.now())
  const wait = options.wait ?? defaultWait
  const t0 = now()
  for (let i = 0; i < frameCount; i += 1) {
    if (signal?.aborted) throw abortError()
    onFrame(i)
    const verbleibend = t0 + (i + 1) * intervalMs - now()
    await wait(Math.max(0, verbleibend), signal)
  }
  if (signal?.aborted) throw abortError()
}

export interface RecordOptions {
  readonly frameCount: number
  readonly fps: number
  readonly draw: (index: number) => void
  readonly onProgress?: (done: number, total: number) => void
  readonly signal?: AbortSignal
  /**
   * Tonspur, die mit aufgenommen wird.
   *
   * Kommt fertig von außen: das Aufbauen des Audio-Graphen gehört zur
   * Oberfläche, die die Datei kennt - hier geht es nur darum, die Spur in
   * denselben Strom zu legen wie das Bild.
   */
  readonly audioTrack?: MediaStreamTrack
  /**
   * Läuft, sobald der Recorder aufzeichnet.
   *
   * Der Ton muss genau dann anfangen und nicht davor: alles, was vor
   * `recorder.start()` erklingt, fehlt am Anfang der Aufnahme.
   */
  readonly onStart?: () => void
}

export interface Recording {
  readonly blob: Blob
  readonly format: RecordingFormat
}

interface FrameTrack extends MediaStreamTrack {
  requestFrame(): void
}

export async function recordCanvas(
  canvas: HTMLCanvasElement,
  options: RecordOptions,
): Promise<Recording> {
  const format = pickRecordingFormat(options.audioTrack !== undefined)
  if (!format) throw new Error('Dieser Browser kann keine Videos aufnehmen.')

  // Im Hintergrund-Tab liefen die Timer mit ~1 s: eine Diashow statt Video.
  if (document.hidden) throw new TabHiddenError()

  // Schriften müssen geladen sein, bevor das erste Bild entsteht - sonst
  // zeichnet Canvas stillschweigend die Ersatzschrift.
  if (document.fonts?.ready) await document.fonts.ready

  // captureStream(0) liefert einen Track, der NUR auf requestFrame() ein Bild
  // abgibt. Damit hängt die Bildfolge an unserer Schleife und nicht daran, wie
  // schnell der Rechner zeichnet.
  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as FrameTrack
  if (options.audioTrack) stream.addTrack(options.audioTrack)
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 8_000_000,
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const beendet = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error('Die Aufnahme ist fehlgeschlagen.'))
  })

  // Ein Abbruch (Nutzer oder Tab im Hintergrund) läuft über einen eigenen
  // Controller, damit beide Ursachen denselben Weg nehmen.
  const intern = new AbortController()
  let hiddenAbbruch = false
  const vonAussen = () => intern.abort()
  if (options.signal?.aborted) intern.abort()
  options.signal?.addEventListener('abort', vonAussen, { once: true })
  const sichtbarkeit = () => {
    if (document.hidden) {
      hiddenAbbruch = true
      intern.abort()
    }
  }
  document.addEventListener('visibilitychange', sichtbarkeit)

  recorder.start()
  try {
    options.onStart?.()
    await paceFrames({
      frameCount: options.frameCount,
      intervalMs: 1000 / options.fps,
      signal: intern.signal,
      onFrame: (i) => {
        options.draw(i)
        track.requestFrame()
        options.onProgress?.(i + 1, options.frameCount)
      },
    })
  } catch (e) {
    if (hiddenAbbruch) throw new TabHiddenError()
    throw e
  } finally {
    document.removeEventListener('visibilitychange', sichtbarkeit)
    options.signal?.removeEventListener('abort', vonAussen)
    if (recorder.state !== 'inactive') recorder.stop()
    track.stop()
    // Auch beim Abbruch auf das Ende warten, damit der Recorder wirklich frei ist.
    await beendet.catch(() => undefined)
  }

  await beendet
  return { blob: new Blob(chunks, { type: format.mimeType }), format }
}
