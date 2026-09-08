import { CHART_STYLES } from '../core/chart-style'
import {
  TIMELINE_FIELDS,
  TIMELINE_FIELD_IDS,
  sanitizeTimelineField,
  type TimelineFieldId,
} from '../core/domain/parameters'
import type { ModelSettings as ModelSettingsValue } from '../core/domain/types'
import { WITHDRAWAL_STRATEGIES } from '../core/domain/withdrawal'
import { SegmentedControl } from './ui/SegmentedControl'
import { SelectField } from './ui/SelectField'
import { SliderField } from './ui/SliderField'

interface ModelProps {
  readonly value: ModelSettingsValue
  readonly onChange: (value: ModelSettingsValue) => void
  /** IDs aus der Suche; null = keine Suche aktiv. */
  readonly matches?: ReadonlySet<string> | null
}

const zeigt = (matches: ReadonlySet<string> | null | undefined, id: string) =>
  matches == null || matches.has(id)

/** Die Entnahmeregel steht im ParameterPanel direkt über den Entnahme-Reglern. */
export function WithdrawalRuleControl({ value, onChange }: ModelProps) {
  return (
    <SegmentedControl
      label="Regel"
      value={value.withdrawalStrategyId}
      onChange={(withdrawalStrategyId) => onChange({ ...value, withdrawalStrategyId })}
      options={WITHDRAWAL_STRATEGIES.map((s) => ({
        value: s.id,
        label: s.label,
        hint: s.description,
      }))}
    />
  )
}

/**
 * Die Zeitachse gilt für alle Szenarien gemeinsam - sonst lägen die Kurven auf
 * unterschiedlichen X-Achsen und der Vergleich wäre wertlos.
 */
export function TimelineControls({ value, onChange, matches = null }: ModelProps) {
  const ids = TIMELINE_FIELD_IDS.filter((id) => zeigt(matches, `timeline:${id}`))
  if (ids.length === 0) return null

  return (
    <div className="space-y-5">
      {ids.map((id: TimelineFieldId) => (
        <SliderField
          key={id}
          definition={TIMELINE_FIELDS[id]}
          value={value[id]}
          onChange={(next) => onChange({ ...value, [id]: sanitizeTimelineField(id, next) })}
        />
      ))}
      {matches === null ? (
        <p className="text-[11px] leading-snug text-[var(--text-muted)]">
          Gilt für alle Szenarien gemeinsam.
        </p>
      ) : null}
    </div>
  )
}

/** Rechenkonventionen - sie ändern die Zahlen, nicht das Szenario. */
export function CalculationControls({ value, onChange, matches = null }: ModelProps) {
  const zinsmodus = zeigt(matches, 'model:compounding')
  const timing = zeigt(matches, 'model:timing')
  const inflation = zeigt(matches, 'model:amountsInflationAdjusted')
  if (!zinsmodus && !timing && !inflation) return null

  return (
    <div className="space-y-4">
      {zinsmodus ? (
        <SegmentedControl
          label="Zinsmodus"
          value={value.compounding}
          onChange={(compounding) => onChange({ ...value, compounding })}
          options={[
            {
              value: 'monthly-effective',
              label: 'Effektiv',
              hint: 'Zwölf Monatsschritte ergeben exakt den Jahreszins (ETF-Konvention).',
            },
            {
              value: 'monthly-nominal',
              label: 'Nominal',
              hint: 'Zins/12 – Bankkonvention. Ergibt mehr als den eingegebenen Jahreszins.',
            },
            {
              value: 'annual',
              label: 'Jährlich',
              hint: 'Einmal pro Jahr verzinst, Raten sammeln sich unverzinst.',
            },
          ]}
        />
      ) : null}
      {timing ? (
        <SegmentedControl
          label="Sparrate"
          value={value.timing}
          onChange={(timing) => onChange({ ...value, timing })}
          options={[
            { value: 'end', label: 'Nachschüssig', hint: 'Einzahlung am Monatsende.' },
            { value: 'start', label: 'Vorschüssig', hint: 'Einzahlung am Monatsanfang.' },
          ]}
        />
      ) : null}
      {inflation ? (
        <SegmentedControl
          label="Beträge"
          value={value.amountsInflationAdjusted ? 'real' : 'nominal'}
          onChange={(v) => onChange({ ...value, amountsInflationAdjusted: v === 'real' })}
          options={[
            {
              value: 'nominal',
              label: 'Nominal',
              hint: 'Spar- und Auszahlbetrag bleiben über die Jahre unverändert.',
            },
            {
              value: 'real',
              label: 'Inflationsbereinigt',
              hint:
                'Der eingetragene Betrag gilt als heutige Kaufkraft; nominal steigt er ' +
                'jährlich mit der Inflation, damit sein realer Wert konstant bleibt.',
            },
          ]}
        />
      ) : null}
    </div>
  )
}

/** Der Darstellungsstil - gilt für den Chart und für das Video. */
export function ChartStyleControl({
  value,
  onChange,
  matches = null,
}: {
  readonly value: string
  readonly onChange: (id: string) => void
  readonly matches?: ReadonlySet<string> | null
}) {
  if (!zeigt(matches, 'style')) return null
  return (
    <SelectField
      label="Stil"
      value={value}
      onChange={onChange}
      options={CHART_STYLES.map((s) => ({
        value: s.id,
        label: s.label,
        description: s.description,
      }))}
    />
  )
}
