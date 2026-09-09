#!/usr/bin/env -S npx tsx
/**
 * MCP-Server für die Zinseszins-Berechnung.
 *
 * Setzt auf der Schnittstelle auf, die der Kern ohnehin bietet:
 * `buildProjection(input)` ist ein Aufruf mit reinem JSON hinein und hinaus,
 * ohne Store und ohne React. Der Server prüft Eingaben und reicht durch.
 *
 * Er kommt an dieselben Daten wie die Oberfläche - vollständige Projektion,
 * echte Kursverläufe, serialisierter Zustand - und an dieselben Videobilder,
 * weil `drawFrame` nur ein Canvas braucht und keinen Browser.
 *
 *     npm run mcp
 */
import { GlobalFonts, createCanvas } from '@napi-rs/canvas'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import {
  DEFAULT_SPEC,
  VIDEO_FORMATS,
  frameAt,
  frameCount,
  resolveFormat,
  totalSeconds,
} from '../src/core/animation'
import { CHART_STYLES, resolveChartStyle } from '../src/core/chart-style'
import { projectionToCsv } from '../src/core/csv'
import { DEFAULT_MODEL } from '../src/core/domain/math'
import {
  DEFAULT_PARAMS,
  PARAMETERS,
  PARAM_IDS,
  TIMELINE_FIELDS,
} from '../src/core/domain/parameters'
import { SERIES } from '../src/core/domain/series'
import type { MarketSeries, ModelSettings } from '../src/core/domain/types'
import { WITHDRAWAL_STRATEGIES } from '../src/core/domain/withdrawal'
import { ENCODINGS } from '../src/core/encoding'
import { colorFallback } from '../src/core/palette'
import { buildProjection, type Projection, type ProjectionScenario } from '../src/core/projection'
import { SETTINGS_CATEGORIES } from '../src/core/settings'
import { deserialize, serialize } from '../src/core/state'
import { drawFrame } from '../src/render/canvas/drawFrame'
import { fetchQuotes } from '../server/quotes'

const server = new McpServer({ name: 'zinseszins', version: '2.0.0' })

/* ---------------------------------------------------------------- Schriften */

/**
 * Eine Schriftfamilie, die es hier wirklich gibt.
 *
 * Die Stile lassen `fontFamily` auf null und der Renderer faellt auf
 * "system-ui, -apple-system, sans-serif" zurueck - eine CSS-Kette, die ein
 * Browser aufloest und Node nicht. Das Ergebnis war kein Fehler, sondern ein
 * Bild, in dem jedes "€" als leeres Kaestchen stand.
 *
 * Die Systemschriften stehen bereits beim Laden bereit - ein zusaetzlicher
 * Ladeaufruf ist nicht noetig.
 */
const VERFUEGBAR = new Set(GlobalFonts.families.map((f) => f.family))
const VORZUG = [
  'Helvetica Neue',
  'Helvetica',
  'Arial',
  'Liberation Sans',
  'DejaVu Sans',
  'Noto Sans',
]
const SCHRIFT =
  VORZUG.find((f) => VERFUEGBAR.has(f)) ?? GlobalFonts.families[0]?.family ?? 'sans-serif'

/** Nur ersetzen, was hier nicht existiert - ein gesetzter Stil behaelt seine Schrift. */
const schriftFuer = (fontFamily: string | null): string => {
  if (!fontFamily) return SCHRIFT
  const erste = fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')
  return VERFUEGBAR.has(erste) ? fontFamily : SCHRIFT
}

/* ------------------------------------------------------------------ Schemas */

