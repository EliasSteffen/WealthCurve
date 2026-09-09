import { CHART_STYLES } from '../core/chart-style'
import {
  TIMELINE_FIELDS,
  TIMELINE_FIELD_IDS,
  sanitizeTimelineField,
  type TimelineFieldId,
} from '../core/domain/parameters'
import type { ModelSettings as ModelSettingsValue } from '../core/domain/types'
import { WITHDRAWAL_STRATEGIES } from '../core/domain/withdrawal'
import type { SettingsCategoryId } from '../core/settings'
import {
  MAX_START_AGE,
  MAX_START_YEAR,
  MIN_START_AGE,
  MIN_START_YEAR,
} from '../core/timeAxis'
import { useT } from '../react/localeContext'
import { NumberField } from './ui/NumberField'
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
export function TimelineControls({
  value,
  onChange,
  matches = null,
  category,
}: ModelProps & { readonly category: SettingsCategoryId }) {
  const t = useT()
  const ids = TIMELINE_FIELD_IDS.filter(
    (id) => TIMELINE_FIELDS[id].category === category && zeigt(matches, `timeline:${id}`),
  )
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

/*
 * Die drei Rechenschalter stehen einzeln da, nicht als ein Block.
 *
 * Sie ändern zwar alle die Zahlen und nicht das Szenario, gehören aber in
 * verschiedene Kategorien: wann die Sparrate fließt, ist eine Frage der
 * Einzahlung; wie verzinst wird, eine allgemeine.
 */

/** Wie der Jahreszins auf die Perioden verteilt wird. */
export function CompoundingControl({ value, onChange, matches = null }: ModelProps) {
  const t = useT()
  if (!zeigt(matches, 'model:compounding')) return null
  return (
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
  )
}

/** Vorschüssig oder nachschüssig - gehört zur Einzahlung. */
export function TimingControl({ value, onChange, matches = null }: ModelProps) {
  const t = useT()
  if (!zeigt(matches, 'model:timing')) return null
  return (
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
  )
}

/**
 * Zeitachse: Anker eintragen und Beschriftung wählen.
 *
 * Die Anker sind optional - leer heißt „kein Bezug". Ein Modus greift nur mit
 * seinem Anker (siehe `effectiveMode`), deshalb steht der Hinweis direkt am
 * Schalter statt als Fehlermeldung hinterher.
 */
export function TimeAxisControls({ value, onChange, matches = null }: ModelProps) {
  const t = useT()
  if (!zeigt(matches, 'model:timeAxis')) return null

  return (
    <div className="space-y-4">
      <SegmentedControl
        label={t('model.timeAxis', 'Zeitachse')}
        value={value.timeAxis}
        onChange={(timeAxis) => onChange({ ...value, timeAxis })}
        options={[
          {
            value: 'relative' as const,
            label: t('model.timeAxis.relative', 'Jahre ab 0'),
            hint: 'Zählt die Laufzeit, unabhängig von Alter und Kalender.',
          },
          {
            value: 'age' as const,
            label: t('model.timeAxis.age', 'Alter'),
            hint: 'Beschriftet mit dem Lebensalter – „mit 65" statt „Jahr 35".',
          },
          {
            value: 'calendar' as const,
            label: t('model.timeAxis.calendar', 'Kalenderjahr'),
            hint: 'Beschriftet mit Jahreszahlen. Nötig für echte Kursverläufe.',
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={t('model.startAge', 'Alter bei Start')}
          value={value.startAge}
          min={MIN_START_AGE}
          max={MAX_START_AGE}
          placeholder={t('model.noAnchor', 'ohne')}
          onChange={(startAge) => onChange({ ...value, startAge })}
        />
        <NumberField
          label={t('model.startYear', 'Startjahr')}
          value={value.startYear}
          min={MIN_START_YEAR}
          max={MAX_START_YEAR}
          placeholder={t('model.noAnchor', 'ohne')}
          onChange={(startYear) => onChange({ ...value, startYear })}
        />
      </div>

      <p className="text-[11px] leading-snug text-[var(--text-muted)]">
        {value.startYear === null
          ? t(
              'model.startYear.needed',
              'Ohne Startjahr bleibt der Kursverlauf leer: echte Renditen hängen an echten Monaten, und vorwärts lässt sich ein Kurs nicht fortschreiben.',
            )
          : t('model.anchors.hint', 'Die Beschriftung ändert nur die Achse, keine Zahl.')}
      </p>
    </div>
  )
}

/** Gelten die eingetragenen Beträge als heutige Kaufkraft? */
export function InflationAmountsControl({ value, onChange, matches = null }: ModelProps) {
  const t = useT()
  if (!zeigt(matches, 'model:amountsInflationAdjusted')) return null
  return (
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
