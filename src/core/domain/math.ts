import type {
  Compounding,
  ModelSettings,
  Phase,
  SimulationConfig,
  SimulationResult,
  YearSnapshot,
} from './types'
import { DEFAULT_WITHDRAWAL_STRATEGY_ID, resolveWithdrawalStrategy } from './withdrawal'

export const MONTHS_PER_YEAR = 12

export const DEFAULT_MODEL: ModelSettings = {
  compounding: 'monthly-effective',
  timing: 'end',
  accumulationYears: 30,
  withdrawalYears: 25,
  withdrawalStrategyId: DEFAULT_WITHDRAWAL_STRATEGY_ID,
}

const finite = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback)
const wholeYears = (value: number): number => Math.max(0, Math.floor(finite(value)))

/**
 * Jahreszins (in Prozentpunkten) -> Zins pro Periode.
 *
 * 'monthly-effective': zwölf Perioden ergeben exakt den Jahreszins. Das ist die
 *   Konvention hinter jeder ausgewiesenen ETF-Rendite und deshalb der Default.
 * 'monthly-nominal':   r/12. Bankkonvention - ergibt einen HÖHEREN effektiven
 *   Jahreszins als eingegeben. Die meisten Online-Rechner rechnen so.
 * 'annual':            eine Periode pro Jahr, der Aufrufer schaltet entsprechend um.
 */
export function toMonthlyRate(annualRatePercent: number, mode: Compounding): number {
  const r = finite(annualRatePercent) / 100
  // Ab -100 % ist das Kapital vollständig weg; log1p(-1) wäre -Infinity.
  if (r <= -1) return mode === 'annual' ? -1 : -1 / MONTHS_PER_YEAR
  if (mode === 'annual') return r
  if (mode === 'monthly-nominal') return r / MONTHS_PER_YEAR
  // expm1/log1p statt (1+r)**(1/12)-1: genauer für kleine r, exakt 0 bei r = 0.
  return Math.expm1(Math.log1p(r) / MONTHS_PER_YEAR)
}

/** Baut die Phasenfolge aus Zeitachse und den beiden Monatsbeträgen. */
export function buildPhases(
  model: ModelSettings,
  monthlyContribution: number,
  monthlyWithdrawal: number,
): readonly Phase[] {
  const phases: Phase[] = []
  const accumulate = wholeYears(model.accumulationYears)
  const withdraw = wholeYears(model.withdrawalYears)
  if (accumulate > 0) {
    phases.push({
      kind: 'accumulate',
      months: accumulate * MONTHS_PER_YEAR,
      monthlyAmount: Math.max(0, finite(monthlyContribution)),
    })
  }
  if (withdraw > 0) {
    phases.push({
      kind: 'withdraw',
      months: withdraw * MONTHS_PER_YEAR,
      monthlyAmount: Math.max(0, finite(monthlyWithdrawal)),
    })
  }
  return phases
}

interface RunState {
  balance: number
  contributions: number
  withdrawals: number
  depletedAtYear: number | null
}

/**
 * Rechnet eine Phase Jahr für Jahr durch und hängt die Schnappschüsse an.
 *
 * Bei jährlicher Verzinsung wird pro Jahr ein Schritt mit dem Zwölffachen des
 * Monatsbetrags gerechnet - die Raten sammeln sich unverzinst bis zum Jahresende.
 */
function runPhase(
  phase: Phase,
  state: RunState,
  model: ModelSettings,
  growth: number,
  startYear: number,
  out: YearSnapshot[],
): number {
  const yearly = model.compounding === 'annual'
  const stepsPerYear = yearly ? 1 : MONTHS_PER_YEAR
  const amount = phase.monthlyAmount * (yearly ? MONTHS_PER_YEAR : 1)
  const years = Math.round(phase.months / MONTHS_PER_YEAR)

  for (let i = 1; i <= years; i += 1) {
    const year = startYear + i
    for (let step = 0; step < stepsPerYear; step += 1) {
      if (phase.kind === 'accumulate') {
        if (model.timing === 'start') state.balance += amount
        state.balance *= growth
        if (model.timing === 'end') state.balance += amount
        state.contributions += amount
      } else {
        state.balance *= growth
        // Niemals mehr entnehmen als da ist - das Depot darf nicht ins Minus.
        const taken = Math.min(amount, Math.max(0, state.balance))
        state.balance -= taken
        state.withdrawals += taken
        // "Aufgebraucht" heißt: die gewünschte Entnahme konnte nicht mehr voll
        // bedient werden. Ein Bestand von 0 allein reicht nicht - der liegt auch
        // vor, wenn nie etwas eingezahlt und nie etwas entnommen wurde.
        if (taken < amount - 1e-9 && state.depletedAtYear === null) {
          state.depletedAtYear = year
        }
      }
    }
    out.push({
      year,
      balance: state.balance,
      contributions: state.contributions,
      withdrawals: state.withdrawals,
      interest: state.balance - state.contributions + state.withdrawals,
      phase: phase.kind,
    })
  }
  return startYear + years
}

/**
 * Simulation über die Phasenfolge, mit Jahres-Schnappschüssen.
 *
 * Zwei Durchgänge sind nötig, weil die Prozentregel den Depotwert bei
 * Rentenbeginn als Bezugsgröße braucht: erst ansparen, dann die Strategie nach
 * dem Monatsbetrag fragen, dann entnehmen.
 *
 * Bewusst iterativ statt geschlossene Rentenformel: die Schleife bildet alle
 * drei Zinsmodi, beide Zahlungszeitpunkte und die Entnahmephase ohne
 * Fallunterscheidung ab und bleibt bei Zins 0 exakt.
 */
export function simulate(config: SimulationConfig): SimulationResult {
  const { model } = config
  const growth = 1 + toMonthlyRate(config.annualRatePercent, model.compounding)

  const state: RunState = {
    balance: finite(config.initialCapital),
    contributions: finite(config.initialCapital),
    withdrawals: 0,
    depletedAtYear: null,
  }

  const years: YearSnapshot[] = [
    {
      year: 0,
      balance: state.balance,
      contributions: state.contributions,
      withdrawals: 0,
      interest: 0,
      phase: 'accumulate',
    },
  ]

  // Durchgang 1: ansparen.
  const [accumulation] = buildPhases(model, config.monthlyContribution, 0)
  let year = 0
  if (accumulation?.kind === 'accumulate') {
    year = runPhase(accumulation, state, model, growth, year, years)
  }
  const capitalAtRetirement = state.balance

  // Durchgang 2: Betrag aus der Strategie holen, dann entnehmen.
  const strategy = resolveWithdrawalStrategy(model.withdrawalStrategyId)
  const monthlyWithdrawal = Math.max(
    0,
    finite(strategy.monthlyAmount({ params: config.params, capitalAtRetirement })),
  )
  const withdrawal = buildPhases(model, 0, monthlyWithdrawal).find((p) => p.kind === 'withdraw')
  if (withdrawal) {
    runPhase(withdrawal, state, model, growth, year, years)
  }

  return {
    years,
    capitalAtRetirement,
    monthlyWithdrawal,
    depletedAtYear: state.depletedAtYear,
  }
}

/** @deprecated Alter Name; `simulate` bildet jetzt beide Phasen ab. */
export const simulateMonthly = simulate