const szenarioSchema = z.object({
  label: z.string().describe('Anzeigename, z. B. "Basis" oder "Aggressiv"'),
  monthlyContribution: z.number().describe('Monatliche Sparrate in Euro'),
  annualRate: z.number().describe('Erwartete Rendite in Prozent pro Jahr, z. B. 7'),
  initialCapital: z.number().default(0).describe('Startkapital in Euro'),
  inflationRate: z.number().default(2).describe('Inflation in Prozent p. a.'),
  savingsRate: z.number().default(2).describe('Tagesgeldzins in Prozent p. a.'),
  monthlyWithdrawal: z
    .number()
    .default(0)
    .describe('Monatliche Entnahme in Euro (nur bei Regel "fixedAmount")'),
  withdrawalRate: z
    .number()
    .default(4)
    .describe('Entnahmerate in Prozent p. a. (nur bei Regel "percentRule")'),
})

const modellSchema = z.object({
  accumulationYears: z.number().default(30).describe('Jahre, in denen eingezahlt wird'),
  withdrawalYears: z.number().default(0).describe('Jahre, in denen entnommen wird; 0 = keine'),
  compounding: z
    .enum(['monthly-effective', 'monthly-nominal', 'annual'])
    .default('monthly-effective')
    .describe(
      'monthly-effective: zwölf Monatsschritte ergeben exakt den Jahreszins (ETF-Konvention). ' +
        'monthly-nominal: Zins/12, wie die meisten Online-Rechner. annual: einmal pro Jahr.',
    ),
  timing: z
    .enum(['start', 'end'])
    .default('end')
    .describe('start = vorschüssig (Monatsanfang), end = nachschüssig (Monatsende)'),
  withdrawalStrategyId: z
    .enum(['percentRule', 'fixedAmount'])
    .default('percentRule')
    .describe('percentRule: Anteil des Depotwerts bei Rentenbeginn. fixedAmount: fester Betrag.'),
  amountsInflationAdjusted: z
    .boolean()
    .default(false)
    .describe(
      'true: die eingetragenen Beträge gelten als heutige Kaufkraft und wachsen nominal mit ' +
        'der Inflation mit. false: sie bleiben über die Jahre unverändert.',
    ),
  timeAxis: z
    .enum(['relative', 'age', 'calendar'])
    .default('relative')
    .describe(
      'Beschriftung der Zeitachse. Ändert keine Zahl, nur die Achse: relative = 0, 1, 2 …; ' +
        'age = Lebensalter (braucht startAge); calendar = Jahreszahlen (braucht startYear).',
    ),
  startAge: z
    .number()
    .nullable()
    .default(null)
    .describe('Alter zu Beginn der Ansparphase; null = keine Altersangabe.'),
  startYear: z
    .number()
    .nullable()
    .default(null)
    .describe(
      'Kalenderjahr, in dem die Ansparphase beginnt. PFLICHT für die Serie "marketReturn": ' +
        'echte Monatsrenditen hängen an echten Monaten, und ohne Anker gäbe es keinen ' +
        'ehrlichen Vergleich. Ohne Startjahr bleibt die Kurve leer.',
    ),
})

/** Die gemeinsame Eingabe aller rechnenden Werkzeuge. */
const rechenEingabe = {
  scenarios: z.array(szenarioSchema).min(1).max(8),
  model: modellSchema.optional().describe('Zeitraum und Rechenkonventionen'),
  seriesIds: z
    .array(z.enum(SERIES.map((s) => s.id) as [string, ...string[]]))
    .default(['compound', 'contributions'])
    .describe('Welche Kurven berechnet werden sollen'),
  symbols: z
    .array(z.string())
    .max(4)
    .default([])
    .describe(
      'Tickersymbole für die Serie "marketReturn", z. B. ["AAPL","^GDAXI"]. Die Kurse werden ' +
        'live geladen; je Symbol entsteht eine eigene Kurve.',
    ),
  encoding: z
    .enum(['auto', ...ENCODINGS.map((e) => e.id)] as [string, ...string[]])
    .default('auto')
    .describe('Wie Farbe und Strich auf Szenario und Serie verteilt werden'),
}

/* ------------------------------------------------------------------- Helfer */

