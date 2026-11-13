import { Languages } from 'lucide-react'
import { LOCALES } from '../i18n'
import { rovingKeyHandler } from '../lib/rovingKeys'
import { cn } from '../lib/cn'
import { useLocale } from '../react/localeContext'

const onKeyDown = rovingKeyHandler('[role="radio"]')

export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale()
  return (
    <div
      role="radiogroup"
      aria-label={t('locale.label', 'Sprache')}
      onKeyDown={onKeyDown}
      className="flex gap-0.5 rounded-md bg-[var(--surface-2)] p-0.5 ring-1 ring-inset ring-[var(--hairline)] items-center"
    >
      <Languages size={13} aria-hidden className="mx-1 text-[var(--text-muted)]" />
      {LOCALES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={locale === id}
          tabIndex={locale === id ? 0 : -1}
          aria-label={label}
          title={label}
          onClick={() => setLocale(id)}
          className={cn(
            'rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase transition-colors',
            locale === id
              ? 'bg-[color-mix(in_srgb,var(--accent-fill)_10%,transparent)] text-[var(--accent-text)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          )}
        >
          {id}
        </button>
      ))}
    </div>
  )
}
