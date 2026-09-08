/**
 * Deterministischer Pseudo-Zufall aus Koordinaten.
 *
 * Der entscheidende Punkt am gezeichneten Stil: mit Math.random() bekäme
 * dieselbe Kurve bei jedem Render einen neuen Versatz und würde beim Ziehen
 * eines Reglers sichtbar flimmern - im Video sogar bei jedem Einzelbild. So
 * hängt der Ausschlag nur von der Position ab.
 *
 * Liegt bewusst getrennt, damit SVG- und Canvas-Renderer denselben Versatz
 * berechnen und ein Stil in beiden gleich aussieht.
 */
export function wobble(x: number, y: number, salt: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}