/**
 * Fehlende Felder auffuellen.
 *
 * `modellSchema.parse({})` setzt alle Vorgaben ein - `.default({})` am Schema
 * selbst verlangt in Zod 4 ein vollstaendiges Objekt und waere hier nur
 * scheinbar richtig.
 */
const toModel = (m?: unknown): ModelSettings => ({
  ...DEFAULT_MODEL,
  ...modellSchema.parse(m ?? {}),
})

const toScenarios = (list: readonly z.infer<typeof szenarioSchema>[]): ProjectionScenario[] =>
  list.map((s, i) => ({
    id: `s${i + 1}`,
    label: s.label,
    colorSlot: i + 1,
    params: {
      ...DEFAULT_PARAMS,
      monthlyContribution: s.monthlyContribution,
      annualRate: s.annualRate,
      initialCapital: s.initialCapital,
      inflationRate: s.inflationRate,
      savingsRate: s.savingsRate,
      monthlyWithdrawal: s.monthlyWithdrawal,
      withdrawalRate: s.withdrawalRate,
    },
  }))

/** Kurse zu allen angefragten Symbolen; Unbekanntes wird gemeldet, nicht verschwiegen. */
async function ladeMaerkte(
  symbols: readonly string[],
): Promise<{ markets: MarketSeries[]; fehler: string[] }> {
  const markets: MarketSeries[] = []
  const fehler: string[] = []
  for (const symbol of symbols) {
    const ergebnis = await fetchQuotes(symbol)
    if (ergebnis.ok) markets.push(ergebnis.daten)
    else fehler.push(`${symbol}: ${ergebnis.fehler.error}`)
  }
  return { markets, fehler }
}

interface Eingabe {
  readonly scenarios: readonly z.infer<typeof szenarioSchema>[]
  readonly model?: unknown
  readonly seriesIds: readonly string[]
  readonly symbols: readonly string[]
  readonly encoding: string
}

async function baue(e: Eingabe): Promise<{ projection: Projection; fehler: string[] }> {
  const { markets, fehler } = await ladeMaerkte(e.symbols)
  return {
    projection: buildProjection({
      scenarios: toScenarios(e.scenarios),
      seriesIds: e.seriesIds,
      model: toModel(e.model),
      encoding: e.encoding,
      markets,
    }),
    fehler,
  }
}

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/* -------------------------------------------------------------------- Tools */

server.registerTool(
  'berechne',
  {
    title: 'Sparplan berechnen',
    description:
      'Berechnet einen oder mehrere Sparplan-Szenarien über Anspar- und optionale Entnahmephase. ' +
      'Liefert je Szenario das Endkapital, das Kapital bei Rentenbeginn, die monatliche Entnahme, ' +
      'den Zinsertrag und ob das Geld reicht. Mehrere Szenarien werden direkt vergleichbar auf ' +
      'derselben Zeitachse gerechnet. Mit "symbols" fließen echte Kursverläufe ein.',
    inputSchema: rechenEingabe,
  },
  async (eingabe) => {
    const { projection, fehler } = await baue(eingabe)
    const mitEntnahme = toModel(eingabe.model).withdrawalYears > 0

    const ergebnis = projection.summaries.map((s) => ({
      szenario: s.label,
      endkapital: Math.round(s.final.balance),
      eingezahlt: Math.round(s.final.contributions),
      entnommen: Math.round(s.final.withdrawals),
      zinsertrag: Math.round(s.final.interest),
      kapitalBeiRentenbeginn: Math.round(s.capitalAtRetirement),
      monatlicheEntnahme: mitEntnahme ? Math.round(s.monthlyWithdrawal) : 0,
      monatlicheEntnahmeNominalZuBeginn: mitEntnahme ? Math.round(s.monthlyWithdrawalAtStart) : 0,
      aufgebrauchtInJahr: s.depletedAtYear,
    }))

    const text = ergebnis
      .map(
        (e) =>
          `${e.szenario}: Endkapital ${euro.format(e.endkapital)}, davon ` +
          `${euro.format(e.zinsertrag)} Zinsertrag bei ${euro.format(e.eingezahlt)} Einzahlung.` +
          (mitEntnahme
            ? ` Entnahme ${euro.format(e.monatlicheEntnahme)}/Monat, ` +
              (e.aufgebrauchtInJahr === null
                ? 'das Kapital reicht durch.'
                : `aufgebraucht in Jahr ${e.aufgebrauchtInJahr}.`)
            : ''),
      )
      .concat(fehler.length > 0 ? [`Nicht geladen: ${fehler.join('; ')}`] : [])
      .join('\n')

    return {
      content: [{ type: 'text', text }],
      structuredContent: {
        szenarien: ergebnis,
        jahre: projection.rows.length - 1,
        kodierung: projection.encodingDescription,
        kapazitaet: projection.capacity,
        kursfehler: fehler,
      },
    }
  },
)

