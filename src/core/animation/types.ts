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
  /**
   * Ob die Jahreszahl unter der Achse mitläuft.
   *
   * Gehört zum Bauplan des Videos und nicht zum Aufruf des Renderers: sonst
   * sähe der MCP-Server ein anderes Bild als die Vorschau im Browser, obwohl
   * beide denselben Plan bekommen haben.
   *
   * Fehlt der Wert, wird die Zahl gezeigt - das war das Verhalten, bevor es den
   * Schalter gab, und ein gespeicherter alter Plan soll sich nicht ändern.
   */
  readonly showYear?: boolean
  /**
   * Ob die Kopfzeile mit Name und Wert je Szenario erscheint.
   *
   * Aus ergibt ein Video, das nur die Kurve zeigt - brauchbar, wenn die Zahlen
   * im Beitragstext danebenstehen und im Bild nur stören würden.
   */
  readonly showHeader?: boolean
  /** Ob die Legende unter der Achse erscheint. */
  readonly showLegend?: boolean
  /**
   * Das Farbschema des Videos.
   *
   * „app" folgt der Anwendung. Die beiden festen Werte sind der Grund für diese
   * Einstellung: ein dunkles Reel lässt sich sonst nur aufnehmen, indem man die
   * ganze Anwendung umschaltet.
   */
  readonly theme?: 'app' | 'light' | 'dark'
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
