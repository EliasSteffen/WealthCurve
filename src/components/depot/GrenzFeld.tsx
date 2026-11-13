import { useState } from 'react'
import { cn } from '../../lib/cn'
import { currentFormatterLocale } from '../../lib/format'

const EINGABE =
  'rounded-md border border-[var(--hairline)] bg-[var(--surface-1)] px-2 py-1 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent-fill)] focus:outline-none'

/** Prozentfeld, das leer sein darf: leer = keine Grenze. */
export function GrenzFeld({
  value,
  label,
  onCommit,
}: {
  readonly value: number | null
  readonly label: string
  readonly onCommit: (value: number | null) => void
}) {
  const [entwurf, setEntwurf] = useState<string | null>(null)
  const anzeige =
    entwurf ??
    (value === null ? '' : (value * 100).toLocaleString(currentFormatterLocale(), { maximumFractionDigits: 1 }))
  const uebernehmen = () => {
    if (entwurf === null) return
    const text = entwurf.trim().replace('%', '').replace(',', '.')
    if (text === '') onCommit(null)
    else {
      const zahl = Number.parseFloat(text)
      if (Number.isFinite(zahl) && zahl >= 0 && zahl <= 100) onCommit(zahl / 100)
    }
    setEntwurf(null)
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        inputMode="decimal"
        aria-label={label}
        value={anzeige}
        placeholder="–"
        onChange={(e) => setEntwurf(e.target.value)}
        onBlur={uebernehmen}
        onKeyDown={(e) => {
          if (e.key === 'Enter') uebernehmen()
          if (e.key === 'Escape') setEntwurf(null)
        }}
        className={cn(EINGABE, 'w-14 text-right tabular-nums')}
      />
      <span aria-hidden className="text-xs text-[var(--text-muted)]">
        %
      </span>
    </span>
  )
}
