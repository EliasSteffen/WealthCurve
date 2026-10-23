import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimulationParams } from '@/core/domain/parameters'
import { DEFAULT_MODEL, simulate, toMonthlyRate } from '@/core/domain/math'
import type { Compounding, ContributionTiming, SimulationConfig } from '@/core/domain/types'

interface Overrides {
  annualRatePercent?: number
  monthlyContribution?: number
  initialCapital?: number
  params?: Partial<SimulationParams>
  compounding?: Compounding
  timing?: ContributionTiming
  accumulationYears?: number
  withdrawalYears?: number
  withdrawalStrategyId?: string
  amountsInflationAdjusted?: boolean
  monthlyWithdrawalOverride?: number
  rateAt?: (i: number) => number
}

const config = (o: Overrides = {}): SimulationConfig => ({
  annualRatePercent: o.annualRatePercent ?? 7,
  monthlyContribution: o.monthlyContribution ?? 500,
  initialCapital: o.initialCapital ?? 0,
  params: { ...DEFAULT_PARAMS, ...o.params },
  monthlyWithdrawalOverride: o.monthlyWithdrawalOverride,
  rateAt: o.rateAt,
  model: {
    compounding: o.compounding ?? 'monthly-effective',
    timing: o.timing ?? 'end',
    accumulationYears: o.accumulationYears ?? 10,
    // Ohne Entnahmephase gelten die Anker der reinen Ansparrechnung unverändert.
    withdrawalYears: o.withdrawalYears ?? 0,
    withdrawalStrategyId: o.withdrawalStrategyId ?? 'fixedAmount',
    amountsInflationAdjusted: o.amountsInflationAdjusted ?? false,
    // Die Zeitachse ist reine Beschriftung - die Rechnung liest sie nie.
    timeAxis: 'relative',
    startAge: null,
    startYear: null,
    startMonth: 1,
  },
})

const finalBalance = (c: SimulationConfig) => simulate(c).years.at(-1)!.balance

/** Geschlossene Rentenformel - nur als unabhängiges Orakel bei normalen Zinsen. */
const annuity = (payment: number, rate: number, periods: number) =>
  rate === 0 ? payment * periods : payment * ((Math.pow(1 + rate, periods) - 1) / rate)

describe('toMonthlyRate', () => {
  it('liefert bei 0 % exakt 0', () => {
    expect(toMonthlyRate(0, 'monthly-effective')).toBe(0)
    expect(toMonthlyRate(0, 'monthly-nominal')).toBe(0)
  })

  it('trennt effektiv von nominal', () => {
    expect(toMonthlyRate(7, 'monthly-nominal')).toBeCloseTo(0.07 / 12, 12)
    expect(toMonthlyRate(7, 'monthly-effective')).toBeCloseTo(Math.pow(1.07, 1 / 12) - 1, 12)
  })

  it('bleibt bei -100 % und darunter endlich', () => {
    expect(Number.isFinite(toMonthlyRate(-100, 'monthly-effective'))).toBe(true)
    expect(Number.isFinite(toMonthlyRate(-250, 'monthly-effective'))).toBe(true)
  })
})

