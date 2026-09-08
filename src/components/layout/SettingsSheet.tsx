import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SettingsPanel } from './SettingsPanel'

/**
 * Einstellungen als Bottom-Sheet für kleine Viewports.
 *
 * Nutzt das native <dialog> mit showModal(): Fokus-Falle, ESC zum Schließen,
 * Backdrop und Scroll-Sperre kommen damit vom Browser statt aus einer
 * Bibliothek. Die Animation liegt in index.css (@starting-style).
 *
 * Der Auslöser ist eine Leiste am unteren Rand der App-Shell, kein schwebender
 * Knopf: als Flex-Geschwister der Inhaltsspalte kann er nichts überdecken.
 * Ein schwebender Knopf liegt dagegen zwangsläufig über scrollendem Inhalt.
 */
export function SettingsSheet() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      <div className="shrink-0 border-t border-[var(--hairline)] bg-[var(--surface-1)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Einstellungen öffnen"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--chart-1)] px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        >
          <SlidersHorizontal size={16} aria-hidden />
          Einstellungen
        </button>
      </div>

      <dialog
        ref={dialogRef}
        // ESC und Backdrop-Klick melden 'close' - der State muss nachziehen.
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false)
        }}
        className="settings-sheet"
        aria-label="Einstellungen"
      >
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Einstellungen</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Schließen"
            className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {open ? <SettingsPanel /> : null}
        </div>
      </dialog>
    </>
  )
}
