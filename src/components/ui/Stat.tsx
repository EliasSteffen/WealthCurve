interface StatProps {
  readonly label: string
  readonly value: string
  readonly detail?: string
  readonly accentVar?: string
}

/**
 * Stat-Tile: Label, Wert, optionales Detail. Proportionale Ziffern - tabular-nums
 * lässt grosse Zahlen locker wirken und gehört in Tabellenspalten, nicht hierhin.
 */
export function Stat({ label, value, detail, accentVar }: StatProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {accentVar ? (
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: accentVar }} />
        ) : null}
        <span className="truncate text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
        {value}
      </div>
      {detail ? (
        <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{detail}</div>
      ) : null}
    </div>
  )
}