describe('simulateMonthly', () => {
  it('reproduziert ohne Sparrate exakt die jährliche Verzinsung', () => {
    // Der Modus-Beweis: 12 effektive Monatsschritte MUESSEN 1,07 ergeben.
    // Wäre hier nominal verdrahtet, kaeme 20.096,61 heraus statt 19.671,51.
    const balance = finalBalance(
      config({ initialCapital: 10_000, monthlyContribution: 0, annualRatePercent: 7, accumulationYears: 10 }),
    )
    expect(balance).toBeCloseTo(10_000 * Math.pow(1.07, 10), 6)
    expect(balance).toBeCloseTo(19_671.51, 2)
  })

  it('stimmt bei nominaler Verzinsung mit der Rentenformel überein', () => {
    const balance = finalBalance(config({ compounding: 'monthly-nominal' }))
    expect(balance).toBeCloseTo(annuity(500, 0.07 / 12, 120), 6)
    expect(balance).toBeCloseTo(86_542.4, 2)
  })

  it('stimmt bei effektiver Verzinsung mit der Rentenformel überein', () => {
    const balance = finalBalance(config())
    expect(balance).toBeCloseTo(annuity(500, Math.pow(1.07, 1 / 12) - 1, 120), 6)
    expect(balance).toBeCloseTo(85_525.87, 2)
  })

  it('ordnet die drei Zinsmodi wie erwartet', () => {
    const annual = finalBalance(config({ compounding: 'annual' }))
    const effective = finalBalance(config({ compounding: 'monthly-effective' }))
    const nominal = finalBalance(config({ compounding: 'monthly-nominal' }))
    expect(annual).toBeLessThan(effective)
    expect(effective).toBeLessThan(nominal)
    expect(annual).toBeCloseTo(82_898.69, 2)
  })

  it('liefert bei 0 % exakt die Summe der Einzahlungen', () => {
    const last = simulate(config({ annualRatePercent: 0 })).years.at(-1)!
    expect(last.balance).toBeCloseTo(60_000, 10)
    expect(last.interest).toBeCloseTo(0, 10)
    expect(last.contributions).toBeCloseTo(60_000, 10)
  })

  it('bleibt bei winzigen Zinssaetzen stabil', () => {
    // Regressionsschutz: die geschlossene Formel bricht hier zusammen (~48 EUR
    // Fehler bei 1e-12), die Schleife nicht.
    expect(finalBalance(config({ annualRatePercent: 1e-12 }))).toBeCloseTo(60_000, 3)
  })

  it('verarbeitet negative Renditen', () => {
    const last = simulate(config({ annualRatePercent: -2 })).years.at(-1)!
    expect(last.balance).toBeLessThan(60_000)
    expect(last.interest).toBeLessThan(0)
    expect(Number.isFinite(last.balance)).toBe(true)
  })

  it('verzinst vorschüssig um genau eine Periode mehr als nachschüssig', () => {
    const start = finalBalance(config({ timing: 'start' }))
    const end = finalBalance(config({ timing: 'end' }))
    expect(start).toBeCloseTo(end * (1 + toMonthlyRate(7, 'monthly-effective')), 6)
  })

  it('liefert years + 1 Stützpunkte ab Jahr 0', () => {
    const { years } = simulate(config({ initialCapital: 1_000, accumulationYears: 25 }))
    expect(years).toHaveLength(26)
    expect(years[0]).toEqual({
      year: 0,
      balance: 1_000,
      contributions: 1_000,
      withdrawals: 0,
      interest: 0,
      phase: 'accumulate',
    })
    expect(years.at(-1)!.year).toBe(25)
  })

  it('zaehlt Startkapital als Einzahlung, nicht als Zins', () => {
    const { years } = simulate(
      config({ initialCapital: 5_000, monthlyContribution: 0, annualRatePercent: 0, accumulationYears: 3 }),
    )
    expect(years.at(-1)!.contributions).toBe(5_000)
    expect(years.at(-1)!.interest).toBeCloseTo(0, 10)
  })

  it('überlebt NaN-Eingaben', () => {
    const { years, depletedAtYear } = simulate(
      config({
        annualRatePercent: NaN,
        monthlyContribution: NaN,
        initialCapital: NaN,
        withdrawalYears: 5,
        params: { monthlyWithdrawal: NaN },
      }),
    )
    expect(years).toHaveLength(16)
    expect(years.every((y) => Number.isFinite(y.balance))).toBe(true)
    expect(depletedAtYear).toBeNull()
  })

  it('behält DEFAULT_MODEL als sinnvolle Voreinstellung', () => {
    expect(DEFAULT_MODEL.accumulationYears).toBe(30)
    expect(DEFAULT_MODEL.withdrawalYears).toBe(25)
  })

  it('liefert bei Laufzeit 0 nur den Startpunkt', () => {
    expect(simulate(config({ accumulationYears: 0 })).years).toHaveLength(1)
  })
})

