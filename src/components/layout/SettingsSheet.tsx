import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SettingsPanel } from './SettingsPanel'

/**
 * Einstellungen als Bottom-Sheet für kleine Viewports.
 *
 * Nutzt das native <dialog> mit showModal(): Fokus-Falle, ESC zum Schließen,
 * Backdrop und Scroll-Sperre kommen damit vom Browser statt aus einer
 * Bibliothek. Die Animation liegt in index.css (@starting-style).
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Einstellungen öffnen"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[var(--chart-1)] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform active:scale-95"
      >
        <SlidersHorizontal size={16} aria-hidden />
        Einstellungen
      </button>

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
        <div className="overflow-y-auto overscroll-contain p-4">
          <SettingsPanel />
        </div>
      </dialog>
    </>
  )
}
