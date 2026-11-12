import { CHART_STYLES, DEFAULT_CHART_STYLE_ID } from './chart-style/index.ts'
import { AUTO_ENCODING, ENCODINGS } from './encoding/index.ts'
import { DEFAULT_MODEL } from './domain/math.ts'
import { TIME_AXIS_MODES, sanitizeModel } from './domain/model.ts'
import {
  DEFAULT_PARAMS,
  sanitizeParam,
  sanitizeTimelineField,
  type ParamId,
  type SimulationParams,
  type TimelineFieldId,
} from './domain/parameters.ts'
import { DEFAULT_ENABLED_SERIES, SERIES } from './domain/series/index.ts'
import type { MarketSeries, ModelSettings } from './domain/types.ts'
import type { GoalTarget } from './depot/goals.ts'
import { sanitizeDepot, sanitizeGoals } from './depot/sanitize.ts'
import { EMPTY_DEPOT, MAX_HOLDINGS, type DepotHolding, type DepotState } from './depot/types.ts'
import { MIN_MONATE } from './market.ts'
import { SLOT_COUNT, allocateSlot, type ColorSlot } from './palette.ts'
import {
  SETTINGS_CARD_IDS,
  SETTINGS_VIEWS,
  type SettingsCardId,
  type SettingsView,
} from './settings/categories.ts'

export interface Scenario {
  readonly id: string
  readonly label: string
  readonly params: SimulationParams
  readonly visible: boolean
  /** Fest vergeben, nie aus der Position abgeleitet. */
  readonly colorSlot: ColorSlot
}

export type EncodingPreference = 'auto' | string

/** Die Bereiche der Anwendung: der Sparplan mit Vermögenskurve, das eigene Depot und das Video. */
export type AppPage = 'sparplan' | 'depot' | 'video'

export const APP_PAGES: readonly AppPage[] = ['sparplan', 'depot', 'video']

export interface AppState {
  readonly scenarios: readonly Scenario[]
  /** Welches Szenario die Regler gerade bearbeiten. */
  readonly activeScenarioId: string
  readonly enabledSeriesIds: readonly string[]
  readonly model: ModelSettings
  readonly encoding: EncodingPreference
  readonly chartStyleId: string
  readonly sidebarCollapsed: boolean
  /**
   * Zugeklappte Einstellungs-Karten, als "bereich:kategorie".
   *
   * Gehoert in den Store und nicht in den Komponenten-State: das Bottom-Sheet
   * montiert das Panel bei jedem Oeffnen neu, lokaler State waere danach jedes
   * Mal vergessen.
   *
   * Der Schluessel traegt den Bereich mit, weil es "Einzahlung" zweimal gibt -
   * einmal je Szenario, einmal darueber hinaus. Ohne ihn klappten beide Karten
   * gemeinsam zu, obwohl sie nichts miteinander zu tun haben.
   */
  readonly collapsedCards: readonly SettingsCardId[]
  /**
   * Wie viel die Einstellungen zeigen.
   *
   * "kompakt" ist die Vorgabe - die Karten, an denen man wirklich dreht.
   * Der Rest ist einen Klick entfernt, nicht verschwunden.
   */
  readonly settingsView: SettingsView
  /**
   * Geladene Kursverlaeufe fuer die Serie "Kursverlauf" - einer je Wertpapier.
   *
   * Begrenzt durch MAX_MARKETS: jede Kurve braucht einen eigenen Farb-Slot, und
   * die Palette hat acht, die sie sich mit den Szenarien teilt.
   */
  readonly markets: readonly MarketSeries[]
  /**
   * Das eigene Depot für die Depot-Analyse, samt Was-wäre-wenn-Anteilen.
   *
   * Bleibt im Browser: der Teilen-Link lässt es weg (siehe persistence.ts),
   * Bestände gehen niemanden etwas an, der nur die Kurve sehen soll.
   */
  readonly depot: DepotState
  /** Welcher Bereich offen ist - bleibt über ein Neuladen erhalten, nicht im Teilen-Link. */
  readonly page: AppPage
}

let counter = 0
/** Stabile ID ohne Abhängigkeit; randomUUID ist nicht überall verfügbar. */
export function createId(): string {
  counter += 1
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `s${counter}-${random}`
}

interface ScenarioDraft {
  readonly label?: string
  /** Teilangabe genügt; der Rest kommt aus den Defaults. */
  readonly params?: Partial<SimulationParams>
  readonly visible?: boolean
  readonly colorSlot: ColorSlot
}

