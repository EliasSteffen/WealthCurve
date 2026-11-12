import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts'

/** Das Zeichenziel, ohne `fancy-canvas` selbst als Abhängigkeit zu führen. */
type Ziel = Parameters<IPrimitivePaneRenderer['draw']>[0]

export interface PhaseBandOptions {
  /** Wo die Entnahme beginnt. */
  readonly time: Time
  readonly lineColor: string
  readonly fillColor: string
  readonly textColor: string
  readonly axisBackColor: string
  readonly axisTextColor: string
  /** Beschriftung links und rechts der Linie; leer bleibt die Seite frei. */
  readonly leftLabel: string
  readonly rightLabel: string
  /** Text der Marke auf der Zeitachse. */
  readonly axisLabel: string
  readonly font: string
}

class BandRenderer implements IPrimitivePaneRenderer {
  private readonly x: number | null
  private readonly options: PhaseBandOptions

  constructor(x: number | null, options: PhaseBandOptions) {
    this.x = x
    this.options = options
  }

  draw(target: Ziel): void {
    const { x, options } = this
    if (x === null) return
    target.useBitmapCoordinateSpace(({ context, bitmapSize, horizontalPixelRatio }) => {
      const px = Math.round(x * horizontalPixelRatio)
      // Die Entnahmephase als Fläche, die Grenze als scharfe Linie darüber.
      context.fillStyle = options.fillColor
      context.fillRect(px, 0, Math.max(0, bitmapSize.width - px), bitmapSize.height)
      context.fillStyle = options.lineColor
      const breite = Math.max(1, Math.floor(horizontalPixelRatio))
      context.fillRect(px - Math.floor(breite / 2), 0, breite, bitmapSize.height)
    })
    target.useMediaCoordinateSpace(({ context }) => {
      context.font = `600 10px ${options.font}`
      context.fillStyle = options.textColor
      context.textBaseline = 'top'
      if (options.leftLabel) {
        context.textAlign = 'right'
        context.fillText(options.leftLabel.toUpperCase(), x - 6, 8)
      }
      if (options.rightLabel) {
        // Liegt die Grenze links außerhalb, gehört die ganze Fläche zur rechten Phase.
        context.textAlign = 'left'
        context.fillText(options.rightLabel.toUpperCase(), Math.max(x, 0) + 6, 8)
      }
    })
  }
}

class BandView implements IPrimitivePaneView {
  private readonly band: PhaseBand

  constructor(band: PhaseBand) {
    this.band = band
  }

  zOrder(): PrimitivePaneViewZOrder {
    // Unter den Kurven: die Fläche färbt den Grund, nicht die Linien.
    return 'bottom'
  }
  renderer(): IPrimitivePaneRenderer {
    return new BandRenderer(this.band.x, this.band.options)
  }
}

class BandAxisView implements ISeriesPrimitiveAxisView {
  private readonly band: PhaseBand

  constructor(band: PhaseBand) {
    this.band = band
  }

  coordinate(): number {
    return this.band.x ?? -100
  }
  text(): string {
    return this.band.options.axisLabel
  }
  textColor(): string {
    return this.band.options.axisTextColor
  }
  backColor(): string {
    return this.band.options.axisBackColor
  }
  visible(): boolean {
    // Außerhalb des sichtbaren Bereichs klemmte der Chart die Marke an den Rand - als stünde die Grenze dort.
    const { x, width } = this.band
    return x !== null && x >= 0 && x <= width
  }
}

/**
 * Grenze zwischen Ansparen und Entnehmen - als Linie, Fläche und Marke auf der
 * Zeitachse.
 *
 * `lightweight-charts` hat keine senkrechten Linien; ein Primitive zeichnet sie
 * direkt in den Canvas der Fläche. Bei jedem Zoomen und Scrollen fragt der
 * Chart `updateAllViews`, und die Koordinate wird neu bestimmt.
 */
export class PhaseBand implements ISeriesPrimitive<Time> {
  x: number | null = null
  /** Breite der Zeitachse beim letzten Update. */
  width = 0
  options: PhaseBandOptions
  private chart: IChartApi | null = null
  private requestUpdate: (() => void) | null = null
  private readonly pane = [new BandView(this)]
  private readonly axis = [new BandAxisView(this)]

  constructor(options: PhaseBandOptions) {
    this.options = options
  }

  attached({ chart, requestUpdate }: SeriesAttachedParameter<Time>): void {
    this.chart = chart as IChartApi
    this.requestUpdate = requestUpdate
  }

  detached(): void {
    this.chart = null
    this.requestUpdate = null
  }

  setOptions(options: PhaseBandOptions): void {
    this.options = options
    this.requestUpdate?.()
  }

  updateAllViews(): void {
    const zeitachse = this.chart?.timeScale()
    const x = zeitachse?.timeToCoordinate(this.options.time)
    this.x = x === null || x === undefined ? null : x
    this.width = zeitachse?.width() ?? 0
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.pane
  }

  timeAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this.axis
  }
}
