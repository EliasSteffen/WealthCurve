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

### Aus einem anderen Projekt

Das Paket heißt `wealthcurve` und hat zwei Einstiege, beide als TypeScript-Quelle
ohne Build:

| Import | Datei | Inhalt |
|---|---|---|
| `wealthcurve` | `src/core/index.ts` | Rechnung, Zustand, Registries, Kursreihen (`marketFromPrices`, `parseMarketFile`) |
| `wealthcurve/quotes` | `server/quotes.ts` | `fetchQuotes(symbol)` – Kurse von Yahoo, bereinigt um Splits und Dividenden |

```ts
import { buildProjection, DEFAULT_MODEL, DEFAULT_PARAMS } from 'wealthcurve'
import { fetchQuotes } from 'wealthcurve/quotes'

const kurs = await fetchQuotes('NVDA')
if (!kurs.ok) throw new Error(kurs.fehler.error)
const p = buildProjection({
  scenarios: [{ id: 'a', label: '100 $', colorSlot: 1,
    params: { ...DEFAULT_PARAMS, initialCapital: 100, monthlyContribution: 0 } }],
  seriesIds: ['marketReturn'],
  model: { ...DEFAULT_MODEL, accumulationYears: 10, withdrawalYears: 0,
           startYear: 2015, startMonth: 10 },
  markets: [kurs.daten],
})
```

Reines Node ab 23.6 führt das direkt aus – es entfernt die Typen selbst. Dafür
trägt jeder relative Import in `src/core` die Endung `.ts`; `node-import.test.ts`
prüft das und lädt beide Einstiege in einem eigenen Node-Prozess.

Node entfernt Typen allerdings nicht innerhalb von `node_modules`. Ein
`npm install github:…` scheitert deshalb beim Start; eingebunden wird das Projekt
als Verweis auf eine Arbeitskopie (`"wealthcurve": "file:../WealthCurve"`,
Workspace oder Git-Submodul). npm legt dann einen Symlink an, Node folgt ihm aus
`node_modules` heraus, und alles läuft.

## Eine neue Serie hinzufügen

Das ist der Zweck der Architektur: **eine neue Datei, eine neue Zeile.** Chart, Regler, Legende,
Tooltip, Tabelle und KPI-Zeile ziehen automatisch nach.

### 1. Serien-Datei anlegen

```ts
// src/core/domain/series/realEstate.ts
import { defineSeries } from '../types.ts'

export const realEstateSeries = defineSeries({
  id: 'realEstate',
  label: 'Immobilie',
  description: 'Wertentwicklung bei eigener Rate.',
  colorVar: 'var(--chart-6, #008300)',   // freier Slot, Fallback wie in src/index.css
  unit: 'currency',
  defaultEnabled: false,
  requiredParams: ['years', 'initialCapital', 'appreciationRate'],
  compute: ({ base, params }) => base.years.map((y) => /* … */),
})
```

### 2. Falls nötig: Parameter ergänzen

```ts
// src/core/domain/parameters.ts
appreciationRate: {
  label: 'Wertsteigerung p. a.',
  unit: 'percent',
  min: 0, max: 10, step: 0.1, defaultValue: 3,
  group: 'annahmen',
  category: 'annahmen',   // Pflicht: welche Einstellungs-Karte den Regler zeigt
},
```

### 3. Im Registry eintragen

```ts
// src/core/domain/series/index.ts
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
selbst. Dadurch lebt die Zinslogik an genau einer Stelle (`core/domain/math.ts`), und weil keine Serie
eine andere sieht, sind Abhängigkeiten zwischen Serien strukturell unmöglich.

```ts
// Projektion - der Normalfall
compute: ({ base }) => base.years.map((y) => y.balance)

// Eigene Dynamik - der Notausgang, siehe savingsAccount.ts
compute: ({ params, model }) =>
  simulate({ annualRatePercent: params.savingsRate, /* … */, model }).years.map((y) => y.balance)
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

`test/i18n/keys-coverage.test.ts` liest den Quelltext und verlangt für jedes `t('…')` einen englischen
Eintrag. Ausnahmen stehen einzeln begründet in `NUR_DEUTSCH`. Die Einstellungssuche findet in beiden
Sprachen (`test/components/i18n-gaps.test.tsx`).

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

