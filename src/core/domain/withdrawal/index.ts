import { fixedAmount } from './fixedAmount'
import { percentRule } from './percentRule'
import type { WithdrawalStrategy } from './types'

/** Registry - eine neue Entnahmeregel ist eine Datei plus eine Zeile hier. */
export const WITHDRAWAL_STRATEGIES: readonly WithdrawalStrategy[] = [percentRule, fixedAmount]

export const DEFAULT_WITHDRAWAL_STRATEGY_ID = percentRule.id

export function resolveWithdrawalStrategy(id: string): WithdrawalStrategy {
  return WITHDRAWAL_STRATEGIES.find((s) => s.id === id) ?? percentRule
}

export type { WithdrawalStrategy } from './types'
export { defineWithdrawal } from './types'