export function createScenario(partial: ScenarioDraft): Scenario {
  return {
    id: createId(),
    label: partial.label ?? 'Szenario',
    params: { ...DEFAULT_PARAMS, ...partial.params },
    visible: partial.visible ?? true,
    colorSlot: partial.colorSlot,
  }
}

export function createInitialState(): AppState {
  const first = createScenario({ label: 'Basis', colorSlot: 1 })
  return {
    scenarios: [first],
    activeScenarioId: first.id,
    enabledSeriesIds: DEFAULT_ENABLED_SERIES,
    // Der erste Blick zeigt das Ansparen. Eine Entnahmephase ab Werk beantwortete
    // eine Frage, die noch niemand gestellt hat ("Kapital reicht"), und ließ die
    // Kurve am Ende wieder fallen - sie ist einen Schalter entfernt.
    model: { ...DEFAULT_MODEL, withdrawalYears: 0 },
    encoding: 'auto',
    chartStyleId: DEFAULT_CHART_STYLE_ID,
    sidebarCollapsed: false,
    collapsedCards: [],
    settingsView: 'kompakt',
    markets: [],
    depot: EMPTY_DEPOT,
    page: 'sparplan',
  }
}

export const MAX_SCENARIOS = SLOT_COUNT

/**
 * Wie viele Wertpapiere gleichzeitig.
 *
 * Vier lassen der Palette noch vier Slots fuer Szenarien. Mehr waere technisch
 * moeglich, aber ab dem neunten Farbton sind Kurven unter Farbfehlsichtigkeit
 * nicht mehr zu trennen - siehe palette.ts.
 */
export const MAX_MARKETS = 4

/** Bleibt von hier aus erreichbar; die Definition liegt beim Modell-Bereiniger. */
export { TIME_AXIS_MODES }

/* ------------------------------------------------------------------ Actions */

export type Action =
  | { type: 'scenario/add'; label?: string; params?: Partial<SimulationParams> }
  | { type: 'scenario/duplicate'; id: string; label?: string }
  | { type: 'scenario/remove'; id: string }
  | { type: 'scenario/rename'; id: string; label: string }
  | { type: 'scenario/setVisible'; id: string; visible: boolean }
  | { type: 'scenario/setColor'; id: string; slot: ColorSlot }
  | { type: 'scenario/select'; id: string }
  | { type: 'scenario/setParam'; id: string; paramId: ParamId; value: number }
  | { type: 'series/toggle'; id: string }
  | { type: 'series/setEnabled'; id: string; enabled: boolean }
  | { type: 'model/set'; model: ModelSettings }
  | { type: 'model/setTimeline'; field: TimelineFieldId; value: number }
  | { type: 'encoding/set'; encoding: EncodingPreference }
  | { type: 'chartStyle/set'; id: string }
  | { type: 'market/add'; market: MarketSeries }
  | { type: 'market/remove'; symbol: string }
  | { type: 'depot/set'; holdings: readonly DepotHolding[]; value?: number | null }
  | { type: 'depot/setGoals'; goals: readonly GoalTarget[] }
  | { type: 'depot/setValue'; value: number | null }
  | { type: 'depot/setWhatIf'; whatIf: Readonly<Record<string, number>> | null }
  | { type: 'depot/setWhatIfWeight'; id: string; weight: number }
  | { type: 'depot/updateHolding'; id: string; patch: Partial<Omit<DepotHolding, 'id'>> }
  | { type: 'page/set'; page: AppPage }
  | { type: 'sidebar/setCollapsed'; collapsed: boolean }
  | { type: 'settings/toggleCard'; id: SettingsCardId }
  | { type: 'settings/setView'; view: SettingsView }
  | { type: 'state/replace'; state: AppState }
  | { type: 'state/reset' }

