import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemePreference } from '../hooks/useTheme'
import { rovingKeyHandler } from '../lib/rovingKeys'
import { cn } from '../lib/cn'
import { useT } from '../react/localeContext'

const OPTIONS: readonly { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Hell', Icon: Sun },
  { value: 'dark', label: 'Dunkel', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

const onKeyDown = rovingKeyHandler('[role="radio"]')

export function ThemeToggle({
  theme,
  onChange,
}: {
  readonly theme: ThemePreference
  readonly onChange: (value: ThemePreference) => void
}) {
  const t = useT()
  return (
    <div
      role="radiogroup"
      aria-label={t('theme.label', 'Farbschema')}
      onKeyDown={onKeyDown}
      className="flex gap-0.5 rounded-md bg-[var(--surface-2)] p-0.5 ring-1 ring-inset ring-[var(--hairline)]"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          tabIndex={theme === value ? 0 : -1}
          aria-label={t(`theme.${value}`, label)}
          title={t(`theme.${value}`, label)}
          onClick={() => onChange(value)}
          className={cn(
            'rounded p-1 transition-colors',
            theme === value
              ? 'bg-[color-mix(in_srgb,var(--accent-fill)_10%,transparent)] text-[var(--accent-text)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          )}
        >
          <Icon size={13} aria-hidden />
        </button>
      ))}
    </div>
  )
}
