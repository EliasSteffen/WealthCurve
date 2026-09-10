/**
 * Eine Tonspur aus einer lokalen Datei, fertig zum Mitschneiden.
 *
 * Der entscheidende Punkt ist, was hier NICHT passiert: die Quelle wird nicht
 * mit `ctx.destination` verbunden. Sonst liefe die Musik während der ganzen
 * Aufnahme über die Lautsprecher - und die Aufnahme dauert so lange wie das
 * Video.
 *
 * Ein decodierter Puffer statt eines <audio>-Elements, weil er sofort und auf
 * die Millisekunde genau startet. Ein Element müsste erst puffern und unterläge
 * der Autoplay-Regel des Browsers.
 *
 * Die Datei bleibt im Browser: gelesen wird sie über `File.arrayBuffer()`,
 * nichts wird hochgeladen.
 */
export interface Tonspur {
  readonly track: MediaStreamTrack
  /** Sekunden - die Oberfläche vergleicht sie mit der Länge des Videos. */
  readonly seconds: number
  /** Startet die Wiedergabe in den Aufnahmestrom. */
  start(): void
  /** Gibt Spur und AudioContext frei; danach ist das Objekt verbraucht. */
  dispose(): Promise<void>
}

export async function ladeTonspur(datei: File): Promise<Tonspur> {
  const AudioCtx =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) throw new Error('Dieser Browser kann keinen Ton verarbeiten.')

  const ctx = new AudioCtx()
  let puffer: AudioBuffer
  try {
    puffer = await ctx.decodeAudioData(await datei.arrayBuffer())
  } catch {
    await ctx.close()
    // Der Browser meldet nur "EncodingError" - das hilft niemandem weiter.
    throw new Error('Diese Audiodatei lässt sich nicht lesen. MP3, M4A, WAV oder OGG gehen.')
  }

  const ziel = ctx.createMediaStreamDestination()
  const quelle = ctx.createBufferSource()
  quelle.buffer = puffer
  quelle.connect(ziel)

  let gestartet = false
  return {
    track: ziel.stream.getAudioTracks()[0],
    seconds: puffer.duration,
    start() {
      if (gestartet) return
      gestartet = true
      // Ein angehaltener Kontext gibt keine Daten ab - das kommt vor, wenn die
      // Seite ohne Zutun des Nutzers geladen wurde.
      void ctx.resume()
      quelle.start()
    },
    async dispose() {
      try {
        if (gestartet) quelle.stop()
      } catch {
        // Bereits beendet - kein Grund, den Aufrufer damit zu behelligen.
      }
      ziel.stream.getTracks().forEach((t) => t.stop())
      await ctx.close()
    },
  }
}
