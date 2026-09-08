import { useId } from 'react'

interface Option {
  readonly value: string
  readonly label: string
  readonly description?: string
}

interface SelectFieldProps {
  readonly label: string
  readonly value: string
  readonly options: readonly Option[]
  readonly onChange: (value: string) => void
}

/**
 * Natives <select>. Bei fünf und mehr Optionen ist es einem Segmented-Control
 * überlegen: es bleibt in einer schmalen Spalte lesbar und bringt auf
 * Mobilgeräten die Auswahl des Systems mit.
 */
export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const id = useId()
  const active = options.find((o) => o.value === value)

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] px-2.5 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--chart-1)] focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {active?.description ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
          {active.description}
        </p>
      ) : null}
    </div>
  )
}
