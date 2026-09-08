/**
 * Das Aussehen eines Diagramms als reine Daten.
 *
 * Bewusst KEINE Recharts-Props: dasselbe Stilobjekt liest auch der
 * Canvas-Renderer für den Video-Export. Wäre der Stil an Recharts gebunden,
 * müsste jeder Look zweimal gebaut und zweimal gepflegt werden.
 */
export interface ChartStyle {
  readonly id: string
  readonly label: string
  readonly description: string

  readonly line: {
    readonly width: number
    readonly cap: 'round' | 'butt'
    readonly curve: 'monotone' | 'linear'
    /** Wackel-Amplitude in Pixeln; 0 = gerade Linie. */
    readonly jitter: number
  }

  /** Deckkraft der Fläche unter der Kurve; 0 = keine Fläche. */
  readonly area: { readonly opacity: number }

  readonly grid: {
    readonly show: boolean
    /** SVG stroke-dasharray; null = durchgezogen. */
    readonly dash: string | null
  }

  readonly axis: {
    readonly show: boolean
    readonly tickLine: boolean
    readonly fontSize: number
  }

  readonly labels: {
    readonly fontSize: number
    /**
     * 'primary' beschriftet nur die Hauptkurve, 'none' gar keine.
     * Alle Kurven zu beschriften bräuchte eine Kollisionsauflösung und ist
     * deshalb bewusst nicht vorgesehen - die Legende trägt die übrigen Werte.
     */
    readonly endLabels: 'primary' | 'none'
  }

  /** CSS-Schriftfamilie; null = die der Anwendung. */
  readonly fontFamily: string | null
}

export const defineChartStyle = (style: ChartStyle): ChartStyle => style