describe('Entnahmephase', () => {
  const retirement = (o: Overrides = {}) =>
    simulate(config({ accumulationYears: 30, withdrawalYears: 25, ...o }))

  it('spart erst an und entnimmt dann', () => {
    const r = retirement({ params: { monthlyWithdrawal: 2_000 } })
    expect(r.capitalAtRetirement).toBeCloseTo(584_726.3, 1)
    expect(r.years).toHaveLength(56) // Jahr 0 + 30 + 25
    expect(r.years[30].phase).toBe('accumulate')
    expect(r.years[31].phase).toBe('withdraw')
  })

  it('hält die Identität balance = eingezahlt + Zinsen - entnommen', () => {
    for (const y of retirement({ params: { monthlyWithdrawal: 3_000 } }).years) {
      expect(y.balance).toBeCloseTo(y.contributions + y.interest - y.withdrawals, 6)
    }
  })

  it('lässt das Depot niemals ins Minus laufen', () => {
    const r = retirement({ params: { monthlyWithdrawal: 20_000 } })
    expect(r.years.every((y) => y.balance >= 0)).toBe(true)
  })

  it('meldet das Jahr, in dem das Kapital aufgebraucht ist', () => {
    // Nachgerechnet: 584.726 EUR Rentenkapital, 5.000 EUR/Monat, 7 % -> Jahr 46.
    const r = retirement({ params: { monthlyWithdrawal: 5_000 } })
    expect(r.depletedAtYear).toBe(46)
    expect(r.years.at(-1)!.balance).toBeCloseTo(0, 6)
  })

  it('meldet null, solange das Kapital durchhält', () => {
    const r = retirement({ params: { monthlyWithdrawal: 4_000 } })
    expect(r.depletedAtYear).toBeNull()
    expect(r.years.at(-1)!.balance).toBeGreaterThan(0)
  })

  it('leitet die Prozentregel aus dem Rentenkapital ab', () => {
    const r = retirement({
      withdrawalStrategyId: 'percentRule',
      params: { withdrawalRate: 4 },
    })
    expect(r.monthlyWithdrawal).toBeCloseTo((r.capitalAtRetirement * 0.04) / 12, 6)
    expect(r.monthlyWithdrawal).toBeCloseTo(1_949.09, 1)
    expect(r.depletedAtYear).toBeNull()
  })

  it('lässt den festen Betrag unabhängig vom Rentenkapital', () => {
    const klein = retirement({ monthlyContribution: 100, params: { monthlyWithdrawal: 1_000 } })
    const gross = retirement({ monthlyContribution: 900, params: { monthlyWithdrawal: 1_000 } })
    expect(klein.monthlyWithdrawal).toBe(1_000)
    expect(gross.monthlyWithdrawal).toBe(1_000)
    expect(klein.capitalAtRetirement).toBeLessThan(gross.capitalAtRetirement)
  })

  it('zählt Entnahmen kumuliert mit', () => {
    const r = retirement({ params: { monthlyWithdrawal: 2_000 } })
    expect(r.years[30].withdrawals).toBe(0)
    expect(r.years.at(-1)!.withdrawals).toBeCloseTo(2_000 * 12 * 25, 6)
  })

  it('kommt ohne Entnahmephase aus', () => {
    const r = simulate(config({ accumulationYears: 10, withdrawalYears: 0 }))
    expect(r.years).toHaveLength(11)
    expect(r.depletedAtYear).toBeNull()
    expect(r.years.at(-1)!.withdrawals).toBe(0)
  })
})

