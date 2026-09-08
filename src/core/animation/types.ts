export interface VideoFormat {
  readonly id: string
  readonly label: string
  readonly width: number
  readonly height: number
}

/**
 * Die drei Abschnitte eines Reels.
 *
 * `hook` hält das Diagramm bei null und stellt die Frage, `build` zeichnet die
 * Kurve auf, `punchline` steht still und nennt das Ergebnis. Nur `build`
 * bewegt die Kurve - dadurch bleibt die Aussage am Anfang und am Ende stehen.
 */
export type SceneKind = 'hook' | 'build' | 'punchline'

export interface Scene {
  readonly kind: SceneKind
  /** Dauer in Sekunden; 0 überspringt den Abschnitt. */
  readonly seconds: number
  /** Text mit Platzhaltern wie {{endkapital}}; leer blendet ihn aus. */
  readonly text: string
}

export interface AnimationSpec {
  readonly formatId: string
  readonly fps: number
  readonly scenes: readonly Scene[]
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
  /** 0..1 über den Aufbau, nach Easing. */
  readonly progress: number
  /** Fließkomma-Jahr, bis zu dem gezeichnet wird - z. B. 12,4. */
  readonly visibleYears: number
  /** Aktueller Wert je Linien-Key; null, wo die Linie noch nicht läuft. */
  readonly values: Readonly<Record<string, number | null>>
  /** Ganzes Jahr für die Beschriftung. */
  readonly year: number
  readonly scene: {
    readonly kind: SceneKind
    /** Vorlage mit Platzhaltern - aufgelöst wird erst beim Zeichnen. */
    readonly text: string
    /** 0..1 innerhalb des Abschnitts, für Ein- und Ausblenden. */
    readonly progress: number
  }
}
