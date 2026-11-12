import { SLOT_COUNT, colorFallback, slotFromVar } from '../../core/palette'
import type { ProjectionLine } from '../../core/projection'
import type { RenderTheme } from './drawFrame'

/**
 * Die beiden Farbschemata als feste Werte.
 *
 * Der Renderer liest die Farben sonst aus dem DOM - das geht nur im Browser und
 * nur für das gerade eingestellte Thema. Beides ist hier zu wenig: der
 * MCP-Server hat kein DOM, und wer bei Tageslicht arbeitet, will trotzdem ein
 * dunkles Reel aufnehmen können.
 *
 * Die Werte sind Kopien aus index.css. Eine Kopie ist eine Schuld, deshalb
 * vergleicht ein Test sie mit der Quelle, statt auf Sorgfalt zu hoffen.
 */
export type ThemeName = 'light' | 'dark'

export const RENDER_THEMES: Record<ThemeName, RenderTheme> = {
  light: {
    surface: '#ffffff',
    text: '#131722',
    textMuted: '#6a6d78',
    grid: '#e0e3eb',
    axis: '#c3c6ce',
  },
  dark: {
    surface: '#131722',
    text: '#d1d4dc',
    textMuted: '#868993',
    grid: '#1f2431',
    axis: '#363a45',
  },
}

/** Die acht Palettenfarben je Thema, in der Reihenfolge der Slots. */
export const CHART_SLOT_COLORS: Record<ThemeName, readonly string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

/**
 * Linienfarben für ein festes Thema, ohne DOM.
 *
 * Fällt auf den Ersatzwert der Variablen zurück, wenn keine Slot-Nummer darin
 * steckt - eine Linie ohne erkennbaren Slot soll ihre Farbe behalten und nicht
 * grau werden.
 */
export function themeLineColors(
  lines: readonly ProjectionLine[],
  theme: ThemeName,
): Record<string, string> {
  const farben = CHART_SLOT_COLORS[theme]
  return Object.fromEntries(
    lines.map((line) => {
      const slot = slotFromVar(line.colorVar)
      if (slot === null) return [line.key, colorFallback(line.colorVar)]
      const index = (((slot - 1) % SLOT_COUNT) + SLOT_COUNT) % SLOT_COUNT
      return [line.key, farben[index] ?? colorFallback(line.colorVar)]
    }),
  )
}
