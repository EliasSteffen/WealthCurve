import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/*
 * Die kleinen Bausteine des Terminals: dicht, kantig, Zahlen in Tabellenziffern.
 */

/** Knopf der Werkzeugleiste - mit Text, Symbol oder beidem. */
export function ToolButton({
  children,
  onClick,
  active,
  title,
  label,
  className,
}: {
  readonly children: ReactNode
  readonly onClick: () => void
  readonly active?: boolean
  readonly title?: string
  /** Für reine Symbolknöpfe: der Name für Screenreader. */
  readonly label?: string
  readonly className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors',
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

/** Senkrechter Trenner zwischen Gruppen der Werkzeugleiste. */
export const ToolDivider = () => <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-[var(--grid)]" />

/** Auswahl aus wenigen Werten - Zeitraum, Skala. */
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
            'h-7 rounded px-2 text-xs font-medium tabular-nums transition-colors',
            o.value === value
              ? 'text-[var(--accent-text,var(--accent-fill))]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--grid)] hover:text-[var(--text-primary)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Überschrift eines Abschnitts in der Seitenspalte. */
export function SectionTitle({ children, action }: { readonly children: ReactNode; readonly action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{children}</h3>
      {action}
    </div>
  )
}

/** Zeile „Bezeichnung … Wert" der Detailtabellen. */
export function KeyValue({
  label,
  value,
  tone,
  hint,
}: {
  readonly label: string
  readonly value: string
  readonly tone?: 'up' | 'down'
  readonly hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-[3px] text-xs" title={hint}>
      <dt className="truncate text-[var(--text-secondary)]">{label}</dt>
      <dd
        className="m-0 shrink-0 font-medium tabular-nums text-[var(--text-primary)]"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}
