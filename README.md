# Zinseszins-Visualisierung

Interaktives Dashboard für Sparpläne: jährliche Rendite und monatliche Sparrate einstellen,
Entwicklung über die Laufzeit live im Chart verfolgen.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Finanzmathematik, Registries, Store, Architektur-Wächter
npm run demo       # Headless-Beweis: läuft in Node ohne React und ohne DOM
npm run build      # Typecheck + Produktions-Build
```

## Headless nutzen

`src/core/` enthält die komplette Logik **ohne React, ohne DOM, ohne
Chart-Bibliothek**. Ein Wächtertest (`no-react.test.ts`) hält diese Grenze offen.

Zwei Einstiege:

```ts
import { buildProjection, createStore, createInitialState, reducer,
         actions, selectProjection, projectionToCsv } from './src/core'

// 1) Einmalige Rechnung - reines JSON rein, reines JSON raus, kein Zustand.
const projection = buildProjection({
  scenarios: [{ id: 'basis', label: 'Basis', colorSlot: 1, params: { /* … */ } }],
  seriesIds: ['compound', 'contributions'],
  model: { compounding: 'monthly-effective', timing: 'end',
           accumulationYears: 30, withdrawalYears: 25,
           withdrawalStrategyId: 'percentRule' },
})
projection.summaries[0].capitalAtRetirement   // Depotwert bei Rentenbeginn
projection.summaries[0].depletedAtYear        // null = reicht durch
projectionToCsv(projection)

// 2) Beobachtbarer Zustand - für Oberflächen jeder Art.
const store = createStore(reducer, createInitialState())
store.subscribe(() => console.log(selectProjection(store.getSnapshot())))
store.dispatch(actions.addScenario('Aggressiv', { annualRate: 9 }))
```

Der Store erfüllt den Vertrag von Reacts `useSyncExternalStore`
(`getSnapshot` / `subscribe`) und läuft deshalb genauso aus Vue, Svelte oder
Vanilla – ohne Zustand oder Redux als Abhängigkeit. `npm run demo` führt beide
Wege in einem echten Node-Prozess vor.

## Eine neue Serie hinzufügen

Das ist der Zweck der Architektur: **eine neue Datei, eine neue Zeile.** Chart, Regler, Legende,
Tooltip, Tabelle und KPI-Zeile ziehen automatisch nach.

### 1. Serien-Datei anlegen

```ts
// src/domain/series/realEstate.ts
import { defineSeries } from '../types'

export const realEstateSeries = defineSeries({
  id: 'realEstate',
  label: 'Immobilie',
  description: 'Wertentwicklung bei eigener Rate.',
  colorVar: 'var(--chart-5, #e87ba4)',   // nächster freier Slot aus index.css
  unit: 'currency',
  defaultEnabled: false,
  requiredParams: ['years', 'initialCapital', 'appreciationRate'],
  compute: ({ base, params }) => base.years.map((y) => /* … */),
})
```

### 2. Falls nötig: Parameter ergänzen

```ts
// src/domain/parameters.ts
appreciationRate: {
  label: 'Wertsteigerung p. a.',
  unit: 'percent',
  min: 0, max: 10, step: 0.1, defaultValue: 3,
  group: 'annahmen',
},
```

### 3. Im Registry eintragen

```ts
// src/domain/series/index.ts
export const SERIES: readonly SeriesDefinition[] = [
  compoundSeries,
  contributionsSeries,
  purchasingPowerSeries,
  savingsAccountSeries,
  realEstateSeries,        // <- das ist alles
]
```

`npm test` prüft danach automatisch mit, dass die ID eindeutig ist, der Farb-Slot noch frei war,
alle `requiredParams` existieren und `compute()` genauso viele Werte liefert wie die Basissimulation.

## Wie eine Serie rechnet

Serien bekommen **eine fertige Simulation** (`base`) und projizieren daraus — sie simulieren nicht
selbst. Dadurch lebt die Zinslogik an genau einer Stelle (`domain/math.ts`), und weil keine Serie
eine andere sieht, sind Abhängigkeiten zwischen Serien strukturell unmöglich.

```ts
// Projektion - der Normalfall
compute: ({ base }) => base.years.map((y) => y.balance)

// Eigene Dynamik - der Notausgang, siehe savingsAccount.ts
compute: ({ params, model }) =>
  simulateMonthly({ annualRatePercent: params.savingsRate, /* … */, model }).years.map((y) => y.balance)
