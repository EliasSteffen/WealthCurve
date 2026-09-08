/**
 * Farb-Slots der Palette.
 *
 * Die acht Slots sind mit dem dataviz-Validator in beiden Modi geprüft
 * (schlechtestes Nachbarpaar CVD ΔE 9.1 hell / 8.4 dunkel, Normalsicht
 * 19.6 / 19.3). Ein neunter Farbton wäre unter Farbfehlsichtigkeit nicht mehr
 * von einem vorhandenen zu trennen - deshalb ist acht eine harte Grenze und
 * keine Geschmacksfrage.
 */
export const SLOT_COUNT = 8

export type ColorSlot = number

/** CSS-Variable mit Fallback-Hex, direkt als SVG-stroke verwendbar. */
const FALLBACKS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
] as const

export function slotVar(slot: ColorSlot): string {
  const index = ((slot - 1) % SLOT_COUNT + SLOT_COUNT) % SLOT_COUNT
  return `var(--chart-${index + 1}, ${FALLBACKS[index]})`
}

/**
 * Niedrigster freier Slot.
 *
 * Slots werden vergeben und festgehalten, nie aus dem Array-Index abgeleitet -
 * sonst färbt sich beim Löschen eines Szenarios alles darunter um, und wer
 * "Aggressiv ist orange" gelernt hat, wird in die Irre geführt.
 */
export function allocateSlot(used: Iterable<ColorSlot>): ColorSlot | null {
  const taken = new Set(used)
  for (let slot = 1; slot <= SLOT_COUNT; slot += 1) {
    if (!taken.has(slot)) return slot
  }
  return null
}
