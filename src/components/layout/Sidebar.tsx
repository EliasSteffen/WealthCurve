import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { actions } from '../../core/state'
import { useDispatch, useSelector } from '../../react/useSelector'
import { SettingsPanel } from './SettingsPanel'

/**
 * Desktop-Sidebar mit eigenem Scroll.
 *
 * `sticky` + `h-[100dvh]` + `overflow-y-auto` geben ihr eine eigene
 * Scrollfläche; `overscroll-contain` verhindert, dass der Scroll am Ende der
 * Liste auf die Seite überspringt. Beides zusammen macht die Spalte unabhängig
 * von der rechten.
 */
export function Sidebar() {
  const collapsed = useSelector((s) => s.sidebarCollapsed)
  const dispatch = useDispatch()

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => dispatch(actions.setSidebarCollapsed(false))}
        aria-label="Einstellungen einblenden"
        aria-expanded={false}
        title="Einstellungen einblenden"
        className="sticky top-6 flex h-24 w-7 items-center justify-center self-start rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
      >
        <PanelLeftOpen size={15} aria-hidden />
      </button>
    )
  }

  return (
    <aside className="sticky top-0 max-h-[100dvh] self-start overflow-y-auto overscroll-contain py-6 pr-1">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => dispatch(actions.setSidebarCollapsed(true))}
          aria-label="Einstellungen ausblenden"
          aria-expanded
          title="Einstellungen ausblenden"
          className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
        >
          <PanelLeftClose size={15} aria-hidden />
        </button>
      </div>
      <SettingsPanel />
    </aside>
  )
}