Dazu kommt ein Cache im Prozess (`server/quotes.ts`): Erfolge bleiben 24 Stunden im Speicher, höchstens
200 Symbole. Parallele Anfragen zum selben Symbol teilen sich einen Abruf. Fehler werden nicht gemerkt,
damit sich eine Drosselung erholen kann. So fragen `npm run dev`, `npm run serve` und der MCP-Server
Yahoo nicht bei jeder Anfrage erneut an. Auf Vercel wirkt zusätzlich der Edge-Cache; der Speicher
gilt pro Instanz.

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

Ab wann gehalten wird, legen Startjahr und Startmonat fest (Einstellungen →
Zeit). Ohne Monat gilt der Januar; „vor genau zehn Jahren" braucht ihn. Die
Achse zählt danach ganze Jahre ab diesem Monat.

### Veröffentlichen

| Ziel | Datei | Live-Kursabruf |
|---|---|---|
| GitHub Pages | `.github/workflows/pages.yml` | nein — Dateiimport (siehe oben) |
| Vercel | `vercel.json` + `api/quotes.ts` | ja |
| Eigener Server | `npm run serve` | ja |

`pages.yml` prüft (`typecheck`, `lint`, `test`) und veröffentlicht danach `main`.
`ci.yml` führt dieselben Prüfungen auf jedem Branch und jedem Pull Request aus, damit
Fehler vor dem Merge auffallen. Einmalig nötig: unter Settings → Pages als Quelle
**GitHub Actions** wählen.

Ein Punkt, der leicht übersehen wird: die Seite liegt unter `/<repo>/` und
nicht auf der Wurzel. Der Build bekommt den Basis-Pfad deshalb von
`actions/configure-pages` — ohne ihn schreibt Vite Skript und Stil absolut, und
die Seite bliebe weiß.

Aus demselben Grund sind die Pfade in `public/site.webmanifest` relativ
(`favicon.svg`, nicht `/favicon.svg`): Vite schreibt `index.html` auf den
Basis-Pfad um, das Manifest aber nicht — mit absoluten Pfaden liefen die Symbole
unter einem Unterpfad ins Leere.

## Depot-Analyse

Im Bereich **Mein Depot** lässt sich ein eigenes Depot laden:
aus Excel kopiert, als `.xlsx`-, CSV- oder TSV-Datei geladen oder aufs Feld gezogen –
auch Broker-Exporte mit Positionswerten statt Anteilen. `.xlsx` liest
`src/core/depot/xlsx.ts` ohne Bibliothek (ZIP über `DecompressionStream`, XML per
Muster). Die Depot-Seite zeigt dann:

- **Kennzahlen** – Rendite p. a., Schwankung p. a., Rendite je Risiko und größter
  Rückgang über 5/3/1 Jahre, gewichtete TER, Marktengagement inklusive Hebel, je
  Position Rendite, Schwankung, Risiko- und Kostenanteil.
- **Durchschau** – Kontinente, Märkte (MSCI), Länder, GICS-Branchen,
  Unternehmensgröße, Währungen, Produktarten und die größten Firmen über alle
  Positionen zusammen.
- **Risiken** – feste Regeln (`FLAG_LIMITS` in `src/core/depot/flags.ts`): Klumpen,
  Länder- und Branchenschwerpunkt, Hebel, Risikotreiber, Fremdwährung, Kostentreiber,
  doppelt gehaltene Aktien, historischer Rückgang, fehlende Daten. Beschreibend,
  keine Empfehlungen.
- **Was-wäre-wenn** – andere Anteile eintragen, Kennzahlen und Durchschau
  vergleichen, heute oder die Variante als Szenario in die Vermögenskurve übernehmen
  (mit der historischen Rendite als Annahme).

| Spalte | Pflicht | Inhalt |
| --- | --- | --- |
| `WKN` / `ISIN` | ja | Schlüssel der Position |
| `Anteil` | ja¹ | `39,81 %`, `0.3981` oder `39.81` (ohne Zeichen entscheidet die Summe) |
| `Wert` / `Marktwert` / `netValue` | ja¹ | Positionswert in Euro (`12.345,67 €`) – die Anteile folgen aus der Summe |
| `ISIN` | nein | Durchschau, wenn die Spalte `Durchschau` fehlt (auch aus einer ISIN als Schlüssel) |
| `Name`, `Symbol` | nein | Symbol = Yahoo-Ticker für die Kennzahlen, z. B. `EUNL.DE` |
| `TER`, `Hebel`, `Typ` | nein | Typ `ETF`, `Aktie` oder `ETC` |
| `Durchschau` | nein | ETF: ISIN eines Amundi-ETFs, `:US`/`:EU`/ISO-Code für nur diesen Teil; Aktie: eigene ISIN; ETC: Rohstoff |

