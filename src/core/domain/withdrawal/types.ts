import type { ParamId, SimulationParams } from '../parameters.ts'

/**
 * Wie hoch die monatliche Entnahme ausfällt.
 *
 * Gleiches Muster wie das Series-Registry: eine neue Regel ist eine Datei plus
 * eine Zeile in `index.ts`.
 */
export interface WithdrawalStrategy {
  readonly id: string
  readonly label: string
  readonly description: string
  /** Steuert, welche Regler im Entnahme-Panel hervorgehoben werden. */
  readonly requiredParams: readonly ParamId[]
  monthlyAmount(input: {
    readonly params: SimulationParams
    /** Depotwert am Ende der Ansparphase. */
    readonly capitalAtRetirement: number
  }): number
}

export const defineWithdrawal = <const T extends WithdrawalStrategy>(s: T): T => s
