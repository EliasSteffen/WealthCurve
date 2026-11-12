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
        <div className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">{label}</div>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-0.5 rounded-lg border border-[var(--hairline)] p-0.5"
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
                'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--chart-1)]',
                selected
                  ? 'bg-[var(--accent-fill)] text-[var(--on-accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--grid)]',
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
