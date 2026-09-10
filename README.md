# Zinseszins-Visualisierung

Interaktives Dashboard für Sparpläne: jährliche Rendite und monatliche Sparrate einstellen,
Entwicklung über die Laufzeit live im Chart verfolgen.

```bash
npm install
npm run dev        # http://localhost:5173 — inklusive Kursdaten
npm test           # Finanzmathematik, Registries, Store, Architektur-Wächter
npm run demo       # Headless-Beweis: läuft in Node ohne React und ohne DOM
npm run mcp        # MCP-Server über stdio
npm run build      # Typecheck + Produktions-Build
npm run serve      # liefert dist/ samt Kursdaten aus, ohne Vite und ohne Vercel
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

## Sprachen

Deutsch und Englisch, umschaltbar in der Kopfzeile; die Erkennung folgt
`navigator.language`. Deutsch ist die Ausgangssprache und steht direkt im Code —
`src/i18n/en.ts` enthält nur die Abweichungen.

Fehlt ein Schlüssel, bleibt der deutsche Text stehen statt eines rohen
Schlüssels. Das ist Absicht: eine neue Serie funktioniert dadurch sofort in
beiden Sprachen, sie ist nur noch nicht übersetzt. Ein Test prüft, dass alle
Serien, Parameter, Regeln und Stile im Katalog vorkommen.

Zahlen und Währung folgen der Sprache. Die Formatter halten die Sprache
modulweit statt im React-Kontext, damit sie auch aus dem Canvas-Renderer und dem
Kern heraus aufrufbar bleiben, die keinen Kontext haben.

## Kursdaten

Die Serie „Kursverlauf" rechnet mit den echten Monatsrenditen eines Wertpapiers
statt mit einem festen Zins — sie zeigt, was die Glättung auf „8 % pro Jahr"
verschweigt.

Es lassen sich bis zu vier Papiere gleichzeitig laden. Aus der **einen** Serie
wird dann eine Kurve je Wertpapier (`fanOut: 'markets'` in der Definition):
`buildProjection` ruft dieselbe `compute` einmal pro Kurs auf und setzt jeweils
`ctx.market`. Die Registry bleibt dadurch statisch, und jede Kurve zählt für
Farbe, Strich und Kapazitätswarnung wie eine eigene Serie. Vier ist die Grenze,
weil sich Szenarien und Wertpapiere die acht Farb-Slots teilen.

### Warum es dafür einen Server braucht

Yahoo sendet keine CORS-Header und verlangt Cookie plus Crumb — ein Browser kann
das nicht. Für die frei zugänglichen Alternativen gilt dasselbe: eine
schlüsselfreie Kursquelle mit CORS gibt es nicht. Der Abruf muss also
serverseitig laufen.

### Vier Wirte, ein Handler

Die Beschaffung steht in `server/quotes.ts` — ohne Request, ohne Response, nur
Symbol rein und Ergebnis raus. Erst die Adapter kennen HTTP:

| Wirt | Adapter |
|---|---|
| `npm run dev` | `server/vitePlugin.ts` als Dev-Middleware |
| `npm run serve` | `scripts/serve.ts`, nur Node, kein Framework |
| Vercel | `api/quotes.ts` |
| Cloudflare Workers, Deno, Bun | eigener Adapter über `handleQuotesRequest` |

Damit hängt das Projekt an keiner Plattform. Der Edge-Cache (`s-maxage=86400`)
ist die eigentliche Antwort auf die Drosselung — ein Proxy allein würde sie nur
weiterreichen.

### Ohne Serverfunktion

Wird die Seite rein statisch ausgeliefert, **funktioniert alles außer dem
Live-Abruf**. Die App merkt das beim Start und zeigt statt des Suchfelds einen
Dateiimport. Akzeptiert werden:

- **CSV** mit einer Datums- und einer Kursspalte — `date,close` oder `Datum;Kurs`,
  Dezimaltrenner Punkt oder Komma, Trennzeichen Komma oder Semikolon
- **JSON** als `[{ "date": "2000-01-01", "close": 100.5 }, …]`
- **JSON** als gespeicherte Antwort von `/api/quotes` — ein Export ist damit
  wieder importierbar

Beide Wege enden in `marketFromPrices` (`src/core/market.ts`), damit eine
importierte Reihe exakt so gerechnet wird wie eine abgerufene.

Reicht die Historie nicht über die Laufzeit, endet die Kurve dort, statt
fortgeschrieben zu werden — Serien dürfen dafür `null` liefern, was der Chart als
Lücke zeichnet.

### Veröffentlichen

| Ziel | Datei | Live-Kursabruf |
|---|---|---|
| Vercel | `vercel.json` + `api/quotes.ts` | ja |
| GitLab Pages | `.gitlab-ci.yml` | nein — Dateiimport (siehe oben) |
| Eigener Server | `npm run serve` | ja |

Die GitLab-Pipeline prüft (`typecheck`, `lint`, `test`) und veröffentlicht nur
den Standardzweig. Zwei Punkte, die dort erklärt sind und leicht übersehen
werden: Pages liegt unter `/<projekt>/`, weshalb der Build den Basis-Pfad aus
`CI_PAGES_URL` bekommt — sonst bliebe die Seite weiß. Und Pages liefert den
Ordner `public` aus, der hier bereits Vites Quellverzeichnis ist; der Auftrag
schiebt deshalb `dist` an dessen Stelle, nachdem Vite `public/*` ohnehin dorthin
kopiert hat.

Die Pfade in `public/site.webmanifest` sind relativ (`favicon.svg`, nicht
`/favicon.svg`): Vite schreibt `index.html` auf den Basis-Pfad um, das Manifest
aber nicht — mit absoluten Pfaden liefen die Symbole unter einem Unterpfad ins
Leere.

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

## MCP-Server

```bash
npm run mcp
```

Sieben Tools über stdio. Der Server setzt direkt auf `buildProjection` auf — er
prüft Eingaben und reicht Ergebnisse durch, mehr nicht.

| Tool | Liefert |
|---|---|
| `berechne` | Endkapital, Zinsertrag, Entnahme je Szenario |
| `projektion` | die **vollständige** Projektion: Linien, alle Jahreszeilen, Zusammenfassungen, Kodierung, Kapazität |
| `jahrestabelle` | denselben Lauf als CSV |
| `kursdaten` | Monatsrenditen eines Wertpapiers |
| `zustand` | serialisierten Zustand erzeugen oder lesen — Brücke zur Oberfläche |
| `video` | Bauplan des Reels, aufgelöste Platzhalter und ein gerendertes Standbild als PNG |
| `moeglichkeiten` | Kurven, Regeln, Stile, Kodierungen, Formate, Kategorien, Wertebereiche |

Alle rechnenden Tools nehmen `symbols` entgegen und laden echte Kursverläufe
über dieselbe Quelle wie die Oberfläche.

**Zu den Videos:** der Server rendert Einzelbilder mit demselben `drawFrame` wie
die App — `@napi-rs/canvas` liefert das Canvas, ein Browser ist nicht nötig. Das
Zusammensetzen zum Film bleibt im Browser: `MediaRecorder` nimmt in Echtzeit auf,
ein Video hier zu kodieren hieße, ffmpeg als dauerhafte Abhängigkeit
mitzuschleppen. Das Standbild plus `spezifikation` beschreibt das Video
vollständig — was fehlt, ist nur die Kodierung.

Eintrag für eine MCP-Konfiguration:

```json
{
  "mcpServers": {
    "zinseszins": { "command": "npm", "args": ["run", "--silent", "mcp"], "cwd": "/pfad/zum/projekt" }
  }
}
```

## Einstellungen

Die Seitenspalte ist in Kategorien gegliedert (Szenarien, Werte, Zeitraum, Kurven,
Berechnung) und über ein Suchfeld durchsuchbar. Der Suchindex wird in
`src/core/settings/` **aus den Registries abgeleitet** — eine neue Serie oder ein
neuer Parameter ist damit sofort auffindbar, ohne dass jemand daran denken muss.

Gezeigt werden nur Regler, die gerade etwas bewirken: Parameter, die keine
aktive Serie und keine gewählte Entnahmeregel liest, verschwinden samt ihrer
Kategorie.

## Darstellungsstile

Wie das Diagramm aussieht, bestimmt ein Stil aus `src/core/chart-style/` — Standard, Gezeichnet,
Minimal, Kräftig, Präsentation. Ein neuer Stil ist eine Datei plus eine Registry-Zeile.

Ein Stil ist **reine Daten**, keine Recharts-Props. Das ist kein Zufall: derselbe Stil wird auch vom
Canvas-Renderer für das Video gelesen. Wäre er an Recharts gebunden, müsste jeder Look zweimal
gebaut und zweimal gepflegt werden.

Der gezeichnete Stil kommt ohne rough.js aus — Recharts' `type`-Prop akzeptiert eine eigene
d3-Curve-Factory (`src/render/sketchCurve.ts`). Wichtig dabei: der Versatz wird deterministisch aus
den Koordinaten berechnet (`src/render/wobble.ts`). Mit `Math.random()` bekäme dieselbe Kurve bei
jedem Render einen neuen Ausschlag und würde beim Ziehen eines Reglers sichtbar flimmern.

## Video-Export

Der Knopf „Video" in der Kopfzeile erzeugt ein Reel: die Kurve wächst über die Jahre, die Zahlen
zählen mit, am Ende bleibt das Ergebnis stehen. Formate 9:16, 1:1 und 16:9.

```
src/core/animation/     Zeitachse, Easing, Interpolation - rein und testbar
src/render/canvas/      zeichnet ein Einzelbild auf ein Canvas
src/lib/recordCanvas.ts nimmt das Canvas über MediaRecorder auf
```

Warum ein zweiter Renderer: Recharts zeichnet DOM/SVG, `MediaRecorder` braucht ein Canvas. Beide
lesen denselben `ChartStyle` und dieselbe `Projection`, sodass Video und App nicht auseinanderlaufen
können.

Das Reel ist in drei Abschnitte gegliedert — **Aufhänger → Aufbau → Pointe** —,
deren Text und Dauer im Dialog einstellbar sind. Nur der Aufbau bewegt die Kurve;
davor steht sie bei null, danach am Ende, damit die Aussage lesbar bleibt. Im Text
stehen Platzhalter wie `{{rate}}` oder `{{zinsertrag}}` zur Verfügung. Eine Dauer
von 0 überspringt einen Abschnitt — damit entsteht ein reines Aufbau-Video, ohne
dass es dafür einen zweiten Modus bräuchte.

Zwei Eigenheiten, die bewusst so sind:

- Die Aufnahme läuft **in Echtzeit** — ein 12-Sekunden-Video braucht 12 Sekunden. Die Zeitstempel
  kommen von der Uhr; `captureStream(0)` plus `requestFrame()` sorgt dafür, dass jedes Bild genau
  einmal im Video landet, egal wie schnell der Rechner zeichnet.
- Das Containerformat hängt am Browser. Der Dialog zeigt an, ob MP4 oder WebM herauskam. Kam WebM
  heraus, wandelt ein Knopf die Datei per ffmpeg.wasm in MP4 um. Die rund 30 MB dafür werden **erst
  bei diesem Klick** geladen (dynamischer Import plus Core von der CDN) — wer direkt MP4 aufnimmt,
  lädt nichts davon.

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
  animation/       Zeitachse fürs Video - kein Canvas, kein DOM
  chart-style/     Darstellungsstile als reine Daten
src/render/        Pixel: Canvas-Renderer und die Skizzen-Curve
src/react/         Bindung an den Store über useSyncExternalStore
src/lib/           Intl-Formatter (de-DE), deutscher Zahlenparser
src/components/    UI; nur chart/ kennt Recharts
  layout/          ein SettingsPanel, drei Container (Sidebar / Sheet)
  video/           Export-Dialog mit Vorschau
test/              alle Tests, spiegelt src/ - Importe über den Alias @/
```

Die Sidebar ist auf dem Desktop einklappbar und scrollt unabhängig von der
Chart-Spalte; unterhalb von 1024 px übernimmt ein Bottom-Sheet auf Basis des
nativen `<dialog>` – Fokus-Falle, ESC und Backdrop kommen vom Browser statt aus
einer Bibliothek.

Farben liegen als CSS-Variablen (`--chart-1` … `--chart-8`) in `src/index.css`, je einmal für Hell
und Dunkel. Die Palette ist auf Farbfehlsichtigkeit geprüft (schlechtestes Nachbarpaar ΔE 9.1 hell /
8.4 dunkel). Der Farb-Slot gehört fest zur Serien-ID — nie an die Reihenfolge koppeln, sonst färbt
sich der Chart beim Ein- und Ausschalten um.
