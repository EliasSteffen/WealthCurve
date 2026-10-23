import { slotVar } from '../palette.ts'
import { dashFor, defineEncoding, reportCapacity } from './types.ts'

/**
 * Farbe trägt das Szenario, der Linienstil die Serie.
 *
 * Sobald mehrere Szenarien verglichen werden, ist das Szenario die Dimension,
 * die der Leser auseinanderhalten muss - und Farbe ist der stärkste Kanal
 * dafür. Der Strich reicht für die wenigen Serien daneben.
 */
export const colorByScenario = defineEncoding({
  id: 'colorByScenario',
  label: 'Farbe = Szenario',
  describe: (input) =>
    input.seriesCount > 1 ? 'Farbe = Szenario · Strich = Serie' : 'Farbe = Szenario',
  style: (line, input) => ({
    colorVar: slotVar(line.scenarioColorSlot),
    dash: input.seriesCount > 1 ? dashFor(line.seriesIndex) : undefined,
    opacity: 1,
  }),
  capacity: reportCapacity,
})
