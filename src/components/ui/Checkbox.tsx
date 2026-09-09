import { useId } from 'react'
import { cn } from '../../lib/cn'

interface CheckboxProps {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly label: string
  readonly description?: string
  /** Farbschlüssel der Serie - trägt die Identität neben dem Text. */
  readonly colorVar?: string
}

/**
 * Schalter, bei dem die ganze Zeile das Ziel ist.
 *
 * Das Kästchen selbst misst 16 px und liegt damit unter dem Minimum, das sich
 * zuverlässig treffen lässt. Padding am `<input>` hilft nicht - native
 * Checkboxen ignorieren es. Umschließt das Label dagegen Kästchen, Text und
 * Beschreibung, löst ein Klick irgendwo in der Zeile den Schalter aus.
 */
export function Checkbox({ checked, onChange, label, description, colorVar }: CheckboxProps) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none items-start gap-2.5 py-1.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--chart-1)]"
      />
      <span>
        <span className="flex items-center gap-2">
          {colorVar ? (
            <span
              aria-hidden
              className={cn(
                'h-0.5 w-4 shrink-0 rounded-full transition-opacity',
                checked ? 'opacity-100' : 'opacity-30',
              )}
              style={{ background: colorVar }}
            />
          ) : null}
          <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        </span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}
