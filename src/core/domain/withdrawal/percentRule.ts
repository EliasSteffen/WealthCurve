import { defineWithdrawal } from './types.ts'

/**
 * Prozentregel: ein fester Anteil des Depotwerts bei Rentenbeginn, auf Monate
 * verteilt. Die bekannte 4-%-Faustregel ist der Standardfall.
 *
 * Der Betrag wird EINMAL bei Rentenbeginn festgelegt und bleibt dann konstant -
 * er wandert nicht mit dem schwankenden Depotwert mit.
 */
export const percentRule = defineWithdrawal({
  id: 'percentRule',
  label: 'Prozentregel',
  description: 'Fester Anteil des Depotwerts bei Rentenbeginn (4-%-Regel).',
  requiredParams: ['withdrawalRate'],
  monthlyAmount: ({ params, capitalAtRetirement }) =>
    Math.max(0, (capitalAtRetirement * params.withdrawalRate) / 100 / 12),
})
