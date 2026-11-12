import type { Translate } from '../i18n'

/**
 * Die deutsche Ausgabe als `Translate`.
 *
 * Der Renderer läuft auch im MCP-Server und in Tests, wo es keine Oberfläche
 * und keinen Katalog gibt. Ohne eigene Übersetzung bleibt der deutsche
 * Originaltext stehen - genau das, was die Bilder vor der Übersetzbarkeit
 * zeigten, sodass bestehende Aufrufer und Snapshots unverändert bleiben.
 */
export const deutsch: Translate = (_key, fallback, vars) => {
  if (!vars) return fallback
  let text = fallback
  for (const [name, wert] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(wert))
  return text
}
