import { Languages } from 'lucide-react'
import { LOCALES } from '../i18n'
import { cn } from '../lib/cn'
import { useLocale } from '../react/localeContext'

export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale()
  return (
    <div
      role="radiogroup"
      aria-label={t('locale.label', 'Sprache')}
      className="flex items-center gap-0.5 rounded-lg border border-[var(--hairline)] p-0.5"
    >
      <Languages size={13} aria-hidden className="mx-1 text-[var(--text-muted)]" />
      {LOCALES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={locale === id}
          aria-label={label}
          title={label}
          onClick={() => setLocale(id)}
          className={cn(
            'rounded-md px-1.5 py-1 text-[11px] font-semibold uppercase transition-colors',
            locale === id
              ? 'bg-[var(--chart-1)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--grid)]',
          )}
        >
          {id}
        </button>
      ))}
    </div>
  )
}
