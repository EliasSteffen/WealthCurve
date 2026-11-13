/** Skala der Preisachse: linear, logarithmisch oder prozentual zum ersten sichtbaren Wert. */
export type ScaleMode = 'linear' | 'log' | 'percent'

/** Was die Werkzeugleiste mit einem Chart tun kann, ohne seine Innereien zu kennen. */
export interface ChartHandle {
  /** Der Chart als Bild, samt Legende und Marken; null, solange er nicht steht. */
  screenshot(): HTMLCanvasElement | null
  /** Zoom zurücksetzen: alles zeigen, Preisachse wieder automatisch. */
  fit(): void
}
