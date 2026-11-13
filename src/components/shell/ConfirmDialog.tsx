import { useEffect, useRef, type ReactNode } from 'react'
import { useBackdropClose } from '../../lib/backdropClose'

/**
 * Kleiner modaler Dialog für Rückfragen - nativ, also mit Fokus-Falle und
 * Escape vom Browser. Ohne `confirm` bleibt nur „Schließen".
 */
export function ConfirmDialog({
  open,
  title,
  text,
  confirm,
  cancel,
  onConfirm,
  onCancel,
  children,
}: {
  readonly open: boolean
  readonly title: string
  readonly text: string
  readonly confirm?: string
  readonly cancel: string
  readonly onConfirm?: () => void
  readonly onCancel: () => void
  readonly children?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const backdrop = useBackdropClose(ref, onCancel)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // jsdom kennt showModal nicht überall - dort genügt das open-Attribut.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      {...backdrop}
      aria-label={title}
      className="palette w-[min(26rem,calc(100vw-2rem))] p-0"
    >
      {open ? (
        <div className="p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{text}</p>
          {children}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              autoFocus={!confirm}
              className="h-8 rounded-md px-3 text-xs font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--hairline)] hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
            >
              {cancel}
            </button>
            {confirm && onConfirm ? (
              <button
                type="button"
                onClick={onConfirm}
                autoFocus
                className="h-8 rounded-md bg-[var(--accent-fill)] px-3 text-xs font-medium text-[var(--on-accent)] hover:opacity-90"
              >
                {confirm}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
