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
 */
export type SettingsCategoryId =
  | 'szenarien'
  | 'generell'
  | 'einzahlung'
  | 'auszahlung'
  | 'kurven'

export interface SettingsCategory {
  readonly id: SettingsCategoryId
  readonly label: string
  readonly hint: string
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  { id: 'szenarien', label: 'Szenarien', hint: 'Anlegen, vergleichen, ein- und ausblenden' },
  { id: 'generell', label: 'Generell', hint: 'Rendite, Startkapital, Rechenweise' },
  { id: 'einzahlung', label: 'Einzahlung', hint: 'Sparrate und Ansparphase' },
  { id: 'auszahlung', label: 'Auszahlung', hint: 'Entnahme und Entnahmephase' },
  { id: 'kurven', label: 'Kurven', hint: 'Welche Serien, welcher Stil' },
]

export const SETTINGS_CATEGORY_IDS: readonly SettingsCategoryId[] = SETTINGS_CATEGORIES.map(
  (c) => c.id,
)
