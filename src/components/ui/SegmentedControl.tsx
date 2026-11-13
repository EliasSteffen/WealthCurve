import { rovingKeyHandler } from '../../lib/rovingKeys'
import { cn } from '../../lib/cn'

const onKeyDown = rovingKeyHandler('[role="radio"]')

interface Option<T extends string> {
  readonly value: T
  readonly label: string
  readonly hint?: string
  readonly disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  readonly label?: string
  readonly value: T
  readonly options: readonly Option<T>[]
  readonly onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  /*
   * Roving tabindex: nur ein Eintrag ist per Tab erreichbar, die Pfeiltasten
   * wandern innerhalb. Ist der gewählte Eintrag deaktiviert (oder unbekannt),
   * übernimmt der erste aktive - sonst wäre die Gruppe per Tastatur unerreichbar.
   */
  const tabbable =
    options.find((o) => o.value === value && !o.disabled)?.value ??
    options.find((o) => !o.disabled)?.value

  return (
    <div>
      {label ? (
        <div className="mb-1 text-xs text-[var(--text-secondary)]">{label}</div>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-0.5 rounded-md bg-[var(--surface-2)] p-0.5 ring-1 ring-inset ring-[var(--hairline)]"
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={option.value === tabbable ? 0 : -1}
              disabled={option.disabled}
              title={option.hint}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex-1 rounded px-2 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'bg-[color-mix(in_srgb,var(--accent-fill)_10%,transparent)] text-[var(--accent-text)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                option.disabled && 'cursor-not-allowed opacity-40',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