export const actions = {
  addScenario: (label?: string, params?: Partial<SimulationParams>): Action => ({
    type: 'scenario/add',
    label,
    params,
  }),
  // `label` kommt aus der Oberfläche (übersetzt); ohne ihn bleibt es beim deutschen Standard.
  duplicateScenario: (id: string, label?: string): Action => ({
    type: 'scenario/duplicate',
    id,
    label,
  }),
  removeScenario: (id: string): Action => ({ type: 'scenario/remove', id }),
  renameScenario: (id: string, label: string): Action => ({ type: 'scenario/rename', id, label }),
  setScenarioVisible: (id: string, visible: boolean): Action => ({
    type: 'scenario/setVisible',
    id,
    visible,
  }),
  setScenarioColor: (id: string, slot: ColorSlot): Action => ({
    type: 'scenario/setColor',
    id,
    slot,
  }),
  selectScenario: (id: string): Action => ({ type: 'scenario/select', id }),
  setParam: (id: string, paramId: ParamId, value: number): Action => ({
    type: 'scenario/setParam',
    id,
    paramId,
    value,
  }),
  toggleSeries: (id: string): Action => ({ type: 'series/toggle', id }),
  setSeriesEnabled: (id: string, enabled: boolean): Action => ({
    type: 'series/setEnabled',
    id,
    enabled,
  }),
  setModel: (model: ModelSettings): Action => ({ type: 'model/set', model }),
  setTimeline: (field: TimelineFieldId, value: number): Action => ({
    type: 'model/setTimeline',
    field,
    value,
  }),
  setEncoding: (encoding: EncodingPreference): Action => ({ type: 'encoding/set', encoding }),
  setChartStyle: (id: string): Action => ({ type: 'chartStyle/set', id }),
  addMarket: (market: MarketSeries): Action => ({ type: 'market/add', market }),
  removeMarket: (symbol: string): Action => ({ type: 'market/remove', symbol }),
  /** `value`: Depotwert aus dem Import; ohne Angabe bleibt der bisherige. */
  setDepot: (holdings: readonly DepotHolding[], value?: number | null): Action => ({
    type: 'depot/set',
    holdings,
    value,
  }),
  setDepotGoals: (goals: readonly GoalTarget[]): Action => ({ type: 'depot/setGoals', goals }),
  setDepotValue: (value: number | null): Action => ({ type: 'depot/setValue', value }),
  setDepotWhatIf: (whatIf: Readonly<Record<string, number>> | null): Action => ({
    type: 'depot/setWhatIf',
    whatIf,
  }),
  setDepotWhatIfWeight: (id: string, weight: number): Action => ({
    type: 'depot/setWhatIfWeight',
    id,
    weight,
  }),
  updateDepotHolding: (id: string, patch: Partial<Omit<DepotHolding, 'id'>>): Action => ({
    type: 'depot/updateHolding',
    id,
    patch,
  }),
  setPage: (page: AppPage): Action => ({ type: 'page/set', page }),
  setSidebarCollapsed: (collapsed: boolean): Action => ({
    type: 'sidebar/setCollapsed',
    collapsed,
  }),
  toggleSettingsCard: (id: SettingsCardId): Action => ({
    type: 'settings/toggleCard',
    id,
  }),
  setSettingsView: (view: SettingsView): Action => ({ type: 'settings/setView', view }),
  replaceState: (state: AppState): Action => ({ type: 'state/replace', state }),
  reset: (): Action => ({ type: 'state/reset' }),
}

/* ------------------------------------------------------------------ Reducer */

