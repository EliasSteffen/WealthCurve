const CORE_VERSION = '0.12.10'
/*
 * Bewusst der ESM-Core, nicht der UMD-Core.
 *
 * @ffmpeg/ffmpeg erzeugt seinen Worker immer als Modul-Worker. Dort gibt es
 * kein importScripts, also faellt der Worker auf ein dynamisches import()
 * zurueck - und das kann nur ein ES-Modul laden. Mit dem UMD-Core scheitert es
 * mit "failed to import ffmpeg-core.js".
 */
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`

export interface TranscodeOptions {
  readonly onProgress?: (anteil: number) => void
  readonly signal?: AbortSignal
}

export async function transcodeToMp4(webm: Blob, options: TranscodeOptions = {}): Promise<Blob> {
  // Dynamisch, damit der Hauptbundle unberührt bleibt.
  const [{ FFmpeg }, { fetchFile }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ])

  const ffmpeg = new FFmpeg()
  ffmpeg.on('progress', ({ progress }) => {
    options.onProgress?.(Math.min(1, Math.max(0, progress)))
  })

  // Einkern-Variante: die Mehrkern-Variante bräuchte SharedArrayBuffer und
  // damit COOP/COEP-Header, die eine statisch ausgelieferte App nicht setzt.
  // Echte URLs statt Blob-URLs: der Core loest den Pfad zur .wasm relativ zu
  // seiner eigenen Adresse auf, und eine Blob-URL hat keinen Pfad.
  await ffmpeg.load({
    coreURL: `${CORE_BASE}/ffmpeg-core.js`,
    wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
  })

  if (options.signal?.aborted) throw new Error('Abgebrochen')

  await ffmpeg.writeFile('eingabe.webm', await fetchFile(webm))
  await ffmpeg.exec([
    '-i', 'eingabe.webm',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '22',
    // Ohne yuv420p spielen iOS und viele Player die Datei nicht ab.
    '-pix_fmt', 'yuv420p',
    // H.264 braucht gerade Kantenlängen.
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-movflags', '+faststart',
    'ausgabe.mp4',
  ])

  const daten = await ffmpeg.readFile('ausgabe.mp4')
  ffmpeg.terminate()
  // readFile kann laut Typen auch string liefern; hier ist es immer binaer.
  const bytes = daten as Uint8Array
  // Kopie in einen echten ArrayBuffer - der Typ von readFile laesst
  // SharedArrayBuffer zu, den Blob nicht akzeptiert.
  const puffer = new Uint8Array(bytes.byteLength)
  puffer.set(bytes)
  return new Blob([puffer], { type: 'video/mp4' })
}
