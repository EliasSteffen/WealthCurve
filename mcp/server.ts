#!/usr/bin/env -S npx tsx
/**
 * MCP-Server für die Zinseszins-Berechnung.
 *
 * Setzt genau auf der Schnittstelle auf, die der Kern ohnehin bietet:
 * `buildProjection(input)` ist ein Aufruf mit reinem JSON hinein und hinaus,
 * ohne Store und ohne React. Der Server tut deshalb wenig mehr, als Eingaben zu
 * prüfen und Ergebnisse durchzureichen.
 *
 *     npm run mcp
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { CHART_STYLES } from '../src/core/chart-style'
import { DEFAULT_MODEL } from '../src/core/domain/math'
import { DEFAULT_PARAMS, PARAMETERS, PARAM_IDS } from '../src/core/domain/parameters'
import { SERIES } from '../src/core/domain/series'
import { WITHDRAWAL_STRATEGIES } from '../src/core/domain/withdrawal'
import { projectionToCsv } from '../src/core/csv'
import { buildProjection, type ProjectionScenario } from '../src/core/projection'
import type { ModelSettings } from '../src/core/domain/types'

const server = new McpServer({ name: 'zinseszins', version: '1.0.0' })

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
})

/* -------------------------------------------------------------------- Tools */

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

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

server.registerTool(
  'berechne',
  {
    title: 'Sparplan berechnen',
    description:
      'Berechnet einen oder mehrere Sparplan-Szenarien über Anspar- und optionale Entnahmephase. ' +
      'Liefert je Szenario das Endkapital, das Kapital bei Rentenbeginn, die monatliche Entnahme, ' +
      'den Zinsertrag und ob das Geld reicht. Mehrere Szenarien werden direkt vergleichbar auf ' +
      'derselben Zeitachse gerechnet.',
    inputSchema: {
      scenarios: z.array(szenarioSchema).min(1).max(8),
      model: modellSchema.optional().describe('Zeitraum und Rechenkonventionen'),
      seriesIds: z
        .array(z.enum(SERIES.map((s) => s.id) as [string, ...string[]]))
        .default(['compound', 'contributions'])
        .describe('Welche Kurven berechnet werden sollen'),
    },
  },
  async ({ scenarios, model, seriesIds }) => {
    const projection = buildProjection({
      scenarios: toScenarios(scenarios),
      seriesIds,
      model: toModel(model),
    })

    // Die Entnahmeregel liefert auch dann einen Monatsbetrag, wenn gar nicht
    // entnommen wird - sie leitet ihn aus dem Rentenkapital ab. Ob im Text von
    // Entnahme die Rede sein darf, entscheidet allein die Laufzeit.
    const mitEntnahme = toModel(model).withdrawalYears > 0

    const ergebnis = projection.summaries.map((s) => ({
      szenario: s.label,
      endkapital: Math.round(s.final.balance),
      eingezahlt: Math.round(s.final.contributions),
      entnommen: Math.round(s.final.withdrawals),
      zinsertrag: Math.round(s.final.interest),
      kapitalBeiRentenbeginn: Math.round(s.capitalAtRetirement),
      monatlicheEntnahme: mitEntnahme ? Math.round(s.monthlyWithdrawal) : 0,
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
      .join('\n')

    return {
      content: [{ type: 'text', text }],
      structuredContent: { szenarien: ergebnis, jahre: projection.rows.length - 1 },
    }
  },
)

server.registerTool(
  'jahrestabelle',
  {
    title: 'Jahrestabelle als CSV',
    description:
      'Wie "berechne", liefert aber zusätzlich den vollständigen Jahresverlauf als CSV ' +
      '(Semikolon getrennt, deutsches Dezimalkomma). Nützlich zum Weiterverarbeiten.',
    inputSchema: {
      scenarios: z.array(szenarioSchema).min(1).max(8),
      model: modellSchema.optional(),
      seriesIds: z
        .array(z.enum(SERIES.map((s) => s.id) as [string, ...string[]]))
        .default(['compound', 'contributions']),
    },
  },
  async ({ scenarios, model, seriesIds }) => {
    const projection = buildProjection({
      scenarios: toScenarios(scenarios),
      seriesIds,
      model: toModel(model),
    })
    return { content: [{ type: 'text', text: projectionToCsv(projection) }] }
  },
)

server.registerTool(
  'moeglichkeiten',
  {
    title: 'Verfügbare Optionen',
    description:
      'Listet die verfügbaren Kurven, Entnahmeregeln, Darstellungsstile und die erlaubten ' +
      'Wertebereiche der Parameter. Vor dem ersten "berechne"-Aufruf hilfreich.',
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            kurven: SERIES.map((s) => ({ id: s.id, label: s.label, beschreibung: s.description })),
            entnahmeregeln: WITHDRAWAL_STRATEGIES.map((s) => ({
              id: s.id,
              label: s.label,
              beschreibung: s.description,
            })),
            stile: CHART_STYLES.map((s) => ({ id: s.id, label: s.label })),
            parameter: PARAM_IDS.map((id) => ({
              id,
              label: PARAMETERS[id].label,
              min: PARAMETERS[id].min,
              max: PARAMETERS[id].max,
              standard: PARAMETERS[id].defaultValue,
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
