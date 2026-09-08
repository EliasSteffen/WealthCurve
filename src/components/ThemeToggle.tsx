import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemePreference } from '../hooks/useTheme'
import { cn } from '../lib/cn'

const OPTIONS: readonly { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Hell', Icon: Sun },
  { value: 'dark', label: 'Dunkel', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export function ThemeToggle({
  theme,
  onChange,
}: {
  readonly theme: ThemePreference
  readonly onChange: (value: ThemePreference) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className="flex gap-0.5 rounded-lg border border-[var(--hairline)] p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            theme === value
              ? 'bg-[var(--chart-1)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--grid)]',
          )}
        >
          <Icon size={14} aria-hidden />
        </button>
      ))}
    </div>
  )
}
