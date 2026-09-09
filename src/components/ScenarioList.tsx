import { Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MAX_SCENARIOS, actions, type Scenario } from '../core/state'
import { SLOT_COUNT, slotVar, type ColorSlot } from '../core/palette'
import { selectProjection } from '../core/derive'
import { colorByScenario } from '../core/encoding'
import { useT } from '../react/localeContext'
import { useDispatch, useSelector } from '../react/useSelector'
import { cn } from '../lib/cn'

interface ScenarioListProps {
  readonly scenarios: readonly Scenario[]
  readonly activeScenarioId: string
}

export function ScenarioList({ scenarios, activeScenarioId }: ScenarioListProps) {
  const dispatch = useDispatch()
  const t = useT()
  const atLimit = scenarios.length >= MAX_SCENARIOS
  // Höchstens eine Palette offen - zwei nebeneinander schöben die Liste
  // auseinander, ohne dass mehr zu sehen wäre.
  const [farbwahl, setFarbwahl] = useState<string | null>(null)
  /*
   * Ob die gewählte Farbe gerade auch die Kurve trägt.
   *
   * Bei einem einzelnen Szenario steht die Farbe für die Serie - sonst wäre
   * alles gleichfarbig. Die Wahl wirkt dann nur hier in der Liste, und das
   * gehört dazugesagt: ein Regler, dessen Wirkung man vergeblich sucht, ist
   * schlimmer als keiner.
   */
  const faerbtSzenarien = useSelector(selectProjection).encodingId === colorByScenario.id

  return (
    <div>
      <ul className="space-y-1">
        {scenarios.map((scenario) => {
          const active = scenario.id === activeScenarioId
          return (
            <li
              key={scenario.id}
              className={cn(
                'group rounded-lg px-2 py-1.5 transition-colors',
                active ? 'bg-[var(--grid)]' : 'hover:bg-[var(--grid)]/60',
              )}
            >
            <div className="flex items-center gap-2">
              {/*
                Der Farbpunkt ist der Knopf zur Farbwahl.
                
                Er trägt die Farbe ohnehin und steht an genau der Stelle, an der
                man sie ändern will - ein zusätzliches Symbol daneben wäre eine
                zweite Erklärung für dieselbe Sache.
              */}
              <button
                type="button"
                onClick={() => setFarbwahl((v) => (v === scenario.id ? null : scenario.id))}
                aria-label={t('scenario.color', `Farbe von ${scenario.label} ändern`, {
                  name: scenario.label,
                })}
                aria-expanded={farbwahl === scenario.id}
                className="flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-1)]"
              >
                <span
                  aria-hidden
                  className={cn('size-2.5 rounded-full transition-opacity',
                    scenario.visible ? 'opacity-100' : 'opacity-30')}
                  style={{ background: slotVar(scenario.colorSlot) }}
                />
              </button>

              {/* Direkt im Feld umbenennbar - kein Dialog für einen Namen. */}
              <input
                value={scenario.label}
                aria-label={`Name von ${scenario.label}`}
                onFocus={() => dispatch(actions.selectScenario(scenario.id))}
                onChange={(e) => dispatch(actions.renameScenario(scenario.id, e.target.value))}
                className={cn(
                  'min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-sm',
                  'hover:border-[var(--hairline)] focus:border-[var(--chart-1)] focus:outline-none',
                  active ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                )}
              />

              <div className="flex shrink-0 items-center">
                <IconButton
                  label={
                    scenario.visible
                      ? t('scenario.hide', 'Ausblenden')
                      : t('scenario.show', 'Einblenden')
                  }
                  onClick={() =>
                    dispatch(actions.setScenarioVisible(scenario.id, !scenario.visible))
                  }
                >
                  {scenario.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </IconButton>
                <IconButton
                  label={t('scenario.duplicate', 'Duplizieren')}
                  disabled={atLimit}
                  // Ein ausgegrauter Knopf ohne Begründung ist von einem kaputten
                  // nicht zu unterscheiden.
                  disabledReason={t('scenario.limitShort', `Maximal ${MAX_SCENARIOS} Szenarien`, {
                    max: MAX_SCENARIOS,
                  })}
                  onClick={() => dispatch(actions.duplicateScenario(scenario.id))}
                >
                  <Copy size={15} />
                </IconButton>
                <IconButton
                  label={t('scenario.delete', 'Löschen')}
                  disabled={scenarios.length <= 1}
                  disabledReason={t(
                    'scenario.lastOne',
                    'Das letzte Szenario lässt sich nicht löschen',
                  )}
                  onClick={() => dispatch(actions.removeScenario(scenario.id))}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </div>

            {farbwahl === scenario.id ? (
              <Farbwahl
                aktuell={scenario.colorSlot}
                belegt={scenarios.filter((s) => s.id !== scenario.id).map((s) => s.colorSlot)}
                traegtKurve={faerbtSzenarien}
                onChange={(slot) => {
                  dispatch(actions.setScenarioColor(scenario.id, slot))
                  setFarbwahl(null)
                }}
              />
            ) : null}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        disabled={atLimit}
        onClick={() => dispatch(actions.addScenario())}
        className={cn(
          'mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-colors',
          atLimit
            ? 'cursor-not-allowed border-[var(--hairline)] text-[var(--text-muted)]'
            : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:bg-[var(--grid)]',
        )}
      >
        <Plus size={13} aria-hidden />
        {t('scenario.add', 'Szenario hinzufügen')}
      </button>

      {atLimit ? (
        /* Die Grenze ist keine Willkür: die Palette hat acht auf
           Farbfehlsichtigkeit geprüfte Töne. Ein neunter wäre von einem
           vorhandenen nicht mehr zu unterscheiden. */
        <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
          {t(
            'scenario.limit',
            `${MAX_SCENARIOS} Szenarien sind das Maximum – so viele Farben lassen sich noch sicher unterscheiden.`,
            { max: MAX_SCENARIOS },
          )}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Symbolknopf mit ausreichend großer Trefferfläche.
 *
 * `size-9` sind 36 px - deutlich über den 24 px, die WCAG 2.2 als Minimum
 * verlangt. Das Symbol bleibt klein, nur die anklickbare Fläche wächst;
 * vorher waren es 21 px bei 2 px Abstand zum Nachbarn, und daneben lag sofort
 * der falsche Knopf.
 */
function IconButton({
  label,
  onClick,
  disabled,
  disabledReason,
  children,
}: {
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean
  /** Warum der Knopf gerade nicht geht - sonst wirkt er schlicht kaputt. */
  readonly disabledReason?: string
  readonly children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={disabled && disabledReason ? `${label} – ${disabledReason}` : label}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-30'
          : 'hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Die acht Farben der Palette zur Auswahl.
 *
 * Keine freie Farbwahl: die Palette ist auf Farbfehlsichtigkeit geprüft (siehe
 * palette.ts), ein selbst gewählter Ton könnte diese Zusage nicht halten.
 * Belegte Farben sind gesperrt statt versteckt - sonst wanderten die übrigen
 * bei jeder Änderung an eine andere Stelle.
 */
function Farbwahl({
  aktuell,
  belegt,
  traegtKurve,
  onChange,
}: {
  readonly aktuell: ColorSlot
  readonly belegt: readonly ColorSlot[]
  readonly traegtKurve: boolean
  readonly onChange: (slot: ColorSlot) => void
}) {
  const t = useT()
  const genommen = new Set(belegt)
  return (
    <div className="mt-1.5 pl-1">
      {traegtKurve ? null : (
        <p className="mb-1 text-[11px] leading-snug text-[var(--text-muted)]">
          {t(
            'scenario.color.seriesEncoding',
            'Solange nur ein Szenario sichtbar ist, färbt das Diagramm nach Serie – die Farbe steht hier und im Kopf der Einstellungen.',
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
      {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((slot) => {
        const gesperrt = genommen.has(slot)
        return (
          <button
            key={slot}
            type="button"
            disabled={gesperrt}
            onClick={() => onChange(slot)}
            aria-pressed={slot === aktuell}
            title={
              gesperrt
                ? t('scenario.color.taken', 'Von einem anderen Szenario belegt')
                : undefined
            }
            aria-label={t('scenario.color.slot', `Farbe ${slot}`, { slot: String(slot) })}
            className={cn(
              'flex size-8 items-center justify-center rounded-md transition-colors',
              gesperrt ? 'cursor-not-allowed opacity-25' : 'hover:bg-[var(--surface-1)]',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-4 rounded-full',
                slot === aktuell ? 'ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--grid)]' : '',
              )}
              style={{ background: slotVar(slot) }}
            />
          </button>
        )
      })}
      </div>
    </div>
  )
}
