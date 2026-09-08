import { TIMELINE_FIELDS, TIMELINE_FIELD_IDS, sanitizeTimelineField } from '../core/domain/parameters'
import type { ModelSettings as ModelSettingsValue } from '../core/domain/types'
import { WITHDRAWAL_STRATEGIES } from '../core/domain/withdrawal'
import { Card, CardTitle } from './ui/Card'
import { SegmentedControl } from './ui/SegmentedControl'
import { SliderField } from './ui/SliderField'

interface ModelSettingsProps {
  readonly value: ModelSettingsValue
  readonly onChange: (value: ModelSettingsValue) => void
}

/**
 * Gilt global für alle Szenarien.
 *
 * Auch die Zeitachse steht hier und nicht bei den Szenario-Parametern: alle
 * Szenarien teilen denselben Zeitraum, sonst lägen die Kurven auf
 * unterschiedlichen X-Achsen und der Vergleich wäre wertlos.
 */
/** Steht im ParameterPanel direkt über den Entnahme-Reglern. */
export function WithdrawalRuleControl({ value, onChange }: ModelSettingsProps) {
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

export function ModelSettings({ value, onChange }: ModelSettingsProps) {
  return (
    <>
      <Card>
        <CardTitle>Zeitraum</CardTitle>
        <div className="space-y-5">
          {TIMELINE_FIELD_IDS.map((id) => (
            <SliderField
              key={id}
              definition={TIMELINE_FIELDS[id]}
              value={value[id]}
              onChange={(next) => onChange({ ...value, [id]: sanitizeTimelineField(id, next) })}
            />
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-snug text-[var(--text-muted)]">
          Gilt für alle Szenarien gemeinsam.
        </p>
      </Card>

      <Card>
        <CardTitle>Modell</CardTitle>
        <div className="space-y-4">
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
          <SegmentedControl
            label="Sparrate"
            value={value.timing}
            onChange={(timing) => onChange({ ...value, timing })}
            options={[
              { value: 'end', label: 'Nachschüssig', hint: 'Einzahlung am Monatsende.' },
              { value: 'start', label: 'Vorschüssig', hint: 'Einzahlung am Monatsanfang.' },
            ]}
          />
        </div>
      </Card>
    </>
  )
}
