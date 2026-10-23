import { CHART_STYLES } from '../chart-style/index.ts'
import type { ParamDefinition } from '../domain/parameters.ts'
import { PARAMETERS, PARAM_IDS, TIMELINE_FIELDS, TIMELINE_FIELD_IDS } from '../domain/parameters.ts'
import { SERIES } from '../domain/series/index.ts'
import { WITHDRAWAL_STRATEGIES } from '../domain/withdrawal/index.ts'
import {
  SETTINGS_CATEGORIES,
  cardId,
  type SettingsCardId,
  type SettingsCategoryId,
  type SettingsScope,
} from './categories.ts'

/**
 * Suchindex über alle Einstellungen.
 *
 * Wird aus den vorhandenen Registries abgeleitet, nicht von Hand gepflegt: eine
 * neue Serie, ein neuer Parameter oder ein neuer Stil taucht dadurch
 * automatisch in Kategorie und Suche auf.
 */

export {
  SETTINGS_CARD_IDS,
  SETTINGS_CATEGORIES,
  SETTINGS_CATEGORY_IDS,
  SETTINGS_SCOPES,
  SETTINGS_SCOPE_META,
  cardId,
} from './categories.ts'
export type {
  SettingsCardId,
  SettingsCategory,
  SettingsCategoryId,
  SettingsScope,
  SettingsScopeMeta,
} from './categories.ts'

export interface SettingsEntry {
  /** Stabile ID, nach der die Oberfläche filtert. */
  readonly id: string
  readonly category: SettingsCategoryId
  /**
   * Ob der Wert im Szenario oder darüber hinaus gespeichert wird.
   *
   * Für die abgeleiteten Einträge fällt das nicht als Meinung an, sondern
   * ergibt sich aus der Quelle: PARAMETERS gehört zum Szenario, alles andere
   * liegt daneben im Zustand.
   */
  readonly scope: SettingsScope
  readonly label: string
  readonly keywords: readonly string[]
  /** Nur in der vollen Ansicht sichtbar - selten angefasst, nicht unwichtig. */
  readonly advanced?: boolean
}

/** Von Hand gepflegt, weil diese Schalter kein eigenes Registry haben. */
const STATISCH: readonly SettingsEntry[] = [
  {
    id: 'scenarios',
    category: 'szenarien',
    scope: 'global',
    label: 'Szenarien',
    keywords: ['szenario', 'vergleich', 'variante', 'duplizieren', 'farbe'],
  },
  {
    id: 'market',
    category: 'wertpapiere',
    scope: 'global',
    advanced: true,
    label: 'Wertpapier',
    keywords: ['aktie', 'etf', 'kurs', 'yahoo', 'symbol', 'ticker', 'index', 'historie'],
  },
  {
    id: 'style',
    category: 'kurven',
    scope: 'global',
    advanced: true,
    label: 'Darstellung',
    keywords: ['stil', 'aussehen', 'design', 'look', 'gezeichnet', 'skizze', 'minimal'],
  },
  {
    id: 'model:compounding',
    category: 'annahmen',
    scope: 'global',
    advanced: true,
    label: 'Zinsmodus',
    keywords: ['zins', 'effektiv', 'nominal', 'jährlich', 'verzinsung', 'konvention'],
  },
  {
    // Gehört zur Einzahlung, nicht zur Rechenweise: der Schalter entscheidet,
    // wann die Sparrate fließt, nicht wie verzinst wird.
    id: 'model:timing',
    category: 'einzahlung',
    scope: 'global',
    advanced: true,
    label: 'Zeitpunkt der Sparrate',
    keywords: ['vorschüssig', 'nachschüssig', 'monatsanfang', 'monatsende', 'timing'],
  },
  {
    id: 'model:timeAxis',
    category: 'zeit',
    scope: 'global',
    advanced: true,
    label: 'Zeitachse, Alter, Startjahr und -monat',
    keywords: [
      'alter',
      'startjahr',
      'startmonat',
      'monat',
      'kalender',
      'jahreszahl',
      'achse',
      'zeit',
      'rentenbeginn',
      'geburtsjahr',
    ],
  },
  {
    id: 'model:amountsInflationAdjusted',
    category: 'annahmen',
    scope: 'global',
    advanced: true,
    label: 'Beträge inflationsbereinigt',
    keywords: ['inflation', 'kaufkraft', 'real', 'nominal', 'teuerung', 'betrag'],
  },
  {
    id: 'model:withdrawalRule',
    category: 'auszahlung',
    scope: 'global',
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
        category: def.category,
        // Parameter sind je Szenario gespeichert - das ist keine Zuordnung von
        // Hand, sondern die Bauart von SimulationParams.
        scope: 'scenario' as SettingsScope,
        advanced: def.advanced,
        label: def.label,
        keywords: [def.hint ?? '', def.group, id],
      }
    }),
    ...TIMELINE_FIELD_IDS.map((id) => {
      const def: ParamDefinition = TIMELINE_FIELDS[id]
      return {
        id: `timeline:${id}`,
        category: def.category,
        scope: 'global' as SettingsScope,
        advanced: def.advanced,
        label: def.label,
        keywords: [def.hint ?? '', 'laufzeit', 'jahre', id],
      }
    }),
    ...SERIES.map((s) => ({
      id: `series:${s.id}`,
      category: 'kurven' as SettingsCategoryId,
      scope: 'global' as SettingsScope,
      label: s.label,
      keywords: [s.description, 'serie', 'kurve', s.id],
    })),
    ...CHART_STYLES.map((s) => ({
      id: 'style',
      category: 'kurven' as SettingsCategoryId,
      scope: 'global' as SettingsScope,
      advanced: true,
      label: s.label,
      keywords: [s.description, 'stil'],
    })),
    ...WITHDRAWAL_STRATEGIES.map((s) => ({
      id: 'model:withdrawalRule',
      category: 'auszahlung' as SettingsCategoryId,
      scope: 'global' as SettingsScope,
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

/**
 * Welche Karten nach der Filterung überhaupt noch etwas zeigen.
 *
 * Auch ohne Suche wird abgeleitet statt aufgezählt: es gibt keine Karte
 * „Kapital, für alle Szenarien", weil kein einziger Eintrag dort hineinfällt.
 * Eine leere Karte wäre schlimmer als keine - sie behauptet, es gäbe dort etwas.
 */
export function matchingCards(
  index: readonly SettingsEntry[],
  matches: ReadonlySet<string> | null,
): ReadonlySet<SettingsCardId> {
  const karten = new Set<SettingsCardId>()
  for (const entry of index) {
    if (matches !== null && !matches.has(entry.id)) continue
    karten.add(cardId(entry.scope, entry.category))
  }
  return karten
}

/**
 * Die IDs, die in der kompakten Ansicht sichtbar bleiben.
 *
 * Gibt eine Menge zurueck, keine `null` - damit laeuft sie durch dieselbe
 * Filterung wie ein Suchergebnis, und die Anzeige-Komponenten brauchen keinen
 * zweiten Weg zu kennen.
 */
export function compactIds(index: readonly SettingsEntry[]): ReadonlySet<string> {
  const fortgeschritten = new Set(
    SETTINGS_CATEGORIES.filter((c) => c.advanced).map((c) => c.id),
  )
  const sichtbar = new Set<string>()
  for (const entry of index) {
    if (entry.advanced || fortgeschritten.has(entry.category)) continue
    sichtbar.add(entry.id)
  }
  return sichtbar
}
