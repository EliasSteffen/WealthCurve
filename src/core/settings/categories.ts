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
 * Wo eine Einstellung gespeichert wird.
 *
 * Der Unterschied ist im Modell scharf - `SimulationParams` hängen am Szenario,
 * `ModelSettings` am ganzen Zustand -, war in der Oberfläche aber unsichtbar:
 * Sparrate und Ansparphase standen in derselben Karte, obwohl die eine nur
 * dieses Szenario betrifft und die andere alle. Wer dann ein zweites Szenario
 * anlegte, musste raten, welche Hälfte der Werte mitwandert.
 *
 * Ein Satz Hinweistext reichte dafür nicht; es braucht zwei getrennte Bereiche.
 */
export type SettingsScope = 'scenario' | 'global'
export const SETTINGS_SCOPES: readonly SettingsScope[] = ['scenario', 'global']

export interface SettingsScopeMeta {
  readonly id: SettingsScope
  readonly label: string
  readonly hint: string
}

export const SETTINGS_SCOPE_META: readonly SettingsScopeMeta[] = [
  {
    id: 'scenario',
    label: 'Nur dieses Szenario',
    hint: 'Wird im Szenario gespeichert. Ein zweites Szenario kann hier andere Werte haben.',
  },
  {
    id: 'global',
    label: 'Für alle Szenarien',
    hint: 'Gilt für jede Kurve im Diagramm. Ohne gemeinsame Achse gäbe es nichts zu vergleichen.',
  },
]

/**
 * Eine Karte ist ein Paar aus Bereich und Kategorie.
 *
 * „Einzahlung" gibt es dadurch zweimal - einmal mit der Sparrate im Szenario,
 * einmal mit der Ansparphase darüber hinaus. Das ist gewollt: die Kategorie
 * sagt, worum es geht, der Bereich, für wen es gilt.
 */
export type SettingsCardId = `${SettingsScope}:${SettingsCategoryId}`

export function cardId(scope: SettingsScope, category: SettingsCategoryId): SettingsCardId {
  return `${scope}:${category}`
}

export const SETTINGS_CARD_IDS: readonly SettingsCardId[] = SETTINGS_SCOPES.flatMap((scope) =>
  SETTINGS_CATEGORY_IDS.map((category) => cardId(scope, category)),
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
