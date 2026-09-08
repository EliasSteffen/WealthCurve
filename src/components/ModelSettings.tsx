import { CHART_STYLES } from '../core/chart-style'
import {
  TIMELINE_FIELDS,
  TIMELINE_FIELD_IDS,
  sanitizeTimelineField,
  type TimelineFieldId,
} from '../core/domain/parameters'
import type { ModelSettings as ModelSettingsValue } from '../core/domain/types'
import { WITHDRAWAL_STRATEGIES } from '../core/domain/withdrawal'
import { useT } from '../react/localeContext'
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
  const t = useT()
  return (
    <SegmentedControl
      label={t('withdrawal.rule', 'Regel')}
      value={value.withdrawalStrategyId}
      onChange={(withdrawalStrategyId) => onChange({ ...value, withdrawalStrategyId })}
      options={WITHDRAWAL_STRATEGIES.map((s) => ({
        value: s.id,
        label: t(`withdrawal.${s.id}.label`, s.label),
        hint: t(`withdrawal.${s.id}.description`, s.description),
      }))}
    />
  )
}

/**
 * Die Zeitachse gilt für alle Szenarien gemeinsam - sonst lägen die Kurven auf
 * unterschiedlichen X-Achsen und der Vergleich wäre wertlos.
 */
export function TimelineControls({ value, onChange, matches = null }: ModelProps) {
  const t = useT()
  const ids = TIMELINE_FIELD_IDS.filter((id) => zeigt(matches, `timeline:${id}`))
  if (ids.length === 0) return null

  return (
    <div className="space-y-5">
      {ids.map((id: TimelineFieldId) => (
        <SliderField
          key={id}
          definition={{
            ...TIMELINE_FIELDS[id],
            label: t(`timeline.${id}.label`, TIMELINE_FIELDS[id].label),
            hint: t(`timeline.${id}.hint`, TIMELINE_FIELDS[id].hint),
          }}
          value={value[id]}
          onChange={(next) => onChange({ ...value, [id]: sanitizeTimelineField(id, next) })}
        />
      ))}
      {matches === null ? (
        <p className="text-[11px] leading-snug text-[var(--text-muted)]">
          {t('timeline.shared', 'Gilt für alle Szenarien gemeinsam.')}
        </p>
      ) : null}
    </div>
  )
}

/** Rechenkonventionen - sie ändern die Zahlen, nicht das Szenario. */
export function CalculationControls({ value, onChange, matches = null }: ModelProps) {
  const t = useT()
  const zinsmodus = zeigt(matches, 'model:compounding')
  const timing = zeigt(matches, 'model:timing')
  const inflation = zeigt(matches, 'model:amountsInflationAdjusted')
  if (!zinsmodus && !timing && !inflation) return null

  return (
    <div className="space-y-4">
      {zinsmodus ? (
        <SegmentedControl
          label={t('model.compounding', 'Zinsmodus')}
          value={value.compounding}
          onChange={(compounding) => onChange({ ...value, compounding })}
          options={[
            {
              value: 'monthly-effective',
              label: t('model.compounding.monthly-effective', 'Effektiv'),
              hint: 'Zwölf Monatsschritte ergeben exakt den Jahreszins (ETF-Konvention).',
            },
            {
              value: 'monthly-nominal',
              label: t('model.compounding.monthly-nominal', 'Nominal'),
              hint: 'Zins/12 – Bankkonvention. Ergibt mehr als den eingegebenen Jahreszins.',
            },
            {
              value: 'annual',
              label: t('model.compounding.annual', 'Jährlich'),
              hint: 'Einmal pro Jahr verzinst, Raten sammeln sich unverzinst.',
            },
          ]}
        />
      ) : null}
      {timing ? (
        <SegmentedControl
          label={t('model.timing', 'Sparrate')}
          value={value.timing}
          onChange={(timing) => onChange({ ...value, timing })}
          options={[
            {
              value: 'end',
              label: t('model.timing.end', 'Nachschüssig'),
              hint: 'Einzahlung am Monatsende.',
            },
            {
              value: 'start',
              label: t('model.timing.start', 'Vorschüssig'),
              hint: 'Einzahlung am Monatsanfang.',
            },
          ]}
        />
      ) : null}
      {inflation ? (
        <SegmentedControl
          label={t('model.amounts', 'Beträge')}
          value={value.amountsInflationAdjusted ? 'real' : 'nominal'}
          onChange={(v) => onChange({ ...value, amountsInflationAdjusted: v === 'real' })}
          options={[
            {
              value: 'nominal',
              label: t('model.amounts.nominal', 'Nominal'),
              hint: 'Spar- und Auszahlbetrag bleiben über die Jahre unverändert.',
            },
            {
              value: 'real',
              label: t('model.amounts.real', 'Inflationsbereinigt'),
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
  const t = useT()
  if (!zeigt(matches, 'style')) return null
  return (
    <SelectField
      label={t('style.label', 'Stil')}
      value={value}
      onChange={onChange}
      options={CHART_STYLES.map((s) => ({
        value: s.id,
        label: t(`style.${s.id}.label`, s.label),
        description: t(`style.${s.id}.description`, s.description),
      }))}
    />
  )
}