const mapScenario = (
  state: AppState,
  id: string,
  update: (scenario: Scenario) => Scenario,
): AppState => {
  const index = state.scenarios.findIndex((s) => s.id === id)
  if (index === -1) return state
  const next = update(state.scenarios[index])
  if (Object.is(next, state.scenarios[index])) return state
  const scenarios = [...state.scenarios]
  scenarios[index] = next
  return { ...state, scenarios }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'scenario/add': {
      const slot = allocateSlot(state.scenarios.map((s) => s.colorSlot))
      // Kein freier Slot mehr - lieber nichts tun als eine Farbe wiederholen.
      if (slot === null) return state
      const scenario = createScenario({
        label: action.label ?? `Szenario ${state.scenarios.length + 1}`,
        params: action.params,
        colorSlot: slot,
      })
      return {
        ...state,
        scenarios: [...state.scenarios, scenario],
        activeScenarioId: scenario.id,
      }
    }

    case 'scenario/duplicate': {
      const source = state.scenarios.find((s) => s.id === action.id)
      if (!source) return state
      const slot = allocateSlot(state.scenarios.map((s) => s.colorSlot))
      if (slot === null) return state
      const copy = createScenario({
        label: action.label ?? `${source.label} (Kopie)`,
        params: source.params,
        visible: source.visible,
        colorSlot: slot,
      })
      const index = state.scenarios.findIndex((s) => s.id === action.id)
      const scenarios = [...state.scenarios]
      scenarios.splice(index + 1, 0, copy)
      return { ...state, scenarios, activeScenarioId: copy.id }
    }

    case 'scenario/remove': {
      // Das letzte Szenario bleibt stehen - ohne eines gäbe es nichts zu zeigen.
      if (state.scenarios.length <= 1) return state
      const scenarios = state.scenarios.filter((s) => s.id !== action.id)
      if (scenarios.length === state.scenarios.length) return state
      return {
        ...state,
        scenarios,
        activeScenarioId:
          state.activeScenarioId === action.id ? scenarios[0].id : state.activeScenarioId,
      }
    }

    case 'scenario/rename':
      return mapScenario(state, action.id, (s) => ({ ...s, label: action.label }))

    case 'scenario/setVisible':
      return mapScenario(state, action.id, (s) => ({ ...s, visible: action.visible }))

    case 'scenario/setColor': {
      /*
       * Nur eine der acht geprüften Farben, und keine zweimal.
       *
       * Die Palette ist auf Farbfehlsichtigkeit geprüft (siehe palette.ts) -
       * eine frei gewählte Farbe könnte diese Zusage nicht halten. Und zwei
       * Szenarien in derselben Farbe wären im Diagramm nicht zu trennen, was
       * den ganzen Vergleich wertlos machte.
       */
      if (!Number.isInteger(action.slot) || action.slot < 1 || action.slot > SLOT_COUNT) {
        return state
      }
      if (state.scenarios.some((s) => s.id !== action.id && s.colorSlot === action.slot)) {
        return state
      }
      return mapScenario(state, action.id, (s) =>
        s.colorSlot === action.slot ? s : { ...s, colorSlot: action.slot },
      )
    }

    case 'scenario/select':
      return state.scenarios.some((s) => s.id === action.id)
        ? { ...state, activeScenarioId: action.id }
        : state

    case 'scenario/setParam':
      return mapScenario(state, action.id, (s) => ({
        ...s,
        params: { ...s.params, [action.paramId]: sanitizeParam(action.paramId, action.value) },
      }))

    case 'series/toggle': {
      if (!SERIES.some((s) => s.id === action.id)) return state
      const enabled = state.enabledSeriesIds.includes(action.id)
      return {
        ...state,
        enabledSeriesIds: enabled
          ? state.enabledSeriesIds.filter((id) => id !== action.id)
          : [...state.enabledSeriesIds, action.id],
      }
    }

    case 'series/setEnabled': {
      // Anders als 'toggle' idempotent: zwei fast gleichzeitig fertige
      // Ladevorgaenge duerfen sich nicht gegenseitig wieder ausschalten.
      if (!SERIES.some((s) => s.id === action.id)) return state
      if (state.enabledSeriesIds.includes(action.id) === action.enabled) return state
      return {
        ...state,
        enabledSeriesIds: action.enabled
          ? [...state.enabledSeriesIds, action.id]
          : state.enabledSeriesIds.filter((id) => id !== action.id),
      }
    }

    case 'model/set':
      // Dieselbe Bereinigung wie beim Einlesen. Ein geleertes Zahlenfeld liefert
      // NaN, daraus wird "kein Anker" - und Unsinn erreicht das Modell nie.
      return { ...state, model: sanitizeModel(action.model) }

    case 'model/setTimeline':
      return {
        ...state,
        model: { ...state.model, [action.field]: sanitizeTimelineField(action.field, action.value) },
      }

    case 'encoding/set':
      return { ...state, encoding: action.encoding }

    case 'chartStyle/set':
      return state.chartStyleId === action.id ? state : { ...state, chartStyleId: action.id }

    case 'market/add': {
      // Dasselbe Papier zweimal waere zwei identische Kurven in zwei Farben -
      // stattdessen die vorhandene Reihe ersetzen, die neue ist die frischere.
      const vorhanden = state.markets.findIndex((m) => m.symbol === action.market.symbol)
      if (vorhanden !== -1) {
        const markets = [...state.markets]
        markets[vorhanden] = action.market
        return { ...state, markets }
      }
      // Kein Farb-Slot mehr frei - lieber nichts tun als eine Farbe wiederholen.
      if (state.markets.length >= MAX_MARKETS) return state
      return { ...state, markets: [...state.markets, action.market] }
    }

    case 'market/remove': {
      const markets = state.markets.filter((m) => m.symbol !== action.symbol)
      return markets.length === state.markets.length ? state : { ...state, markets }
    }

    case 'depot/set':
      // Neue Bestände machen alte Was-wäre-wenn-Anteile bedeutungslos - die Ziele bleiben.
      return {
        ...state,
        depot: {
          ...state.depot,
          holdings: action.holdings.slice(0, MAX_HOLDINGS),
          whatIf: null,
          value: action.value !== undefined && action.value !== null ? action.value : state.depot.value,
        },
      }

    case 'depot/setGoals':
      return { ...state, depot: { ...state.depot, goals: sanitizeGoals(action.goals) } }

    case 'depot/setValue': {
      const value =
        action.value !== null && Number.isFinite(action.value) && action.value > 0 ? action.value : null
      return state.depot.value === value ? state : { ...state, depot: { ...state.depot, value } }
    }

    case 'depot/setWhatIf':
      return { ...state, depot: { ...state.depot, whatIf: action.whatIf } }

    case 'depot/updateHolding': {
      const index = state.depot.holdings.findIndex((h) => h.id === action.id)
      if (index === -1) return state
      // Durch dieselbe Prüfung wie gespeicherte Daten: ein Symbol aus einem
      // Eingabefeld ist nicht vertrauenswürdiger als eines aus dem Browser-Speicher.
      const geprueft = sanitizeDepot({ holdings: [{ ...state.depot.holdings[index], ...action.patch }] })
        .holdings[0]
      if (!geprueft) return state
      const holdings = [...state.depot.holdings]
      holdings[index] = geprueft
      // Anteile bleiben, also bleibt auch die Was-wäre-wenn-Variante gültig.
      return { ...state, depot: { ...state.depot, holdings } }
    }

    case 'page/set':
      // Nur bekannte Bereiche - ein erfundener ließe die Oberfläche ohne Inhalt.
      return state.page === action.page || !APP_PAGES.includes(action.page)
        ? state
        : { ...state, page: action.page }

    case 'depot/setWhatIfWeight': {
      const { holdings, whatIf } = state.depot
      if (!holdings.some((h) => h.id === action.id) || !Number.isFinite(action.weight)) return state
      // Der erste Eingriff startet vom heutigen Depot, nicht von leeren Anteilen.
      const basis = whatIf ?? Object.fromEntries(holdings.map((h) => [h.id, h.weight]))
      return {
        ...state,
        depot: { ...state.depot, whatIf: { ...basis, [action.id]: Math.max(0, action.weight) } },
      }
    }

    case 'sidebar/setCollapsed':
      return state.sidebarCollapsed === action.collapsed
        ? state
        : { ...state, sidebarCollapsed: action.collapsed }

    case 'settings/setView':
      return state.settingsView === action.view ? state : { ...state, settingsView: action.view }

    case 'settings/toggleCard': {
      // Gleiche Form wie 'series/toggle': unbekannte IDs prallen ab, statt eine
      // Karte zu erfinden, die es nicht gibt.
      if (!SETTINGS_CARD_IDS.includes(action.id)) return state
      const zu = state.collapsedCards.includes(action.id)
      return {
        ...state,
        collapsedCards: zu
          ? state.collapsedCards.filter((id) => id !== action.id)
          : [...state.collapsedCards, action.id],
      }
    }

    case 'state/replace':
      return action.state

    case 'state/reset':
      return createInitialState()

    default:
      return state
  }
}

