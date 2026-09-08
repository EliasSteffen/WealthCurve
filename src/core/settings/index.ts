import { CHART_STYLES } from '../chart-style'
import type { ParamDefinition } from '../domain/parameters'
import { PARAMETERS, PARAM_IDS, TIMELINE_FIELDS, TIMELINE_FIELD_IDS } from '../domain/parameters'
import { SERIES } from '../domain/series'
import { WITHDRAWAL_STRATEGIES } from '../domain/withdrawal'

/**
 * Suchindex über alle Einstellungen.
 *
 * Wird aus den vorhandenen Registries abgeleitet, nicht von Hand gepflegt: eine
 * neue Serie, ein neuer Parameter oder ein neuer Stil taucht dadurch
 * automatisch in Kategorie und Suche auf.
 */

export type SettingsCategoryId = 'szenarien' | 'werte' | 'zeitraum' | 'kurven' | 'berechnung'

export interface SettingsCategory {
  readonly id: SettingsCategoryId
  readonly label: string
  readonly hint: string
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  { id: 'szenarien', label: 'Szenarien', hint: 'Anlegen, vergleichen, ein- und ausblenden' },
  { id: 'werte', label: 'Werte', hint: 'Sparrate, Rendite, Entnahme' },
  { id: 'zeitraum', label: 'Zeitraum', hint: 'Anspar- und Entnahmephase' },
  { id: 'kurven', label: 'Kurven', hint: 'Welche Serien, welcher Stil' },
  { id: 'berechnung', label: 'Berechnung', hint: 'Zinsmodus und Entnahmeregel' },
]

export interface SettingsEntry {
  /** Stabile ID, nach der die Oberfläche filtert. */
  readonly id: string
  readonly category: SettingsCategoryId
  readonly label: string
  readonly keywords: readonly string[]
}

/** Von Hand gepflegt, weil diese Schalter kein eigenes Registry haben. */
const STATISCH: readonly SettingsEntry[] = [
  {
    id: 'scenarios',
    category: 'szenarien',
    label: 'Szenarien',
    keywords: ['szenario', 'vergleich', 'variante', 'duplizieren', 'farbe'],
  },
  {
    id: 'style',
    category: 'kurven',
    label: 'Darstellung',
    keywords: ['stil', 'aussehen', 'design', 'look', 'gezeichnet', 'skizze', 'minimal'],
  },
  {
    id: 'model:compounding',
    category: 'berechnung',
    label: 'Zinsmodus',
    keywords: ['zins', 'effektiv', 'nominal', 'jährlich', 'verzinsung', 'konvention'],
  },
  {
    id: 'model:timing',
    category: 'berechnung',
    label: 'Zeitpunkt der Sparrate',
    keywords: ['vorschüssig', 'nachschüssig', 'monatsanfang', 'monatsende', 'timing'],
  },
  {
    id: 'model:amountsInflationAdjusted',
    category: 'berechnung',
    label: 'Beträge inflationsbereinigt',
    keywords: ['inflation', 'kaufkraft', 'real', 'nominal', 'teuerung', 'betrag'],
  },
  {
    id: 'model:withdrawalRule',
    category: 'berechnung',
    label: 'Entnahmeregel',
    keywords: ['entnahme', 'regel', 'prozentregel', 'fester betrag', '4 prozent', 'rente'],
  },
]

export function buildSettingsIndex(): readonly SettingsEntry[] {
  return [
    ...STATISCH,
    // `as const satisfies` verengt die Registry-Typen so stark, dass optionale
    // Felder je Eintrag verschwinden - hier auf die gemeinsame Form zurueck.
    ...PARAM_IDS.map((id) => {
      const def: ParamDefinition = PARAMETERS[id]
      return {
        id: `param:${id}`,
        category: 'werte' as SettingsCategoryId,
        label: def.label,
        keywords: [def.hint ?? '', def.group, id],
      }
    }),
    ...TIMELINE_FIELD_IDS.map((id) => {
      const def: ParamDefinition = TIMELINE_FIELDS[id]
      return {
        id: `timeline:${id}`,
        category: 'zeitraum' as SettingsCategoryId,
        label: def.label,
        keywords: [def.hint ?? '', 'laufzeit', 'jahre', id],
      }
    }),
    ...SERIES.map((s) => ({
      id: `series:${s.id}`,
      category: 'kurven' as SettingsCategoryId,
      label: s.label,
      keywords: [s.description, 'serie', 'kurve', s.id],
    })),
    ...CHART_STYLES.map((s) => ({
      id: 'style',
      category: 'kurven' as SettingsCategoryId,
      label: s.label,
      keywords: [s.description, 'stil'],
    })),
    ...WITHDRAWAL_STRATEGIES.map((s) => ({
      id: 'model:withdrawalRule',
      category: 'berechnung' as SettingsCategoryId,
      label: s.label,
      keywords: [s.description, 'entnahme'],
    })),
  ]
}

/** Ohne Akzente und Kleinbuchstaben - "Jaehrlich" soll "jährlich" finden. */
function normalisieren(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
}

/**
 * IDs, die zur Suche passen. `null` bedeutet: keine Suche aktiv, alles zeigen.
 *
 * Bewusst einfache Teilstring-Suche über Label und Schlagworte - bei rund
 * zwanzig Einstellungen wäre eine unscharfe Suche mehr Aufwand als Nutzen.
 */
export function matchSettings(
  index: readonly SettingsEntry[],
  query: string,
): ReadonlySet<string> | null {
  const q = normalisieren(query.trim())
  if (q.length === 0) return null
  const treffer = new Set<string>()
  for (const entry of index) {
    const heuhaufen = normalisieren([entry.label, ...entry.keywords].join(' '))
    if (heuhaufen.includes(q)) treffer.add(entry.id)
  }
  return treffer
}

/** Welche Kategorien nach der Suche überhaupt noch etwas zeigen. */
export function matchingCategories(
  index: readonly SettingsEntry[],
  matches: ReadonlySet<string> | null,
): ReadonlySet<SettingsCategoryId> {
  if (matches === null) return new Set(SETTINGS_CATEGORIES.map((c) => c.id))
  const kategorien = new Set<SettingsCategoryId>()
  for (const entry of index) if (matches.has(entry.id)) kategorien.add(entry.category)
  return kategorien
}
