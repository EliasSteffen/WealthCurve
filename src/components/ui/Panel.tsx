import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/*
 * Die Flächen des Terminals. Panels stoßen ohne Abstand aneinander; die
 * Trennlinie entsteht aus einem 1-px-Spalt über der Seitenfarbe (gap-px auf
 * dem Eltern-Container). Keine Schatten, keine runden Karten.
 */

export function Panel({
  children,
  className,
  label,
}: {
  readonly children: ReactNode
  readonly className?: string
  /** Macht das Panel zu einer benannten Region für Screenreader. */
  readonly label?: string
}) {
  return (
    <section aria-label={label} className={cn('min-w-0 bg-[var(--surface-1)]', className)}>
      {children}
    </section>
  )
}

/** Kopfzeile eines Panels: kleine Versalien links, Aktionen rechts. */
export function PanelHeader({
  title,
  children,
  className,
}: {
  readonly title: ReactNode
  readonly children?: ReactNode
  readonly className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[var(--grid)] px-3',
        className,
      )}
    >
      <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</h2>
      {children ? <div className="flex shrink-0 items-center gap-0.5">{children}</div> : null}
    </div>
  )
}

/** Überschrift eines Abschnitts innerhalb eines Panels. */
export function SectionTitle({
  children,
  action,
  id,
}: {
  readonly children: ReactNode
  readonly action?: ReactNode
  readonly id?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
      <h3 id={id} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {children}
      </h3>
      {action}
    </div>
  )
}

/** Zeile „Bezeichnung … Wert" einer Kennzahlenliste - gehört in ein <dl>. */
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
        className="m-0 shrink-0 font-medium text-[var(--text-primary)]"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}

/** Eine Kennzahl im Kopf einer Seite: Bezeichnung klein darüber, Wert darunter. */
export function HeadStat({
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
    <div className="min-w-0 border-l border-[var(--grid)] pl-3" title={hint}>
      <div className="truncate text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div
        className="truncate text-[13px] font-medium text-[var(--text-primary)]"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </div>
    </div>
  )
}
