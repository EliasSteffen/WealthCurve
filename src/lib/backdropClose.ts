import { useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react'

/**
 * Backdrop-Klick schließt ein <dialog> nur, wenn Drücken UND Loslassen auf dem
 * Backdrop passierten.
 *
 * Prüft man nur `e.target === dialog` beim click, schließt der Dialog, sobald
 * man Text im Inhalt markiert und die Maus über dem Backdrop loslässt: der
 * click-Event landet dann auf dem gemeinsamen Vorfahren - dem <dialog>.
 * Deshalb merken wir uns, wo das pointerdown stattfand.
 */
export function useBackdropClose(dialogRef: RefObject<HTMLDialogElement | null>, close: () => void) {
  const downOnBackdrop = useRef(false)
  return {
    onPointerDown: (e: PointerEvent<HTMLDialogElement>) => {
      downOnBackdrop.current = e.target === dialogRef.current
    },
    onClick: (e: MouseEvent<HTMLDialogElement>) => {
      const ok = downOnBackdrop.current && e.target === dialogRef.current
      downOnBackdrop.current = false
      if (ok) close()
    },
  }
}
