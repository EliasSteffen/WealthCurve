import { defineWithdrawal } from './types'

/** Fester Monatsbetrag - unabhängig davon, wie viel angespart wurde. */
export const fixedAmount = defineWithdrawal({
  id: 'fixedAmount',
  label: 'Fester Betrag',
  description: 'Jeden Monat derselbe Betrag, unabhängig vom Depotwert.',
  requiredParams: ['monthlyWithdrawal'],
  monthlyAmount: ({ params }) => Math.max(0, params.monthlyWithdrawal),
})