¹ Eine der beiden. Fehlt `Typ`, entscheiden der Name („ETF“, „UCITS“, Anbieter → ETF;
„ETC“, „Gold“ → ETC) und die TER (0 → Aktie).

Kurse kommen über `/api/quotes` (Fremdwährungen über `EUR…=X` in Euro umgerechnet),
Fondsbestände über `/api/holdings?isin=` aus der Produkt-Schnittstelle von Amundi
(`server/holdings.ts`, eingehängt wie die Kurse in Vite, `npm run serve` und
Vercel). Die Unternehmensgröße ist aus den Indexgewichten geschätzt, geeicht an den
Börsenwerten großer US-Werte. Das Depot bleibt im Browser: der Teilen-Link lässt es
weg. Gerechnet wird die Geschichte der heutigen Mischung, monatlich neu gewichtet –
nicht die eines echten Kontos, und keine Vorhersage.

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

**Beträge in heutiger Kaufkraft:** Ist die Option aktiv, zahlt die Prozentregel im ersten
Entnahmejahr genau Satz × nominales Kapital bei Rentenbeginn und wächst danach mit der Inflation.
Ohne die Zurückrechnung zählte die Inflation der Ansparjahre doppelt – die 4-%-Regel entnähme dann
rund 7 %. Die Begründung steht am `simulate` in `src/core/domain/math.ts`.

**Jahrestabelle als CSV:** Der Knopf in der Jahrestabelle lädt alle Jahreszeilen mit den aktiven
Linien herunter. Semikolon als Trenner und Komma als Dezimalzeichen – so öffnet Excel in deutscher
Einstellung die Datei ohne Nachfrage. Vorangestellt ist eine UTF-8-BOM, sonst zerlegt Excel „€“ und
Umlaute (`src/core/csv.ts`, `src/lib/download.ts`).

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

## Aufbau der Oberfläche

Zwei Bereiche in der Kopfzeile (`src/components/Dashboard.tsx`), gespeichert als
`page` im Zustand, nicht im Teilen-Link:

- **Sparplan** (`src/components/sparplan/SparplanPage.tsx`) – links „Dein Plan“ mit
  Rendite (samt Schnellwahl 3/5/7 % und „Wie mein Depot“), Startkapital, Sparrate und
  Laufzeit; darunter zugeklappte Abschnitte für Auszahlung, Annahmen, Kurven &
  Darstellung, echte Kursverläufe und Zeitachse. Rechts Ergebnis, Kurve und
  Jahrestabelle; auf dem Handy steht das Ergebnis oben. Eine Entnahmephase ist ab
  Werk aus (nur im App-Startzustand – `DEFAULT_MODEL` der Kern-API bleibt).
- **Mein Depot** (`src/components/depot/DepotPage.tsx`) – leer eine Ablagefläche
  (Datei, eingefügte Tabelle oder Beispiel), danach Kennzahlen, die wichtigsten
  Auffälligkeiten, Durchschau, Verlauf, Was-wäre-wenn und „Daten & Quellen“ mit
  bearbeitbarem Kurssymbol, Typ, Hebel, TER und Durchschau-Quelle je Position.
  „Im Sparplan weiterrechnen“ legt ein Szenario mit der historischen Rendite an.

Das Zahnrad (`SettingsDialog`) trägt nur noch, was die ganze App betrifft: Sprache,
Farbschema, Teilen, Zurücksetzen und – im Sparplan – das Video. Gezeigt werden nur
Regler, die gerade etwas bewirken: Parameter, die keine aktive Serie und keine
gewählte Entnahmeregel liest, verschwinden samt Hinweis.

### Speichern, Teilen, Zurücksetzen

