import { Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { MAX_SCENARIOS, actions, type Scenario } from '../core/state'
import { slotVar } from '../core/palette'
import { useDispatch } from '../react/useSelector'
import { cn } from '../lib/cn'
import { Card, CardTitle } from './ui/Card'

interface ScenarioListProps {
  readonly scenarios: readonly Scenario[]
  readonly activeScenarioId: string
}

export function ScenarioList({ scenarios, activeScenarioId }: ScenarioListProps) {
  const dispatch = useDispatch()
  const atLimit = scenarios.length >= MAX_SCENARIOS

  return (
    <Card>
      <CardTitle>Szenarien</CardTitle>

      <ul className="space-y-1">
        {scenarios.map((scenario) => {
          const active = scenario.id === activeScenarioId
          return (
            <li
              key={scenario.id}
              className={cn(
                'group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                active ? 'bg-[var(--grid)]' : 'hover:bg-[var(--grid)]/60',
              )}
            >
              <span
                aria-hidden
                className={cn('size-2.5 shrink-0 rounded-full transition-opacity',
                  scenario.visible ? 'opacity-100' : 'opacity-30')}
                style={{ background: slotVar(scenario.colorSlot) }}
              />

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

              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                  label={scenario.visible ? 'Ausblenden' : 'Einblenden'}
                  onClick={() =>
                    dispatch(actions.setScenarioVisible(scenario.id, !scenario.visible))
                  }
                >
                  {scenario.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </IconButton>
                <IconButton
                  label="Duplizieren"
                  disabled={atLimit}
                  onClick={() => dispatch(actions.duplicateScenario(scenario.id))}
                >
                  <Copy size={13} />
                </IconButton>
                <IconButton
                  label="Löschen"
                  disabled={scenarios.length <= 1}
                  onClick={() => dispatch(actions.removeScenario(scenario.id))}
                >
                  <Trash2 size={13} />
                </IconButton>
              </div>
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
        Szenario hinzufügen
      </button>

      {atLimit ? (
        /* Die Grenze ist keine Willkür: die Palette hat acht auf
           Farbfehlsichtigkeit geprüfte Töne. Ein neunter wäre von einem
           vorhandenen nicht mehr zu unterscheiden. */
        <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
          {MAX_SCENARIOS} Szenarien sind das Maximum – so viele Farben lassen sich noch sicher
          unterscheiden.
        </p>
      ) : null}
    </Card>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'rounded p-1 text-[var(--text-muted)] transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-30'
          : 'hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]',
      )}
    >
      {children}
    </button>
  )
}
