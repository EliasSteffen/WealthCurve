import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { actions } from '../../core/state'
import { useDispatch, useSelector } from '../../react/useSelector'
import { SettingsPanel } from './SettingsPanel'

/**
 * Desktop-Seitenspalte mit eigenem Scroll.
 *
 * Sie sitzt in einem Flex-Container fester Höhe; `overflow-y-auto` macht sie
 * zur eigenen Scrollfläche und `overscroll-contain` verhindert, dass der Scroll
 * am Listenende auf die Nachbarspalte überspringt. Beides zusammen macht die
 * Spalte unabhängig von der rechten.
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
        className="my-4 ml-4 flex h-24 w-9 shrink-0 items-center justify-center self-start rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
      >
        <PanelLeftOpen size={16} aria-hidden />
      </button>
    )
  }

  return (
    <aside className="w-80 shrink-0 overflow-y-auto overscroll-contain border-r border-[var(--hairline)] p-4">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => dispatch(actions.setSidebarCollapsed(true))}
          aria-label="Einstellungen ausblenden"
          aria-expanded
          title="Einstellungen ausblenden"
          className="flex size-9 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
        >
          <PanelLeftClose size={16} aria-hidden />
        </button>
      </div>
      <SettingsPanel />
    </aside>
  )
}
