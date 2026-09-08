import { cn } from '../../lib/cn'

interface Option<T extends string> {
  readonly value: T
  readonly label: string
  readonly hint?: string
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
  return (
    <div>
      {label ? (
        <div className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">{label}</div>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label}
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
              title={option.hint}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--chart-1)]',
                selected
                  ? 'bg-[var(--chart-1)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--grid)]',
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