describe('Inflationsbereinigte Beträge', () => {
  const real = (o: Overrides = {}) =>
    simulate(
      config({
        accumulationYears: 30,
        withdrawalYears: 25,
        amountsInflationAdjusted: true,
        params: { inflationRate: 2, monthlyWithdrawal: 2_000 },
        ...o,
      }),
    )

  it('ändert ohne den Schalter nichts an den bisherigen Ankern', () => {
    // Rückwärtskompatibilität: der Standardweg muss unverändert rechnen.
    expect(finalBalance(config({ compounding: 'monthly-nominal' }))).toBeCloseTo(86_542.4, 2)
  })

  it('zahlt nominal mehr ein als ohne Bereinigung', () => {
    const ohne = simulate(config({ accumulationYears: 30 }))
    const mit = simulate(config({ accumulationYears: 30, amountsInflationAdjusted: true }))
    expect(mit.years.at(-1)!.contributions).toBeGreaterThan(
      ohne.years.at(-1)!.contributions,
    )
  })

  it('hält die Kaufkraft der Einzahlung konstant', () => {
    // Genau das ist der Zweck: nominal steigend, real gleichbleibend.
    const { years } = simulate(
      config({
        accumulationYears: 10,
        monthlyContribution: 500,
        amountsInflationAdjusted: true,
        params: { inflationRate: 2 },
      }),
    )
    const jahresrate = (jahr: number) => years[jahr].contributions - years[jahr - 1].contributions
    const real = (jahr: number) => jahresrate(jahr) / Math.pow(1.02, jahr - 1)
    for (let jahr = 2; jahr <= 10; jahr += 1) {
      expect(real(jahr), `Jahr ${jahr}`).toBeCloseTo(real(1), 6)
    }
  })

  it('lässt die Entnahme nominal mitwachsen', () => {
    const r = real()
    const jahr = (n: number) => r.years[n].withdrawals - r.years[n - 1].withdrawals
    expect(jahr(32)).toBeGreaterThan(jahr(31))
    // Ab heute gerechnet, nicht ab Rentenbeginn: im 31. Jahr liegt der nominale
    // Betrag schon rund 1,02^30 über dem eingetragenen.
    expect(jahr(31)).toBeCloseTo(2_000 * 12 * Math.pow(1.02, 30), 0)
  })
})

describe('monthlyWithdrawalOverride', () => {
  it('entnimmt den vorgegebenen Betrag statt des abgeleiteten', () => {
    const abgeleitet = simulate(
      config({ accumulationYears: 30, withdrawalYears: 25, withdrawalStrategyId: 'percentRule' }),
    )
    const erzwungen = simulate(
      config({
        accumulationYears: 30,
        withdrawalYears: 25,
        withdrawalStrategyId: 'percentRule',
        monthlyWithdrawalOverride: 3_000,
      }),
    )
    expect(abgeleitet.monthlyWithdrawal).not.toBeCloseTo(3_000, 0)
    expect(erzwungen.monthlyWithdrawal).toBe(3_000)
  })

  it('lässt die 0-%-Vergleichsserie denselben Plan abbilden', () => {
    // Der eigentliche Zweck: gleiche Auszahlung, andere Rendite.
    const haupt = simulate(
      config({ accumulationYears: 30, withdrawalYears: 25, withdrawalStrategyId: 'percentRule' }),
    )
    const ohneRendite = simulate(
      config({
        accumulationYears: 30,
        withdrawalYears: 25,
        annualRatePercent: 0,
        withdrawalStrategyId: 'percentRule',
        monthlyWithdrawalOverride: haupt.monthlyWithdrawal,
      }),
    )
    expect(ohneRendite.monthlyWithdrawal).toBe(haupt.monthlyWithdrawal)
    expect(ohneRendite.depletedAtYear).not.toBeNull()
    expect(haupt.depletedAtYear).toBeNull()
  })
})

describe('rateAt (variable Renditen)', () => {
  it('ergibt mit konstanter Funktion exakt dasselbe wie der feste Zins', () => {
    // Regressionsschutz für den Umbau: der bisherige Weg darf sich nicht
    // um einen Cent verschieben, nur weil es jetzt einen zweiten gibt.
    const fest = simulate(config({ annualRatePercent: 7, accumulationYears: 20 }))
    const monatszins = toMonthlyRate(7, 'monthly-effective')
    const variabel = simulate(
      config({ annualRatePercent: 7, accumulationYears: 20, rateAt: () => monatszins }),
    )
    expect(variabel.years.at(-1)!.balance).toBeCloseTo(fest.years.at(-1)!.balance, 8)
  })

  it('nimmt die Rendite je Periode aus der Funktion', () => {
    // 12 Monate zu je 1 % ergeben 1,01^12.
    const r = simulate(
      config({
        annualRatePercent: 0,
        monthlyContribution: 0,
        initialCapital: 1_000,
        accumulationYears: 1,
        rateAt: () => 0.01,
      }),
    )
    expect(r.years.at(-1)!.balance).toBeCloseTo(1_000 * Math.pow(1.01, 12), 6)
  })

  it('zählt die Perioden über beide Phasen durchgehend', () => {
    // Ein Kursverlauf darf in der Entnahmephase nicht wieder bei Monat 0
    // anfangen - sonst wiederholte sich die Historie.
    const gesehen: number[] = []
    simulate(
      config({
        accumulationYears: 1,
        withdrawalYears: 1,
        params: { monthlyWithdrawal: 10 },
        rateAt: (i) => {
          gesehen.push(i)
          return 0
        },
      }),
    )
    expect(gesehen[0]).toBe(0)
    expect(gesehen.at(-1)).toBe(23)
    expect(new Set(gesehen).size).toBe(24)
  })
})