server.registerTool(
  'projektion',
  {
    title: 'Vollständige Projektion',
    description:
      'Gibt die komplette Projektion zurück, so wie sie die Oberfläche zeichnet: alle Linien mit ' +
      'Farbe und Strich, alle Jahreszeilen, alle Zusammenfassungen, das Jahr des Rentenbeginns, ' +
      'die Kodierungsbeschreibung und die Kapazitätswarnung. Nutze das, wenn "berechne" zu wenig ' +
      'liefert - hier fehlt nichts.',
    inputSchema: rechenEingabe,
  },
  async (eingabe) => {
    const { projection, fehler } = await baue(eingabe)
    return {
      content: [
        {
          type: 'text',
          text:
            `${projection.lines.length} Linien über ${projection.rows.length - 1} Jahre. ` +
            `${projection.encodingDescription}.` +
            (fehler.length > 0 ? ` Nicht geladen: ${fehler.join('; ')}` : ''),
        },
      ],
      structuredContent: { ...projection, kursfehler: fehler },
    }
  },
)

server.registerTool(
  'jahrestabelle',
  {
    title: 'Jahrestabelle als CSV',
    description:
      'Wie "berechne", liefert aber den vollständigen Jahresverlauf als CSV ' +
      '(Semikolon getrennt, deutsches Dezimalkomma). Nützlich zum Weiterverarbeiten.',
    inputSchema: rechenEingabe,
  },
  async (eingabe) => {
    const { projection } = await baue(eingabe)
    return { content: [{ type: 'text', text: projectionToCsv(projection) }] }
  },
)

server.registerTool(
  'kursdaten',
  {
    title: 'Kursverlauf laden',
    description:
      'Lädt die Monatsrenditen eines Wertpapiers über dieselbe Quelle wie die Oberfläche. ' +
      'Liefert Symbol, Name, Währung, Beginn der Historie und die Renditen als Dezimalzahlen ' +
      '(0.012 bedeutet +1,2 % in diesem Monat).',
    inputSchema: {
      symbol: z.string().describe('Tickersymbol in Yahoo-Schreibweise, z. B. AAPL oder ^GDAXI'),
    },
  },
  async ({ symbol }) => {
    const ergebnis = await fetchQuotes(symbol)
    if (!ergebnis.ok) {
      return { content: [{ type: 'text', text: ergebnis.fehler.error }], isError: true }
    }
    const { daten } = ergebnis
    return {
      content: [
        {
          type: 'text',
          text:
            `${daten.name} (${daten.symbol}), ${daten.currency}, seit ${daten.start} — ` +
            `${daten.monthlyReturns.length} Monatsrenditen.`,
        },
      ],
      // Als Literal ausgebreitet: das SDK verlangt eine Index-Signatur, die ein
      // benanntes Interface nicht mitbringt.
      structuredContent: { ...daten },
    }
  },
)