/* ------------------------------------------------------------ Serialisierung */

/** Für Persistenz, URL-Sharing oder einen späteren MCP-Server. */
export function serialize(state: AppState): string {
  return JSON.stringify(state)
}


const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Szenarien einlesen: begrenzt, mit eindeutigen IDs und eindeutigen Farb-Slots. */
function sanitizeScenarios(list: readonly unknown[]): Scenario[] {
  const entries = list.slice(0, SLOT_COUNT).map((raw) => (isRecord(raw) ? raw : {}))
  // Zuerst alle gueltigen Slots reservieren, damit ein ungueltiger keinen davon
  // wegnimmt - sonst verloere ein sauberer Zustand beim Einlesen eine Farbe.
  const used = new Set<number>()
  const slots = entries.map((s) => {
    const slot = s.colorSlot
    if (typeof slot !== 'number' || !Number.isInteger(slot)) return null
    if (slot < 1 || slot > SLOT_COUNT || used.has(slot)) return null
    used.add(slot)
    return slot
  })
  const ids = new Set<string>()
  return entries.map((s, index) => {
    // Doppelte IDs lenkten Auswahl und Reducer immer auf das erste Szenario.
    let id = typeof s.id === 'string' && s.id !== '' ? s.id : createId()
    while (ids.has(id)) id = createId()
    ids.add(id)
    // Hoechstens SLOT_COUNT Eintraege: ein freier Slot ist immer vorhanden.
    let colorSlot = slots[index]
    if (colorSlot === null) {
      colorSlot = allocateSlot(used) ?? 1
      used.add(colorSlot)
    }
    const params = isRecord(s.params) ? s.params : {}
    return {
      id,
      label: typeof s.label === 'string' ? s.label : `Szenario ${index + 1}`,
      visible: s.visible !== false,
      colorSlot,
      // Jeden Wert durch dieselbe Bereinigung schicken wie eine Eingabe - fremdes
      // JSON darf keine NaN in die Simulation tragen.
      params: Object.fromEntries(
        Object.entries(DEFAULT_PARAMS).map(([key, fallback]) => [
          key,
          sanitizeParam(key as ParamId, (params[key] ?? fallback) as number),
        ]),
      ) as SimulationParams,
    }
  })
}

