/**
 * Die Kategorien der Einstellungen.
 *
 * Bewusst in einer eigenen Datei ohne Importe: die Parameter-Registry ordnet
 * sich diesen Kategorien zu, und `settings/index.ts` liest umgekehrt die
 * Registry. Läge der Typ dort, entstünde ein Zyklus.
 *
 * Gegliedert nach dem, was der Nutzer tut - einzahlen, auszahlen -, nicht nach
 * der Einheit der Zahl. „Sparrate" und „Ansparphase" gehören zusammen, auch
 * wenn die eine in Euro und die andere in Jahren gemessen wird.
 *
 * Lieber viele schlanke Karten als wenige volle: eine Kategorie „Generell"
 * wurde zwangsläufig zum Sammelbecken für alles, was nirgends sonst passte,
 * und stand am Ende bei neun Bedienelementen. Hier hat keine mehr als vier.
 */
export type SettingsCategoryId =
  | 'szenarien'
  | 'kapital'
  | 'einzahlung'
  | 'auszahlung'
  | 'kurven'
  | 'zeit'
  | 'wertpapiere'
  | 'annahmen'

export interface SettingsCategory {
  readonly id: SettingsCategoryId
  readonly label: string
  readonly hint: string
  /**
   * Nur in der vollen Ansicht sichtbar.
   *
   * Nicht „unwichtig", sondern „selten angefasst" - wer die Sparrate dreht,
   * ändert nicht nebenbei die Zinskonvention.
   */
  readonly advanced?: boolean
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  { id: 'szenarien', label: 'Szenarien', hint: 'Anlegen, vergleichen, ein- und ausblenden' },
  { id: 'kapital', label: 'Kapital', hint: 'Rendite und Startkapital' },
  { id: 'einzahlung', label: 'Einzahlung', hint: 'Sparrate und Ansparphase' },
  { id: 'auszahlung', label: 'Auszahlung', hint: 'Entnahme und Entnahmephase' },
  { id: 'kurven', label: 'Kurven', hint: 'Welche Serien, welcher Stil' },
  { id: 'zeit', label: 'Zeit', hint: 'Alter, Startjahr, Achsenbeschriftung', advanced: true },
  { id: 'wertpapiere', label: 'Wertpapiere', hint: 'Echte Kursverläufe laden', advanced: true },
  { id: 'annahmen', label: 'Annahmen', hint: 'Inflation, Tagesgeld, Rechenweise', advanced: true },
]

export const SETTINGS_CATEGORY_IDS: readonly SettingsCategoryId[] = SETTINGS_CATEGORIES.map(
  (c) => c.id,
)

/**
 * Wie viel die Oberfläche zeigt.
 *
 * „kompakt" ist die Vorgabe: die Karten, an denen man wirklich dreht. Alles
 * Weitere ist einen Klick entfernt, nicht verschwunden. Die Suche hebt die
 * Einschränkung auf - wer sucht, will finden, nicht gefiltert werden.
 */
export type SettingsView = 'kompakt' | 'alles'
export const SETTINGS_VIEWS: readonly SettingsView[] = ['kompakt', 'alles']
