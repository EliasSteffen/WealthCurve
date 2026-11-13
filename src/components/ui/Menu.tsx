import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

const EINTRAG = '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)'

export interface MenuItem {
  readonly id: string
  readonly label: string
  readonly icon?: ReactNode
  readonly onSelect: () => void
  readonly danger?: boolean
  readonly disabled?: boolean
  /** Kurzer Zusatz rechts - Tastenkürzel, Zustand. */
  readonly meta?: string
}

/**
 * Ein Aufklappmenü: Knopf auf, Liste darunter.
 *
 * Tastatur wie bei einem Menü üblich - Pfeile wandern, Enter wählt, Escape
 * schließt und gibt den Fokus an den Knopf zurück. Ein Klick daneben schließt
 * ebenfalls.
 */
export function Menu({
  label,
  trigger,
  items,
  align = 'end',
  triggerClassName,
  extra,
}: {
  /** Name des Knopfs für Screenreader (und Tooltip). */
  readonly label: string
  readonly trigger: ReactNode
  readonly items: readonly (MenuItem | 'separator')[]
  readonly align?: 'start' | 'end'
  readonly triggerClassName?: string
  /**
   * Zusätzlicher Inhalt unter den Einträgen, etwa eine Farbauswahl. Knöpfe mit
   * role="menuitemradio" darin wandern mit den Pfeiltasten mit.
   */
  readonly extra?: (close: () => void) => ReactNode
}) {
  const [offen, setOffen] = useState(false)
  // Lage am Bildschirm statt im Elternelement: ein Menü in einer scrollenden Leiste würde sonst abgeschnitten.
  const [lage, setLage] = useState<{ top: number; left?: number; right?: number } | null>(null)
  const knopfRef = useRef<HTMLButtonElement>(null)
  const listeRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!offen) return
    listeRef.current?.querySelector<HTMLButtonElement>(EINTRAG)?.focus()
    const daneben = (e: PointerEvent) => {
      const ziel = e.target as Node
      if (!listeRef.current?.contains(ziel) && !knopfRef.current?.contains(ziel)) setOffen(false)
    }
    // Scrollt oder wächst die Seite, stimmt die Lage nicht mehr - dann lieber zu.
    const zu = (e: Event) => {
      if (e.type === 'scroll' && listeRef.current?.contains(e.target as Node)) return
      setOffen(false)
    }
    document.addEventListener('pointerdown', daneben)
    window.addEventListener('resize', zu)
    window.addEventListener('scroll', zu, true)
    return () => {
      document.removeEventListener('pointerdown', daneben)
      window.removeEventListener('resize', zu)
      window.removeEventListener('scroll', zu, true)
    }
  }, [offen])

  const oeffnen = () => {
    const r = knopfRef.current?.getBoundingClientRect()
    if (r) {
      setLage(
        align === 'end'
          ? { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) }
          : { top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 200) },
      )
    }
    setOffen(true)
  }

  const schliessen = () => {
    setOffen(false)
    knopfRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const eintraege = [
      ...(listeRef.current?.querySelectorAll<HTMLButtonElement>(EINTRAG) ?? []),
    ]
    const i = eintraege.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      schliessen()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      eintraege[(i + 1) % eintraege.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      eintraege[(i - 1 + eintraege.length) % eintraege.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      eintraege[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      eintraege.at(-1)?.focus()
    } else if (e.key === 'Tab') {
      setOffen(false)
    }
  }

  return (
    <div className="relative">
      <button
        ref={knopfRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? id : undefined}
        aria-label={label}
        title={label}
        onClick={() => (offen ? setOffen(false) : oeffnen())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !offen) {
            e.preventDefault()
            oeffnen()
          }
        }}
        className={cn(
          'inline-flex h-7 items-center justify-center gap-1 rounded px-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]',
          offen && 'bg-[var(--grid)] text-[var(--text-primary)]',
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {offen ? (
        <div
          ref={listeRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          style={lage ?? undefined}
          className={cn(
            'fixed z-50 min-w-48 rounded-md border border-[var(--hairline)] bg-[var(--surface-1)] p-1 shadow-[0_12px_32px_rgb(0_0_0/0.25)]',
            !lage && (align === 'end' ? 'right-2 top-12' : 'left-2 top-12'),
          )}
        >
          {items.map((item, i) =>
            item === 'separator' ? (
              <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-[var(--grid)]" />
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOffen(false)
                  item.onSelect()
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors focus:outline-none disabled:opacity-40',
                  'hover:bg-[var(--grid)] focus:bg-[var(--grid)]',
                  item.danger ? 'text-[var(--down)]' : 'text-[var(--text-primary)]',
                )}
              >
                {item.icon ? <span className="flex w-4 shrink-0 justify-center text-[var(--text-muted)]">{item.icon}</span> : null}
                <span className="flex-1 truncate">{item.label}</span>
                {item.meta ? <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{item.meta}</span> : null}
              </button>
            ),
          )}
          {extra?.(() => setOffen(false))}
        </div>
      ) : null}
    </div>
  )
}
