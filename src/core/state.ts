import { DEFAULT_CHART_STYLE_ID } from './chart-style'
import { DEFAULT_MODEL } from './domain/math'
import {
  DEFAULT_PARAMS,
  sanitizeParam,
  sanitizeTimelineField,
  type ParamId,
  type SimulationParams,
  type TimelineFieldId,
} from './domain/parameters'
import { DEFAULT_ENABLED_SERIES, SERIES } from './domain/series'
import type { MarketSeries, ModelSettings, TimeAxisMode } from './domain/types'
import { sanitizeStartAge, sanitizeStartYear } from './timeAxis'
import { SLOT_COUNT, allocateSlot, type ColorSlot } from './palette'
import {
  SETTINGS_CARD_IDS,
  SETTINGS_VIEWS,
  type SettingsCardId,
  type SettingsView,
} from './settings/categories'

export interface Scenario {
  readonly id: string
  readonly label: string
  readonly params: SimulationParams
  readonly visible: boolean
  /** Fest vergeben, nie aus der Position abgeleitet. */
  readonly colorSlot: ColorSlot
}

export type EncodingPreference = 'auto' | string

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
    model: DEFAULT_MODEL,
    encoding: 'auto',
    chartStyleId: DEFAULT_CHART_STYLE_ID,
    sidebarCollapsed: false,
    collapsedCards: [],
    settingsView: 'kompakt',
    markets: [],
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

/** Die erlaubten Beschriftungen der Zeitachse - fuer die Pruefung beim Einlesen. */
export const TIME_AXIS_MODES: readonly TimeAxisMode[] = ['relative', 'age', 'calendar']

/* ------------------------------------------------------------------ Actions */

export type Action =
  | { type: 'scenario/add'; label?: string; params?: Partial<SimulationParams> }
  | { type: 'scenario/duplicate'; id: string }
  | { type: 'scenario/remove'; id: string }
  | { type: 'scenario/rename'; id: string; label: string }
  | { type: 'scenario/setVisible'; id: string; visible: boolean }
  | { type: 'scenario/setColor'; id: string; slot: ColorSlot }
  | { type: 'scenario/select'; id: string }
  | { type: 'scenario/setParam'; id: string; paramId: ParamId; value: number }
  | { type: 'series/toggle'; id: string }
  | { type: 'model/set'; model: ModelSettings }
  | { type: 'model/setTimeline'; field: TimelineFieldId; value: number }
  | { type: 'encoding/set'; encoding: EncodingPreference }
  | { type: 'chartStyle/set'; id: string }
  | { type: 'market/add'; market: MarketSeries }
  | { type: 'market/remove'; symbol: string }
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
  duplicateScenario: (id: string): Action => ({ type: 'scenario/duplicate', id }),
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
        label: `${source.label} (Kopie)`,
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

    case 'model/set':
      return {
        ...state,
        model: {
          ...action.model,
          // Ein geleertes Zahlenfeld liefert NaN. Hier wird daraus null, also
          // "kein Anker" - genau das, was das Leeren bedeuten soll.
          startAge: sanitizeStartAge(action.model.startAge),
          startYear: sanitizeStartYear(action.model.startYear),
        },
      }

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

export function deserialize(raw: string): AppState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) return null
    const base = createInitialState()
    // Jeden Wert durch dieselbe Bereinigung schicken wie eine Eingabe - fremdes
    // JSON darf keine NaN in die Simulation tragen.
    const scenarios = parsed.scenarios.map((s, index) => ({
      id: typeof s.id === 'string' ? s.id : createId(),
      label: typeof s.label === 'string' ? s.label : `Szenario ${index + 1}`,
      visible: s.visible !== false,
      colorSlot: Number.isFinite(s.colorSlot) ? (s.colorSlot as number) : index + 1,
      params: Object.fromEntries(
        Object.entries(DEFAULT_PARAMS).map(([key, fallback]) => [
          key,
          sanitizeParam(key as ParamId, (s.params?.[key as ParamId] ?? fallback) as number),
        ]),
      ) as SimulationParams,
    }))
    return {
      ...base,
      ...parsed,
      scenarios,
      activeScenarioId: scenarios.some((s) => s.id === parsed.activeScenarioId)
        ? parsed.activeScenarioId!
        : scenarios[0].id,
      model: {
        ...base.model,
        ...parsed.model,
        // Fremdes JSON darf keinen Anker jenseits der Grenzen setzen - ein
        // Startjahr von 1e9 machte jede Achsenbeschriftung unlesbar.
        timeAxis: TIME_AXIS_MODES.includes(parsed.model?.timeAxis as TimeAxisMode)
          ? (parsed.model?.timeAxis as TimeAxisMode)
          : base.model.timeAxis,
        startAge: sanitizeStartAge(parsed.model?.startAge ?? null),
        startYear: sanitizeStartYear(parsed.model?.startYear ?? null),
      },
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
      // Eine Kursreihe ohne Renditen zeichnet nichts und faende sich nie wieder
      // aus dem Zustand heraus - deshalb hier aussortieren statt aufheben.
      markets: Array.isArray(parsed.markets)
        ? parsed.markets
            .filter(
              (m): m is MarketSeries =>
                typeof m?.symbol === 'string' && Array.isArray(m?.monthlyReturns),
            )
            .slice(0, MAX_MARKETS)
        : base.markets,
    }
  } catch {
    return null
  }
}
