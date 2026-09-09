import type { Projection } from './projection'

/**
 * CSV-Export einer Projektion.
 *
 * Bewusst eine freie Funktion statt einer Methode auf `Projection`: das
 * Projektionsobjekt bleibt damit reines JSON und übersteht
 * `JSON.stringify` - Voraussetzung dafür, es über eine Prozessgrenze zu
 * schicken (Node-Skript, späterer MCP-Server).
 *
 * Semikolon als Trenner und Komma als Dezimalzeichen: so öffnet Excel in
 * deutscher Einstellung die Datei ohne Nachfrage.
 */
export function projectionToCsv(projection: Projection): string {
  const escape = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  const number = (value: number) => value.toFixed(2).replace('.', ',')

  const header = ['Jahr', ...projection.lines.map((line) => line.label)]
  const body = projection.rows.map((row) => [
    // Dieselbe Beschriftung wie Chart und Tabelle - ein Export, der andere
    // Jahre nennt als der Bildschirm, ist schlimmer als gar keiner.
    projection.yearLabels[row.year] ?? String(row.year),
    ...projection.lines.map((line) => {
      const value = row[line.key]
      return typeof value === 'number' ? number(value) : ''
    }),
  ])

  return [header, ...body].map((cells) => cells.map(escape).join(';')).join('\n')
}
