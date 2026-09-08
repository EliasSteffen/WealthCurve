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
  { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
]

export function pickRecordingFormat(): RecordingFormat | null {
  if (typeof MediaRecorder === 'undefined') return null
  return KANDIDATEN.find((k) => MediaRecorder.isTypeSupported(k.mimeType)) ?? null
}

export interface RecordOptions {
  readonly frameCount: number
  readonly fps: number
  readonly draw: (index: number) => void
  readonly onProgress?: (done: number, total: number) => void
  readonly signal?: AbortSignal
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
  const format = pickRecordingFormat()
  if (!format) throw new Error('Dieser Browser kann keine Videos aufnehmen.')

  // Schriften müssen geladen sein, bevor das erste Bild entsteht - sonst
  // zeichnet Canvas stillschweigend die Ersatzschrift.
  if (document.fonts?.ready) await document.fonts.ready

  // captureStream(0) liefert einen Track, der NUR auf requestFrame() ein Bild
  // abgibt. Damit hängt die Bildfolge an unserer Schleife und nicht daran, wie
  // schnell der Rechner zeichnet.
  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as FrameTrack
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

  recorder.start()
  const abstand = 1000 / options.fps

  try {
    for (let i = 0; i < options.frameCount; i += 1) {
      if (options.signal?.aborted) break
      options.draw(i)
      track.requestFrame()
      // Zeitstempel kommen von der Uhr, nicht vom Zähler - die Aufnahme läuft
      // deshalb in Echtzeit ab.
      await new Promise((resolve) => setTimeout(resolve, abstand))
      options.onProgress?.(i + 1, options.frameCount)
    }
  } finally {
    recorder.stop()
    track.stop()
  }

  await beendet
  return { blob: new Blob(chunks, { type: format.mimeType }), format }
}