```

`base.years[i]` liefert pro Jahr `balance`, `contributions` und `interest`.

## Entnahmeplan

Die Simulation läuft über eine **Phasenfolge**: erst ansparen, dann entnehmen,
während der Rest weiterarbeitet. Anspar- und Auszahldauer stehen bei den
Modell-Einstellungen und gelten für **alle Szenarien gemeinsam** – sonst lägen
die Kurven auf unterschiedlichen X-Achsen und der Vergleich wäre wertlos.

Wie hoch die Entnahme ausfällt, bestimmt eine Strategie aus
`src/core/domain/withdrawal/` – dasselbe Registry-Muster wie bei den Serien:

| Strategie | Monatsbetrag |
|---|---|
| `percentRule` (Default) | Anteil des Depotwerts bei Rentenbeginn, 4-%-Regel |
| `fixedAmount` | fester Betrag, unabhängig vom Depotwert |

Entnahmen werden auf den Bestand gedeckelt – das Depot läuft nie ins Minus. Das
erste Jahr, in dem eine Entnahme nicht mehr voll bedient werden kann, steht als
`depletedAtYear` in der Zusammenfassung. Beispiel: 584.726 € Rentenkapital,
5.000 €/Monat, 7 % Rendite → aufgebraucht in Jahr 46.

## Szenarien und Farben

Beliebig viele Szenarien bis **acht**. Die Grenze ist gemessen, nicht geraten:
alle acht Palettenslots sind auf Farbfehlsichtigkeit geprüft (schlechtestes
Nachbarpaar ΔE 9.1 hell / 8.4 dunkel). Ein neunter Ton wäre von einem
vorhandenen nicht mehr zu unterscheiden.

Der Farb-Slot gehört **fest zum Szenario** und wird bei der Anlage vergeben –
nie aus der Position im Array abgeleitet. Sonst färbt sich beim Löschen eines
Szenarios alles darunter um.

Wie Farbe und Strich verteilt werden, entscheidet eine Kodierung aus
`src/core/encoding/`:

| Sichtbare Szenarien | Farbe | Linienstil |
|---|---|---|
| 1 | Serie | durchgezogen |
| 2+ | Szenario | Serie |

## Zinsmodus

Der Schalter unter *Modell* ändert die Ergebnisse spürbar — bei 500 €/Monat, 7 %, 30 Jahren:

| Modus | Monatszins | Endkapital |
|---|---|---|
| Effektiv (Default) | `(1+r)^(1/12) − 1` | 584.726 € |
| Nominal | `r / 12` | 609.985 € |
| Jährlich | einmal p. a., Raten unverzinst | 566.765 € |

**Effektiv** ist der Default, weil ausgewiesene ETF-Renditen effektive Jahresrenditen sind: zwölf
Monatsschritte ergeben dann exakt den eingegebenen Jahreszins. **Nominal** rechnen die meisten
Online-Rechner — für einen Vergleich mit denen ist das der richtige Modus.

## Architektur

```
src/core/          reine Logik - kein React, kein DOM, kein Recharts
  domain/
    math.ts        simulate() über Phasen, toMonthlyRate()
    parameters.ts  PARAMETERS + TIMELINE_FIELDS -> ParamId, sanitizeParam
    series/        eine Datei pro Serie + index.ts als Registry
    withdrawal/    eine Datei pro Entnahmeregel + Registry
  encoding/        Farb-/Strichzuordnung als austauschbare Strategie
  projection.ts    buildProjection() - die zentrale Rechnung
  state.ts         AppState, Aktionen, Reducer, Serialisierung
  store.ts         beobachtbarer Store (~40 Zeilen, ohne Bibliothek)
  derive.ts        memoisierte Selektoren
  index.ts         öffentliche API
src/react/         Bindung an den Store über useSyncExternalStore
src/lib/           Intl-Formatter (de-DE), deutscher Zahlenparser
src/components/    UI; nur chart/ kennt Recharts
  layout/          ein SettingsPanel, drei Container (Sidebar / Sheet)
```

Die Sidebar ist auf dem Desktop einklappbar und scrollt unabhängig von der
Chart-Spalte; unterhalb von 1024 px übernimmt ein Bottom-Sheet auf Basis des
nativen `<dialog>` – Fokus-Falle, ESC und Backdrop kommen vom Browser statt aus
einer Bibliothek.

Farben liegen als CSS-Variablen (`--chart-1` … `--chart-8`) in `src/index.css`, je einmal für Hell
und Dunkel. Die Palette ist auf Farbfehlsichtigkeit geprüft (schlechtestes Nachbarpaar ΔE 9.1 hell /
8.4 dunkel). Der Farb-Slot gehört fest zur Serien-ID — nie an die Reihenfolge koppeln, sonst färbt
sich der Chart beim Ein- und Ausschalten um.
