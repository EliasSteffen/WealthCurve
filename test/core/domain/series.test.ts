import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, simulate } from '@/core/domain/math'
import { DEFAULT_PARAMS, PARAM_IDS, type SimulationParams } from '@/core/domain/parameters'
import { resolveWithdrawalStrategy } from '@/core/domain/withdrawal'
import type { SeriesContext } from '@/core/domain/types'
import { SERIES } from '@/core/domain/series/index'

const base = simulate({
  annualRatePercent: DEFAULT_PARAMS.annualRate,
  monthlyContribution: DEFAULT_PARAMS.monthlyContribution,
  initialCapital: DEFAULT_PARAMS.initialCapital,
  params: DEFAULT_PARAMS,
  model: DEFAULT_MODEL,
})

const ctx: SeriesContext = { base, params: DEFAULT_PARAMS, model: DEFAULT_MODEL }

describe('Series-Registry', () => {
  it('vergibt IDs eindeutig', () => {
    const ids = SERIES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('vergibt Farb-Slots eindeutig', () => {
    // Zwei Serien in derselben Farbe wären im Chart nicht unterscheidbar.
    const colors = SERIES.map((s) => s.colorVar)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('deklariert nur existierende Parameter', () => {
    for (const series of SERIES) {
      for (const id of series.requiredParams) expect(PARAM_IDS).toContain(id)
    }
  })

  it('liefert index-alignierte Werte passend zur Basissimulation', () => {
    // Ohne diese Zusage wäre ein gemeinsamer Tooltip über alle Serien falsch.
    for (const series of SERIES) {
      expect(series.compute(ctx)).toHaveLength(base.years.length)
    }
  })

  it('liefert endliche Zahlen oder null, aber nie NaN', () => {
    // null heisst "kein Wert fuer dieses Jahr" und wird als Luecke gezeichnet.
    // NaN dagegen wuerde stillschweigend die Achsenskalierung zerstoeren.
    for (const series of SERIES) {
      const werte = series.compute(ctx)
      expect(
        werte.every((v) => v === null || Number.isFinite(v)),
        series.id,
      ).toBe(true)
    }
  })

  it('liefert ohne Kursdaten durchgehend null statt erfundener Werte', () => {
    const kurs = SERIES.find((s) => s.id === 'marketReturn')!
    expect(kurs.compute({ ...ctx, market: null }).every((v) => v === null)).toBe(true)
  })

  it('beginnt jede Serie im Jahr 0 mit einem Wert oder bewusst ohne', () => {
    // Bewusst KEINE Aussage ueber den Startwert: eine Serie darf auch bei 0
    // beginnen (etwa "nur Zinsertrag"). Allgemeingültig ist nur, dass jede
    // Serie einen Wert für Jahr 0 liefert - sonst fängt die Kurve zu spät an.
    for (const series of SERIES) {
      const erster = series.compute(ctx)[0]
      expect(erster === null || typeof erster === 'number', series.id).toBe(true)
    }
  })

  it('liest nur Parameter, die es auch deklariert', () => {
    // Ersetzt Generics-Akrobatik durch Laufzeit-Verifikation: Wir schreiben mit,
    // welche Parameter compute() tatsaechlich anfasst.
    // Bewusst Teilmenge statt Gleichheit - Überdeklaration zeigt einen Regler zu
    // viel (harmlos), Unterdeklaration lässt einen Regler fehlen (der echte Bug).
    for (const series of SERIES) {
      const accessed = new Set<string>()
      const spy = new Proxy({ ...DEFAULT_PARAMS } as Record<string, number>, {
        get(target, key: string) {
          accessed.add(key)
          return Reflect.get(target, key)
        },
      }) as SimulationParams

      series.compute({ ...ctx, params: spy })

      // Serien, die selbst simulieren, befragen dabei die Entnahmestrategie -
      // deren Parameter deklariert die Strategie, nicht die Serie.
      const strategy = resolveWithdrawalStrategy(DEFAULT_MODEL.withdrawalStrategyId)
      const allowed = [...series.requiredParams, ...strategy.requiredParams]

      for (const key of accessed) {
        expect(allowed, `${series.id} liest "${key}" ohne es zu deklarieren`).toContain(key)
      }
    }
  })
})

describe('einzelne Serien', () => {
  const valuesOf = (id: string) => SERIES.find((s) => s.id === id)!.compute(ctx) as number[]

  it('startet jede Bestandsserie beim Startkapital', () => {
    // Gilt für Serien, die einen Kontostand zeigen - nicht für abgeleitete
    // Größen wie einen reinen Ertragsanteil.
    const withCapital: SeriesContext = {
      ...ctx,
      params: { ...DEFAULT_PARAMS, initialCapital: 10_000 },
      base: simulate({
        annualRatePercent: DEFAULT_PARAMS.annualRate,
        monthlyContribution: DEFAULT_PARAMS.monthlyContribution,
        initialCapital: 10_000,
        params: { ...DEFAULT_PARAMS, initialCapital: 10_000 },
        model: DEFAULT_MODEL,
      }),
    }
    for (const id of ['compound', 'contributions', 'purchasingPower', 'savingsAccount']) {
      const series = SERIES.find((s) => s.id === id)!
      expect(series.compute(withCapital)[0], id).toBeCloseTo(10_000, 6)
    }
  })

  it('zeigt Zinseszins über den reinen Einzahlungen', () => {
    const compound = valuesOf('compound')
    const contributions = valuesOf('contributions')
    expect(compound.at(-1)!).toBeGreaterThan(contributions.at(-1)!)
  })

  it('wächst in der Ansparphase streng linear', () => {
    const values = valuesOf('contributions')
    const firstStep = values[1] - values[0]
    for (let i = 2; i <= DEFAULT_MODEL.accumulationYears; i += 1) {
      expect(values[i] - values[i - 1], `Jahr ${i}`).toBeCloseTo(firstStep, 6)
    }
  })

  it('fällt in der Entnahmephase, statt stehen zu bleiben', () => {
    // Die Serie ist das Szenario "nur sammeln, 0 % Rendite". Entnahmen fließen
    // dort genauso ab - sonst verglichen wir einen Auszahlplan mit einem Konto,
    // von dem nie etwas abgeht.
    const values = valuesOf('contributions')
    const start = DEFAULT_MODEL.accumulationYears
    expect(values[start + 1]).toBeLessThan(values[start])
    expect(values.at(-1)!).toBeLessThan(values[start])
  })

  it('ist ohne Rendite früher aufgebraucht als mit', () => {
    const ohne = valuesOf('contributions')
    const mit = valuesOf('compound')
    expect(ohne.at(-1)!).toBeLessThan(mit.at(-1)!)
    expect(ohne.every((v) => v >= 0)).toBe(true)
  })

  it('zinst die Kaufkraft mit (1 + i)^t ab', () => {
    // Prueft die Projektion, nicht die Arithmetik - die deckt math.test.ts ab.
    const compound = valuesOf('compound')
    const real = valuesOf('purchasingPower')
    const factor = 1 + DEFAULT_PARAMS.inflationRate / 100
    const lastYear = base.years.at(-1)!.year
    expect(real.at(-1)!).toBeCloseTo(compound.at(-1)! / factor ** lastYear, 6)
    expect(real.at(-1)!).toBeLessThan(compound.at(-1)!)
  })

  it('lässt Tagesgeld beim niedrigeren Zins zurückbleiben', () => {
    expect(DEFAULT_PARAMS.savingsRate).toBeLessThan(DEFAULT_PARAMS.annualRate)
    expect(valuesOf('savingsAccount').at(-1)!).toBeLessThan(valuesOf('compound').at(-1)!)
  })

  it('lässt Kaufkraft bei 0 % Inflation mit dem Depotwert zusammenfallen', () => {
    const noInflation: SeriesContext = { ...ctx, params: { ...DEFAULT_PARAMS, inflationRate: 0 } }
    const series = SERIES.find((s) => s.id === 'purchasingPower')!
    expect(series.compute(noInflation).at(-1)!).toBeCloseTo(valuesOf('compound').at(-1)!, 6)
  })
})

describe('Tagesgeld und Prozentregel', () => {
  it('entnimmt im ersten Jahr denselben Betrag wie das Hauptszenario', () => {
    const model = { ...DEFAULT_MODEL, withdrawalStrategyId: 'percentRule' }
    const hauptszenario = simulate({
      annualRatePercent: DEFAULT_PARAMS.annualRate,
      monthlyContribution: DEFAULT_PARAMS.monthlyContribution,
      initialCapital: DEFAULT_PARAMS.initialCapital,
      params: DEFAULT_PARAMS,
      model,
    })
    const tagesgeld = SERIES.find((s) => s.id === 'savingsAccount')!.compute({
      base: hauptszenario,
      params: DEFAULT_PARAMS,
      model,
    }) as number[]
    const gleicherPlan = simulate({
      annualRatePercent: DEFAULT_PARAMS.savingsRate,
      monthlyContribution: DEFAULT_PARAMS.monthlyContribution,
      initialCapital: DEFAULT_PARAMS.initialCapital,
      monthlyWithdrawalOverride: hauptszenario.monthlyWithdrawal,
      params: DEFAULT_PARAMS,
      model,
    })
    // Ohne Vorgabe entnähme die Prozentregel vom kleineren Tagesgeld-Kapital.
    const eigenerPlan = simulate({
      annualRatePercent: DEFAULT_PARAMS.savingsRate,
      monthlyContribution: DEFAULT_PARAMS.monthlyContribution,
      initialCapital: DEFAULT_PARAMS.initialCapital,
      params: DEFAULT_PARAMS,
      model,
    })
    expect(eigenerPlan.monthlyWithdrawal).toBeLessThan(hauptszenario.monthlyWithdrawal)
    expect(tagesgeld).toEqual(gleicherPlan.years.map((y) => y.balance))
  })
})

describe('Kursverlauf bei verschiedenen Zinsmodi', () => {
  const markt = (monate: number) => ({
    symbol: 'TEST',
    name: 'T',
    currency: 'USD',
    start: '2000-01',
    monthlyReturns: Array<number>(monate).fill(0.01),
  })
  const kurs = SERIES.find((s) => s.id === 'marketReturn')!
  const rechne = (compounding: 'monthly-effective' | 'annual', monate: number, jahre = 10) => {
    const params = {
      ...DEFAULT_PARAMS,
      initialCapital: 10_000,
      monthlyContribution: 0,
    }
    const model = {
      ...DEFAULT_MODEL,
      compounding,
      accumulationYears: jahre,
      withdrawalYears: 0,
      timeAxis: 'calendar' as const,
      startYear: 2000,
      startMonth: 1,
    }
    const baseSim = simulate({
      annualRatePercent: 0,
      monthlyContribution: 0,
      initialCapital: 10_000,
      params,
      model,
    })
    return kurs.compute({
      base: baseSim,
      params,
      model,
      market: markt(monate),
    })
  }

  it('rechnet Monats- und Jahresmodus auf dasselbe Endergebnis', () => {
    const erwartet = 10_000 * Math.pow(1.01, 120)
    expect(rechne('monthly-effective', 360).at(-1)).toBeCloseTo(erwartet, 4)
    expect(rechne('annual', 360).at(-1)).toBeCloseTo(erwartet, 4)
  })

  it('endet im Jahresmodus nach dem letzten voll gedeckten Jahr', () => {
    // 66 Monate = 5 volle Jahre + 6 Monate: Jahr 6 ist nicht mehr gedeckt.
    for (const modus of ['monthly-effective', 'annual'] as const) {
      const werte = rechne(modus, 66)
      expect(werte[5], modus).toBeCloseTo(10_000 * Math.pow(1.01, 60), 4)
      expect(werte.slice(6), modus).toEqual(Array(5).fill(null))
    }
  })
})