Der Zustand liegt im `localStorage` unter `wealthcurve.state.v1` (`src/lib/persistence.ts`).
Geschrieben wird entprellt, beim Verlassen der Seite sofort. Schlägt der Zugriff fehl – privates
Fenster, gesperrte Website-Daten, volle Quota –, läuft die App ohne Speicher weiter.

Beim Einlesen wird nichts ungeprüft übernommen. Alles läuft durch `deserialize`, das Modell durch
`sanitizeModel`, die Szenarien durch eine eigene Bereinigung (eindeutige IDs, freie Farb-Slots).
Fremde oder kaputte Daten werden geklemmt oder verworfen, nie in die Rechnung durchgereicht.

„Link teilen“ (Einstellungen → Allgemein) kopiert einen Link mit `#s=` und allen Szenarien und
Einstellungen, ohne Oberflächenzustand. Kursdaten fehlen im Link und müssen nach dem Öffnen neu
geladen werden – sie würden die URL sprengen. Wer den Link öffnet, bekommt diesen Stand; er hat
Vorrang vor dem gespeicherten. Danach wird der Hash entfernt, damit ein Neuladen spätere
Änderungen nicht überschreibt.

„Zurücksetzen“ steht daneben und fragt erst nach. Ein versehentlicher Klick löscht sonst alles.

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
- Während der Aufnahme lässt sich abbrechen. Der Tab muss dafür im Vordergrund bleiben: wechselt er
  in den Hintergrund, bricht die Aufnahme ab (`src/lib/recordCanvas.ts`).

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
    model.ts       ModelSettings, sanitizeModel - Modell beim Einlesen bereinigen
    series/        eine Datei pro Serie + index.ts als Registry
    withdrawal/    eine Datei pro Entnahmeregel + Registry
  encoding/        Farb-/Strichzuordnung als austauschbare Strategie
  projection.ts    buildProjection() - die zentrale Rechnung
  csv.ts           Jahrestabelle als CSV (Semikolon, Dezimalkomma)
  market.ts        Kursreihen aus Preisen - derselbe Weg für Abruf und Datei
  timeAxis.ts      Beschriftung der Zeitachse (Jahre, Kalender, Alter)
  settings/        Suchindex, aus den Registries abgeleitet
  state.ts         AppState, Aktionen, Reducer, Serialisierung
  store.ts         beobachtbarer Store (~40 Zeilen, ohne Bibliothek)
  derive.ts        memoisierte Selektoren
  index.ts         öffentliche API
  animation/       Zeitachse fürs Video - kein Canvas, kein DOM
  chart-style/     Darstellungsstile als reine Daten
src/render/        Pixel: Canvas-Renderer und die Skizzen-Curve
src/react/         Bindung an den Store über useSyncExternalStore
src/lib/           Formatter und Zahlenparser je Sprache, Persistenz und Teilen-Link,
                  Aufnahme und MP4-Transcoding, CSV-Download, Pfeiltasten- und
                  Backdrop-Helfer, Tonspur, Klassennamen (cn)
src/components/    UI; nur chart/ kennt Recharts
  sparplan/        Sparplan-Seite mit Plan-Formular und Ergebnis
  depot/           Depot-Seite: Import, Kennzahlen, Durchschau, Bestands-Editor
  layout/          Einstellungsdialog (Sprache, Farbschema, Teilen, Video)
  video/           Export-Dialog mit Vorschau
test/              alle Tests, spiegelt src/ - Importe über den Alias @/
```

Das Plan-Formular steht auf dem Desktop als eigene, mitlaufende Spalte neben dem
Ergebnis; darunter folgt es dem Ergebnis in derselben Spalte. Die Zusatz-Abschnitte
sind native `<details>` – Tastatur, Screenreader und „Auf Seite suchen“ kommen vom
Browser statt aus einer Bibliothek, wie beim `<dialog>` der Einstellungen.

Farben liegen als CSS-Variablen (`--chart-1` … `--chart-8`) in `src/index.css`, je einmal für Hell
und Dunkel. Die Palette ist auf Farbfehlsichtigkeit geprüft (schlechtestes Nachbarpaar ΔE 9.1 hell /
8.4 dunkel). Der Farb-Slot gehört fest zur Serien-ID — nie an die Reihenfolge koppeln, sonst färbt
sich der Chart beim Ein- und Ausschalten um.