describe('Dynamik der Sparrate', () => {
  const lauf = (contributionGrowth: number, over: Partial<typeof DEFAULT_MODEL> = {}) =>
    simulate({
      annualRatePercent: 5,
      monthlyContribution: 100,
      initialCapital: 0,
      params: { ...DEFAULT_PARAMS, contributionGrowth, inflationRate: 2 },
      model: { ...DEFAULT_MODEL, accumulationYears: 10, withdrawalYears: 0, ...over },
    })

  it('ändert ohne Dynamik keine einzige Zahl', () => {
    // Der Vorgabewert ist 0 - jeder gespeicherte Zustand von vorher muss
    // exakt dasselbe Ergebnis liefern wie zuvor.
    expect(lauf(0).years).toEqual(
      simulate({
        annualRatePercent: 5,
        monthlyContribution: 100,
        initialCapital: 0,
        params: DEFAULT_PARAMS,
        model: { ...DEFAULT_MODEL, accumulationYears: 10, withdrawalYears: 0 },
      }).years,
    )
  })

  it('zahlt im ersten Jahr noch die eingetragene Rate', () => {
    // Die Steigerung greift ab dem zweiten Jahr - sonst wäre der eingetragene
    // Betrag nie derjenige, der tatsächlich fließt.
    expect(lauf(5).years[1].contributions).toBeCloseTo(1_200, 6)
  })

  it('steigert die Einzahlung Jahr für Jahr', () => {
    // 1200 + 1200 * 1,05 = 2460
    expect(lauf(5).years[2].contributions).toBeCloseTo(2_460, 6)
  })

  it('bringt mehr ein als eine gleichbleibende Rate', () => {
    expect(lauf(5).years.at(-1)!.balance).toBeGreaterThan(lauf(0).years.at(-1)!.balance)
  })

  it('kommt zur Inflationsanpassung hinzu, statt sie zu ersetzen', () => {
    // Beide Faktoren wirken: 2 % Kaufkraftausgleich und 5 % echte Steigerung.
    const mitBeidem = lauf(5, { amountsInflationAdjusted: true })
    const nurInflation = lauf(0, { amountsInflationAdjusted: true })
    expect(mitBeidem.years[2].contributions).toBeCloseTo(1_200 + 1_200 * 1.02 * 1.05, 6)
    expect(mitBeidem.years[2].contributions).toBeGreaterThan(nurInflation.years[2].contributions)
  })

  it('lässt die Entnahme unberührt', () => {
    /*
     * Eine Gehaltserhöhung ist ein Grund, mehr zu sparen - keiner, später mehr
     * zu entnehmen. Bei fester Entnahme muss der Betrag deshalb derselbe
     * bleiben, egal wie dynamisch eingezahlt wurde.
     */
    const mit = simulate({
      annualRatePercent: 5,
      monthlyContribution: 100,
      initialCapital: 0,
      monthlyWithdrawalOverride: 500,
      params: { ...DEFAULT_PARAMS, contributionGrowth: 8 },
      model: { ...DEFAULT_MODEL, accumulationYears: 10, withdrawalYears: 5 },
    })
    const entnommenImErstenJahr = mit.years[11].withdrawals
    expect(entnommenImErstenJahr).toBeCloseTo(500 * 12, 6)
  })

  it('ignoriert unsinnige Werte, statt zu rechnen', () => {
    expect(lauf(Number.NaN).years.at(-1)!.balance).toBeCloseTo(lauf(0).years.at(-1)!.balance, 6)
    expect(lauf(-10).years.at(-1)!.balance).toBeCloseTo(lauf(0).years.at(-1)!.balance, 6)
  })
})
