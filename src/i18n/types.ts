export type Locale = 'de' | 'en'

export const LOCALES: readonly { id: Locale; label: string; intl: string }[] = [
  { id: 'de', label: 'Deutsch', intl: 'de-DE' },
  { id: 'en', label: 'English', intl: 'en-US' },
]

/**
 * Übersetzungen als flache Schlüssel-Wert-Liste.
 *
 * Deutsch ist die Ausgangssprache und braucht keinen Katalog: die Texte stehen
 * im Code und in den Registries. Der Katalog überschreibt sie nur.
 */
export type Catalog = Readonly<Record<string, string>>
