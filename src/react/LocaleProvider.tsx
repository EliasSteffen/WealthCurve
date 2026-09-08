import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createTranslate, detectLocale, intlLocale, persistLocale, type Locale } from '../i18n'
import { setFormatterLocale } from '../lib/format'
import { LocaleContext } from './localeContext'

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    persistLocale(next)
  }, [])

  const value = useMemo(() => {
    /*
     * Die Sprache MUSS hier gesetzt werden und nicht in einem Effekt: Effekte
     * laufen nach dem Rendern, die Kinder formatierten sonst noch mit der alten
     * Sprache und blieben bis zum nächsten Render falsch. Der Aufruf ist
     * idempotent und der Provider die einzige Stelle, die ihn macht.
     */
    setFormatterLocale(intlLocale(locale))
    return { locale, setLocale, t: createTranslate(locale) }
  }, [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
