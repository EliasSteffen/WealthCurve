import { Copy, Eye, EyeOff, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Projection } from '../../core/projection'
import { SLOT_COUNT, slotVar } from '../../core/palette'
import { MAX_SCENARIOS, actions, type Scenario } from '../../core/state'
import { cn } from '../../lib/cn'
import { shortEur } from '../../lib/numbers'
import { useT } from '../../react/localeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import { Menu } from '../ui/Menu'

/** Name fürs Anzeigen - ein leerer Name machte zwei Szenarien ununterscheidbar. */
function anzeigeName(s: Scenario, position: number, t: ReturnType<typeof useT>): string {
  const name = s.label.trim()
  return name || t('scenario.fallbackName', `Szenario ${position}`, { n: String(position) })
}

/**
 * Szenarien als Reiter - wie Symbole in einem Terminal.
 *
 * Ein Klick wählt, was die Eingaben bearbeiten; ein Doppelklick benennt um.
 * Alles Weitere (Kopie, Farbe, Ausblenden, Löschen) steckt im Menü des Reiters.
 * Der Endwert steht im Reiter selbst, damit man ohne Umschalten vergleicht.
 */
export function ScenarioTabs({ projection }: { readonly projection: Projection }) {
  const t = useT()
  const dispatch = useDispatch()
  const scenarios = useSelector((s) => s.scenarios)
  const activeId = useSelector((s) => s.activeScenarioId)
  const [umbenennen, setUmbenennen] = useState<string | null>(null)
  const voll = scenarios.length >= MAX_SCENARIOS

  const hinzufuegen = () =>
    dispatch(
      actions.addScenario(
        t('scenario.fallbackName', `Szenario ${scenarios.length + 1}`, { n: String(scenarios.length + 1) }),
      ),
    )

  return (
    <div className="flex min-w-0 items-stretch" data-setting="scenarios">
      <div
        role="tablist"
        aria-label={t('plan.scenarios', 'Szenarien')}
        className="flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]"
        onKeyDown={(e) => {
          // Pfeile wandern zwischen den Reitern und wählen sofort - wie bei Tabs üblich.
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
          if ((e.target as HTMLElement).getAttribute('role') !== 'tab') return
          const i = scenarios.findIndex((s) => s.id === activeId)
          const ziel = scenarios[(i + (e.key === 'ArrowRight' ? 1 : -1) + scenarios.length) % scenarios.length]
          dispatch(actions.selectScenario(ziel.id))
          // Die Liste merken: nach dem Handler setzt React currentTarget zurück.
          const liste = e.currentTarget
          requestAnimationFrame(() => liste.querySelector<HTMLElement>(`[data-scenario="${ziel.id}"]`)?.focus())
        }}
      >
        {scenarios.map((s, index) => {
          const aktiv = s.id === activeId
          const name = anzeigeName(s, index + 1, t)
          const summary = projection.summaries.find((x) => x.scenarioId === s.id)
          const belegt = new Set(scenarios.filter((x) => x.id !== s.id).map((x) => x.colorSlot))
          return (
            <div
              key={s.id}
              className={cn(
                'group relative flex shrink-0 items-center border-r border-[var(--grid)]',
                aktiv ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]',
              )}
            >
              {umbenennen === s.id ? (
                <input
                  autoFocus
                  defaultValue={s.label}
                  aria-label={t('scenario.name', `Name von ${s.label}`, { name: s.label })}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    dispatch(actions.renameScenario(s.id, e.currentTarget.value))
                    setUmbenennen(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') {
                      e.currentTarget.value = s.label
                      e.currentTarget.blur()
                    }
                  }}
                  className="mx-2 h-7 w-36 rounded border border-[var(--accent-fill)] bg-[var(--surface-1)] px-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  data-scenario={s.id}
                  aria-selected={aktiv}
                  tabIndex={aktiv ? 0 : -1}
                  onClick={() => dispatch(actions.selectScenario(s.id))}
                  onDoubleClick={() => setUmbenennen(s.id)}
                  title={t('scenario.tabHint', 'Doppelklick zum Umbenennen')}
                  className="flex h-10 items-center gap-2 pl-3 pr-1 text-left"
                >
                  <span
                    aria-hidden
                    className={cn('h-2 w-2 shrink-0 rounded-[2px]', !s.visible && 'opacity-30')}
                    style={{ background: slotVar(s.colorSlot) }}
                  />
                  <span
                    className={cn(
                      'max-w-40 truncate text-xs font-semibold',
                      aktiv ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                      !s.visible && 'line-through decoration-[var(--text-muted)]',
                    )}
                  >
                    {name}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {summary ? shortEur(summary.final.balance) : t('scenario.hiddenShort', 'aus')}
                  </span>
                </button>
              )}

              <Menu
                label={t('scenario.actions', 'Aktionen für „{name}“', { name })}
                trigger={<MoreVertical size={13} aria-hidden />}
                align="start"
                triggerClassName={cn(
                  'mr-1 h-6 w-5 px-0 opacity-0 focus:opacity-100 group-hover:opacity-100',
                  aktiv && 'opacity-100',
                )}
                items={[
                  {
                    id: 'rename',
                    label: t('scenario.rename', 'Umbenennen'),
                    icon: <Pencil size={13} />,
                    onSelect: () => setUmbenennen(s.id),
                  },
                  {
                    id: 'duplicate',
                    label: t('scenario.duplicate', 'Duplizieren'),
                    icon: <Copy size={13} />,
                    disabled: voll,
                    meta: voll ? t('scenario.limitShort', `Maximal ${MAX_SCENARIOS} Szenarien`, { max: MAX_SCENARIOS }) : undefined,
                    onSelect: () =>
                      dispatch(
                        actions.duplicateScenario(s.id, t('scenario.copyName', `${s.label} (Kopie)`, { name: s.label })),
                      ),
                  },
                  {
                    id: 'visible',
                    label: s.visible ? t('scenario.hide', 'Ausblenden') : t('scenario.show', 'Einblenden'),
                    icon: s.visible ? <EyeOff size={13} /> : <Eye size={13} />,
                    onSelect: () => dispatch(actions.setScenarioVisible(s.id, !s.visible)),
                  },
                  'separator',
                  {
                    id: 'delete',
                    label: t('scenario.delete', 'Löschen'),
                    icon: <Trash2 size={13} />,
                    danger: true,
                    disabled: scenarios.length <= 1,
                    onSelect: () => {
                      // Der Fokus geht zum Nachbarn - zum nächsten, am Ende zum vorigen -, nicht ins Leere.
                      const nachbar = scenarios[index + 1] ?? scenarios[index - 1]
                      if (s.id === activeId && nachbar) dispatch(actions.selectScenario(nachbar.id))
                      dispatch(actions.removeScenario(s.id))
                      const ziel = s.id === activeId ? nachbar?.id : activeId
                      requestAnimationFrame(() =>
                        document.querySelector<HTMLElement>(`[role="tab"][data-scenario="${ziel}"]`)?.focus(),
                      )
                    },
                  },
                ]}
                extra={(close) => (
                  <div className="border-t border-[var(--grid)] px-2 pb-1 pt-2">
                    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      {t('scenario.colorLabel', 'Farbe')}
                    </div>
                    <div
                      role="group"
                      aria-label={t('scenario.color', `Farbe von ${name} ändern`, { name })}
                      className="flex gap-1.5"
                    >
                      {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          role="menuitemradio"
                          aria-checked={slot === s.colorSlot}
                          aria-label={t('scenario.colorSlot', 'Farbe {n}', { n: slot })}
                          disabled={belegt.has(slot)}
                          onClick={() => {
                            dispatch(actions.setScenarioColor(s.id, slot))
                            close()
                          }}
                          className={cn(
                            'h-4 w-4 rounded-full ring-offset-2 ring-offset-[var(--surface-1)] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-20',
                            slot === s.colorSlot && 'ring-2 ring-[var(--text-primary)]',
                          )}
                          style={{ background: slotVar(slot) }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              />

              {aktiv ? (
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: slotVar(s.colorSlot) }} />
              ) : null}
            </div>
          )
        })}
      </div>
      <button
        type="button"
        onClick={hinzufuegen}
        disabled={voll}
        aria-label={t('scenario.add', 'Szenario hinzufügen')}
        title={
          voll
            ? t('scenario.limitShort', `Maximal ${MAX_SCENARIOS} Szenarien`, { max: MAX_SCENARIOS })
            : t('scenario.add', 'Szenario hinzufügen')
        }
        className="flex w-10 shrink-0 items-center justify-center text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-30"
      >
        <Plus size={15} aria-hidden />
      </button>
    </div>
  )
}
