import { currentFormatterLocale, formatEur, formatEurCompact, formatPercent } from '../../lib/format'

/*
 * Zahlen im Terminal: kurz, aber nie ungenau dort, wo es nichts kostet.
 */

/** Echtes Minuszeichen statt Bindestrich - in Tabellenziffern gleich breit wie das Plus. */
const vorzeichen = (wert: number) => (wert > 0 ? '+' : wert < 0 ? '−' : '±')

/**
 * Unter einer Million ganz, darüber kompakt: „468.246 €", „1,9 Mio. €".
 *
 * Deutsches Compact kürzt Tausender nicht ab und hängt dann eine Nachkommastelle
 * an („468.245,6 €") - auf einer Achse und in einer Liste reines Rauschen.
 */
export const shortEur = (wert: number) => (Math.abs(wert) < 1e6 ? formatEur(wert) : formatEurCompact(wert))

export const signedEur = (wert: number) => `${vorzeichen(wert)}${formatEur(Math.abs(wert))}`
export const signedShortEur = (wert: number) => `${vorzeichen(wert)}${shortEur(Math.abs(wert))}`
/** Erwartet einen Anteil: 0.25 ergibt „+25 %". */
export const signedPercent = (anteil: number) => `${vorzeichen(anteil)}${formatPercent(Math.abs(anteil * 100))}`
export const tone = (wert: number): 'up' | 'down' | undefined => (wert > 0 ? 'up' : wert < 0 ? 'down' : undefined)

/** Dezimalzahl in der Sprache der Oberfläche: 10.2 wird „10,2". */
export const formatDecimal = (wert: number, stellen = 1) =>
  new Intl.NumberFormat(currentFormatterLocale(), { maximumFractionDigits: stellen }).format(wert)
