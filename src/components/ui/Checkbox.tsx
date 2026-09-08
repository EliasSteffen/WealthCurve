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

export function Checkbox({ checked, onChange, label, description, colorVar }: CheckboxProps) {
  const id = useId()
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--chart-1)]"
      />
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="flex items-center gap-2">
          {colorVar ? (
            <span
              aria-hidden
              className={cn('h-0.5 w-4 shrink-0 rounded-full transition-opacity',
                checked ? 'opacity-100' : 'opacity-30')}
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
      </label>
    </div>
  )
}