server.registerTool(
  'zustand',
  {
    title: 'Zustand lesen und schreiben',
    description:
      'Wandelt zwischen Szenario-Eingaben und dem serialisierten Zustand der Oberfläche. ' +
      'Ohne "blob" wird aus den Szenarien einer erzeugt; mit "blob" wird er gelesen und ' +
      'zurückgegeben. Damit lässt sich ein in der App gebauter Stand hier weiterrechnen ' +
      'und umgekehrt.',
    inputSchema: {
      blob: z.string().optional().describe('Serialisierter Zustand aus der Oberfläche'),
      scenarios: z.array(szenarioSchema).max(8).default([]),
      model: modellSchema.optional(),
    },
  },
  async ({ blob, scenarios, model }) => {
    if (blob) {
      const zustand = deserialize(blob)
      if (!zustand) {
        return {
          content: [{ type: 'text', text: 'Der Zustand ließ sich nicht lesen.' }],
          isError: true,
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: `${zustand.scenarios.length} Szenarien, ${zustand.markets.length} Wertpapiere.`,
          },
        ],
        structuredContent: { ...zustand },
      }
    }

    const erzeugt = serialize({
      scenarios: toScenarios(scenarios).map((s) => ({ ...s, visible: true })),
      activeScenarioId: 's1',
      enabledSeriesIds: ['compound', 'contributions'],
      model: toModel(model),
      encoding: 'auto',
      chartStyleId: 'clean',
      sidebarCollapsed: false,
      collapsedCategories: [],
      settingsView: 'kompakt',
      markets: [],
    })
    return { content: [{ type: 'text', text: erzeugt }] }
  },
)

server.registerTool(
  'video',
  {
    title: 'Videoentwurf mit Standbild',
    description:
      'Liefert den vollständigen Bauplan des Reels: Abschnitte mit Dauer und Text, die ' +
      'aufgelösten Platzhalter, Bildanzahl und Laufzeit - plus ein gerendertes Standbild als PNG. ' +
      'Die Bilder entstehen mit demselben Renderer wie in der App; es fehlt nur die Kodierung ' +
      'zum Film, die der Browser in Echtzeit erledigt.',
    inputSchema: {
      ...rechenEingabe,
      formatId: z
        .enum(VIDEO_FORMATS.map((f) => f.id) as [string, ...string[]])
        .default('reel')
        .describe('Bildformat des Videos'),
      chartStyleId: z
        .enum(CHART_STYLES.map((s) => s.id) as [string, ...string[]])
        .default('clean')
        .describe('Darstellungsstil, wie in der Oberfläche'),
      frame: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Welches Einzelbild gerendert wird. Ohne Angabe eines aus dem Aufbau.'),
    },
  },
  async (eingabe) => {
    const { projection, fehler } = await baue(eingabe)
    const format = resolveFormat(eingabe.formatId)
    const gewaehlt = resolveChartStyle(eingabe.chartStyleId)
    const style = { ...gewaehlt, fontFamily: schriftFuer(gewaehlt.fontFamily) }
    const gesamt = frameCount(DEFAULT_SPEC)
    const index = eingabe.frame ?? Math.floor(gesamt * 0.6)
    const frame = frameAt(DEFAULT_SPEC, projection, index)

    const summary = projection.summaries[0]
    const params = eingabe.scenarios[0]
    const facts: Record<string, string> = {
      endkapital: euro.format(summary?.final.balance ?? 0),
      eingezahlt: euro.format(summary?.final.contributions ?? 0),
      zinsertrag: euro.format(summary?.final.interest ?? 0),
      rentenkapital: euro.format(summary?.capitalAtRetirement ?? 0),
      entnahme: euro.format(summary?.monthlyWithdrawal ?? 0),
      rate: euro.format(params?.monthlyContribution ?? 0),
      rendite: `${String(params?.annualRate ?? 0).replace('.', ',')} %`,
      ansparjahre: String(toModel(eingabe.model).accumulationYears),
      jahre: String(projection.rows.length - 1),
      reicht:
        summary?.depletedAtYear == null ? 'reicht durch' : `bis Jahr ${summary.depletedAtYear}`,
      szenarien: projection.summaries
        .map((s) => `${s.label}: ${euro.format(s.final.balance)}`)
        .join(' · '),
    }

    /*
     * Das Thema kommt als Literal, nicht aus dem DOM.
     *
     * `readRenderTheme()` liest CSS-Variablen über getComputedStyle - hier gibt
     * es weder Dokument noch Stylesheet. Die Werte sind dieselben Vorgaben, die
     * dort als Ersatz hinterlegt sind.
     */
    const canvas = createCanvas(format.width, format.height)
    drawFrame(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, {
      frame,
      projection,
      style,
      format,
      theme: {
        surface: '#fcfcfb',
        text: '#0b0b0b',
        textMuted: '#898781',
        grid: '#e1e0d9',
        axis: '#c3c2b7',
      },
      colors: Object.fromEntries(projection.lines.map((l) => [l.key, colorFallback(l.colorVar)])),
      title: projection.summaries[0]?.label ?? 'Zinseszins',
      facts,
    })

    return {
      content: [
        {
          type: 'text',
          text:
            `Bild ${index} von ${gesamt} (${Math.round(totalSeconds(DEFAULT_SPEC))} s, ` +
            `${format.width}×${format.height}).` +
            (fehler.length > 0 ? ` Nicht geladen: ${fehler.join('; ')}` : ''),
        },
        {
          type: 'image',
          mimeType: 'image/png',
          data: canvas.toBuffer('image/png').toString('base64'),
        },
      ],
      structuredContent: {
        spezifikation: DEFAULT_SPEC,
        format,
        stil: style.id,
        bilder: gesamt,
        sekunden: totalSeconds(DEFAULT_SPEC),
        platzhalter: facts,
        gezeigtesBild: index,
        kursfehler: fehler,
      },
    }
  },
)

