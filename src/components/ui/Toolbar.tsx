import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Knopf einer Werkzeugleiste - mit Text, Symbol oder beidem. */
export function ToolButton({
  children,
  onClick,
  active,
  title,
  label,
  className,
  disabled,
}: {
  readonly children: ReactNode
  readonly onClick: () => void
  /** Gesetzt, macht den Knopf zum Schalter (aria-pressed). */
  readonly active?: boolean
  readonly title?: string
  /** Für reine Symbolknöpfe: der Name für Screenreader. */
  readonly label?: string
  readonly className?: string
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
        active
          ? 'bg-[var(--grid)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--grid)] hover:text-[var(--text-primary)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Senkrechter Trenner zwischen Gruppen einer Werkzeugleiste. */
export const ToolDivider = () => <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-[var(--grid)]" />

/** Auswahl aus wenigen Werten in einer Werkzeugleiste - Zeitraum, Skala. */
export function ToolSegment<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string
  readonly options: readonly { readonly value: T; readonly label: string; readonly title?: string }[]
  readonly value: T
  readonly onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 rounded px-2 text-xs font-medium transition-colors',
            o.value === value
              ? 'text-[var(--accent-text)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--grid)] hover:text-[var(--text-primary)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
