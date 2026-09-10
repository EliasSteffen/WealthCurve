import { sceneFrames, type AnimationSpec } from '../core/animation'
import { resolveText } from './canvas/drawFrame'

/**
 * Die Szenentexte als Untertiteldatei zum Video.
 *
 * Im Bild stehen sie ohnehin - hier geht es um das, was das Bild nicht leisten
 * kann: Instagram, TikTok und YouTube nehmen eine Untertiteldatei entgegen und
 * machen den Text damit durchsuchbar, übersetzbar und für Menschen lesbar, die
 * ihn nicht sehen können.
 *
 * SRT und nicht WebVTT, weil die Plattformen durchweg SRT annehmen und WebVTT
 * nur teilweise. Der Unterschied wären ein Punkt statt des Kommas und ein
 * Kopfzeilenwort - für eine zweite Fassung kein großer Schritt.
 */

/** `01:23:45,678` - Stunden zweistellig, Millisekunden dreistellig. */
export function srtZeit(sekunden: number): string {
  const gesamt = Math.max(0, Math.round(sekunden * 1000))
  const ms = gesamt % 1000
  const s = Math.floor(gesamt / 1000) % 60
  const m = Math.floor(gesamt / 60_000) % 60
  const h = Math.floor(gesamt / 3_600_000)
  const p = (wert: number, stellen = 2) => String(wert).padStart(stellen, '0')
  return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}`
}

/**
 * Baut die Datei aus dem Bauplan.
 *
 * Die Zeiten kommen aus `sceneFrames` und nicht aus den Sekunden der Szenen:
 * die Bildzahl wird gerundet, und eine Szene mit 2,51 s bei 30 Bildern dauert
 * tatsächlich 75 Bilder, also 2,5 s. Eine Untertitelspur, die um Bruchteile
 * gegen das Bild verschoben ist, fällt genau dann auf, wenn es darauf ankommt.
 *
 * Leere Szenen und solche ohne Text fallen weg - ein Untertitel ohne Inhalt
 * ist im Abspielgerät ein leerer Kasten.
 */
export function toSrt(spec: AnimationSpec, facts: Readonly<Record<string, string>>): string {
  const bilder = sceneFrames(spec)
  const bloecke: string[] = []
  let start = 0

  spec.scenes.forEach((scene, i) => {
    const dauer = bilder[i] / spec.fps
    const text = resolveText(scene.text, facts).trim()
    if (dauer > 0 && text) {
      bloecke.push(
        [String(bloecke.length + 1), `${srtZeit(start)} --> ${srtZeit(start + dauer)}`, text, ''].join(
          '\n',
        ),
      )
    }
    start += dauer
  })

  return bloecke.join('\n')
}
