import { useId, useState } from 'react'
import type { ParamDefinition } from '../../core/domain/parameters'
import { cn } from '../../lib/cn'
import { formatParamValue, parseGermanNumber } from '../../lib/format'

interface SliderFieldProps {
  readonly definition: ParamDefinition
  readonly value: number
  readonly onChange: (value: number) => void
}

export function SliderField({ definition, value, onChange }: SliderFieldProps) {
  const id = useId()
  // Während des Tippens gilt der Rohtext. Sonst würde "4," sofort zu "4"
  // normalisiert und das Komma wäre nicht eingebbar.
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string) => {
    const parsed = parseGermanNumber(raw)
    if (!Number.isNaN(parsed)) onChange(parsed)
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-[var(--text-secondary)]">
          {definition.label}
        </label>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft ?? formatParamValue(value, definition.unit)}
          onFocus={() => setDraft(String(value).replace('.', ','))}
          onChange={(e) => {
            setDraft(e.target.value)
            commit(e.target.value)
          }}
          onBlur={(e) => {
            commit(e.target.value)
            setDraft(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className={cn(
            'w-28 rounded-md border border-transparent bg-transparent px-1.5 py-0.5',
            'text-right text-sm font-semibold tabular-nums text-[var(--text-primary)]',
            'hover:border-[var(--hairline)] focus:border-[var(--chart-1)] focus:outline-none',
          )}
        />
      </div>

      <input
        type="range"
        aria-label={definition.label}
        min={definition.min}
        max={definition.max}
        step={definition.step}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--grid)] accent-[var(--chart-1)]"
      />

      {definition.hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{definition.hint}</p>
      ) : null}
    </div>
  )
}
