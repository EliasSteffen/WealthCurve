import { useId, useState } from 'react'
import { cn } from '../../lib/cn'

interface NumberFieldProps {
  readonly label: string
  /** `null` heißt „nicht gesetzt" - ein gültiger Zustand, nicht 0. */
  readonly value: number | null
  readonly min: number
  readonly max: number
  readonly placeholder: string
  readonly onChange: (value: number | null) => void
}

/**
 * Optionales Zahlenfeld, dessen Grenzen erst beim Verlassen greifen.
 *
 * Der Rohtext gilt, solange das Feld den Fokus hat, und wird erst bei `blur`
 * oder Enter übernommen. Ohne das lässt sich ein Feld mit Untergrenze gar nicht
 * tippen: „1990" durchläuft die Zwischenstände 1, 19, 199, und jeder davon wird
 * beim Übernehmen auf die Untergrenze hochgezogen - das Feld sprang zwischen
 * 1900 und 2100 und ließ nichts anderes zu.
 *
 * `SliderField` übernimmt dagegen absichtlich schon beim Tippen: dort zieht der
 * Regler mit, und sein Wertebereich macht jeden Zwischenstand gültig.
 */
export function NumberField({ label, value, min, max, placeholder, onChange }: NumberFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (roh: string) => {
    const text = roh.trim()
    if (text === '') {
      onChange(null)
      return
    }
    const zahl = Number.parseInt(text, 10)
    onChange(Number.isFinite(zahl) ? zahl : null)
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-[var(--text-secondary)]">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? (value === null ? '' : String(value))}
        placeholder={placeholder}
        onFocus={() => setDraft(value === null ? '' : String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          commit(e.target.value)
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={cn(
          'h-8 w-full rounded-md border border-transparent bg-[var(--surface-2)] px-2',
          'text-[13px] font-medium text-[var(--text-primary)] placeholder:font-normal placeholder:text-[var(--text-muted)]',
          'hover:border-[var(--hairline)] focus:border-[var(--accent-fill)] focus:outline-none',
        )}
      />
    </div>
  )
}
