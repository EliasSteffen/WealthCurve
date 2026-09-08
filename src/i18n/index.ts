import { en } from './en'
import { LOCALES, type Catalog, type Locale } from './types'

const CATALOGS: Readonly<Record<Locale, Catalog>> = {
  // Deutsch ist die Ausgangssprache - die Texte stehen im Code selbst.
  de: {},
  en,
}

const STORAGE_KEY = 'zinseszins.locale'

export function detectLocale(): Locale {
  try {
    const gespeichert = localStorage.getItem(STORAGE_KEY)
    if (gespeichert === 'de' || gespeichert === 'en') return gespeichert
  } catch {
    // Privater Modus oder blockierte Site-Daten - die Browsersprache traegt.
  }
  const sprache = typeof navigator !== 'undefined' ? navigator.language : 'de'
  return sprache.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Nicht persistierbar ist kein Fehler - die Wahl gilt fuer diese Sitzung.
  }
}

export function intlLocale(locale: Locale): string {
  return LOCALES.find((l) => l.id === locale)?.intl ?? 'de-DE'
}

export type Translate = (key: string, fallback: string, vars?: Record<string, string | number>) => string

/**
 * Uebersetzt einen Schluessel.
 *
 * `fallback` ist der deutsche Originaltext. Fehlt ein Katalogeintrag, bleibt er
 * stehen - eine Luecke zeigt damit lesbaren Text statt eines rohen Schluessels.
 */
export function createTranslate(locale: Locale): Translate {
  const katalog = CATALOGS[locale] ?? {}
  return (key, fallback, vars) => {
    let text = katalog[key] ?? fallback
    if (vars) {
      for (const [name, wert] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(wert))
      }
    }
    return text
  }
}

export { LOCALES } from './types'
export type { Catalog, Locale } from './types'
