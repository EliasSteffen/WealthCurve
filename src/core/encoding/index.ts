import { colorByScenario } from './colorByScenario.ts'
import { colorBySeries } from './colorBySeries.ts'
import type { EncodingInput, EncodingStrategy } from './types.ts'

/** Registry - eine neue Kodierung ist eine Datei plus eine Zeile hier. */
export const ENCODINGS: readonly EncodingStrategy[] = [colorBySeries, colorByScenario]

export const AUTO_ENCODING = 'auto'

/**
 * Bei einem Szenario muss die Farbe die Serie tragen - sonst wäre alles
 * gleichfarbig. Ab zwei Szenarien ist das Szenario die wichtigere Dimension.
 */
export function resolveEncoding(preference: string, input: EncodingInput): EncodingStrategy {
  if (preference !== AUTO_ENCODING) {
    const explicit = ENCODINGS.find((e) => e.id === preference)
    if (explicit) return explicit
  }
  return input.scenarioCount > 1 ? colorByScenario : colorBySeries
}

export { colorByScenario, colorBySeries }
export * from './types.ts'