function sanitizeMarkets(list: readonly unknown[]): MarketSeries[] {
  const markets: MarketSeries[] = []
  for (const m of list) {
    if (markets.length >= MAX_MARKETS) break
    if (!isRecord(m) || typeof m.symbol !== 'string' || !Array.isArray(m.monthlyReturns)) continue
    const symbol = m.symbol
    if (markets.some((x) => x.symbol === symbol)) continue
    // Eine Reihe ohne brauchbare Renditen zeichnet nichts und faende sich nie
    // wieder aus dem Zustand heraus - deshalb hier aussortieren statt aufheben.
    const monthlyReturns = m.monthlyReturns.filter(
      (r): r is number => typeof r === 'number' && Number.isFinite(r),
    )
    if (monthlyReturns.length < MIN_MONATE) continue
    markets.push({
      symbol,
      name: typeof m.name === 'string' ? m.name : symbol,
      currency: typeof m.currency === 'string' ? m.currency : '',
      start: typeof m.start === 'string' ? m.start : '',
      monthlyReturns,
    })
  }
  return markets
}

export function deserialize(raw: string): AppState | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) {
      return null
    }
    const base = createInitialState()
    const scenarios = sanitizeScenarios(parsed.scenarios)
    // Feld fuer Feld statt `...parsed`: unbekannte Schluessel haetten sonst
    // ungeprueft im Zustand gelandet.
    return {
      scenarios,
      activeScenarioId: scenarios.some((s) => s.id === parsed.activeScenarioId)
        ? (parsed.activeScenarioId as string)
        : scenarios[0].id,
      enabledSeriesIds: Array.isArray(parsed.enabledSeriesIds)
        ? (parsed.enabledSeriesIds as unknown[]).filter(
            (id, i, all): id is string =>
              SERIES.some((s) => s.id === id) && all.indexOf(id) === i,
          )
        : base.enabledSeriesIds,
      model: sanitizeModel(parsed.model),
      encoding:
        parsed.encoding === AUTO_ENCODING || ENCODINGS.some((e) => e.id === parsed.encoding)
          ? (parsed.encoding as string)
          : base.encoding,
      chartStyleId: CHART_STYLES.some((c) => c.id === parsed.chartStyleId)
        ? (parsed.chartStyleId as string)
        : base.chartStyleId,
      sidebarCollapsed:
        typeof parsed.sidebarCollapsed === 'boolean'
          ? parsed.sidebarCollapsed
          : base.sidebarCollapsed,
      // Nur bekannte Karten uebernehmen - eine erfundene ID bliebe sonst fuer
      // immer im Zustand stehen und liesse sich durch nichts mehr loesen. Das
      // faengt zugleich die alten Schluessel ohne Bereich ab: sie fallen hier
      // heraus, und alle Karten stehen wieder offen.
      collapsedCards: Array.isArray(parsed.collapsedCards)
        ? parsed.collapsedCards.filter((id): id is SettingsCardId =>
            SETTINGS_CARD_IDS.includes(id as SettingsCardId),
          )
        : base.collapsedCards,
      settingsView: SETTINGS_VIEWS.includes(parsed.settingsView as SettingsView)
        ? (parsed.settingsView as SettingsView)
        : base.settingsView,
      markets: Array.isArray(parsed.markets) ? sanitizeMarkets(parsed.markets) : base.markets,
      depot: sanitizeDepot(parsed.depot),
      page: APP_PAGES.includes(parsed.page as AppPage) ? (parsed.page as AppPage) : 'sparplan',
    }
  } catch {
    return null
  }
}
