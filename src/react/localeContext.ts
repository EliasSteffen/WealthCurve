import { createContext, useContext } from 'react'
import { createTranslate, type Locale, type Translate } from '../i18n'

export interface LocaleValue {
  readonly locale: Locale
  readonly setLocale: (locale: Locale) => void
  readonly t: Translate
}

export const LocaleContext = createContext<LocaleValue>({
  locale: 'de',
  setLocale: () => {},
  t: createTranslate('de'),
})

export function useLocale(): LocaleValue {
  return useContext(LocaleContext)
}

/** Kurzform für den häufigsten Fall. */
export function useT(): Translate {
  return useContext(LocaleContext).t
}