server.registerTool(
  'moeglichkeiten',
  {
    title: 'Verfügbare Optionen',
    description:
      'Listet Kurven, Entnahmeregeln, Darstellungsstile, Kodierungen, Videoformate, ' +
      'Einstellungs-Kategorien und die erlaubten Wertebereiche aller Parameter. ' +
      'Vor dem ersten Aufruf hilfreich.',
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            kurven: SERIES.map((s) => ({
              id: s.id,
              label: s.label,
              beschreibung: s.description,
              standardAn: s.defaultEnabled,
              // Diese Serie wird je geladenem Wertpapier zu einer eigenen Kurve.
              proWertpapier: s.fanOut === 'markets',
            })),
            entnahmeregeln: WITHDRAWAL_STRATEGIES.map((s) => ({
              id: s.id,
              label: s.label,
              beschreibung: s.description,
            })),
            stile: CHART_STYLES.map((s) => ({ id: s.id, label: s.label })),
            kodierungen: ENCODINGS.map((e) => ({ id: e.id, label: e.label })),
            videoformate: VIDEO_FORMATS,
            kategorien: SETTINGS_CATEGORIES,
            parameter: PARAM_IDS.map((id) => ({
              id,
              label: PARAMETERS[id].label,
              einheit: PARAMETERS[id].unit,
              kategorie: PARAMETERS[id].category,
              min: PARAMETERS[id].min,
              max: PARAMETERS[id].max,
              standard: PARAMETERS[id].defaultValue,
            })),
            zeitraum: Object.entries(TIMELINE_FIELDS).map(([id, def]) => ({
              id,
              label: def.label,
              kategorie: def.category,
              min: def.min,
              max: def.max,
              standard: def.defaultValue,
            })),
          },
          null,
          2,
        ),
      },
    ],
  }),
)

await server.connect(new StdioServerTransport())
