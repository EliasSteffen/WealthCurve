export interface VideoFormat {
  readonly id: string
  readonly label: string
  readonly width: number
  readonly height: number
}

export interface AnimationSpec {
  readonly formatId: string
  /** Dauer des Aufbaus in Sekunden. */
  readonly durationSeconds: number
  /** Standbild am Ende, damit das Ergebnis lesbar bleibt. */
  readonly holdSeconds: number
  readonly fps: number
}

/**
 * Was zu einem Bild sichtbar ist - rein berechnet, ohne Canvas und ohne DOM.
 *
 * Die Zahlen zählen mit, weil `values` am Zwischenjahr interpoliert wird und
 * nicht, weil ein zweiter Zähler mitläuft. Eine Quelle, also keine Abweichung
 * zwischen Kurve und angezeigtem Wert.
 */
export interface FrameState {
  readonly index: number
  /** 0..1 nach Easing. */
  readonly progress: number
  /** Fließkomma-Jahr, bis zu dem gezeichnet wird - z. B. 12,4. */
  readonly visibleYears: number
  /** Aktueller Wert je Linien-Key; null, wo die Linie noch nicht läuft. */
  readonly values: Readonly<Record<string, number | null>>
  /** Ganzes Jahr für die Beschriftung. */
  readonly year: number
}
