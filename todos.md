## Erledigt

- [x] tests — 182 Tests: Finanzmathematik, Registries, Store, Animation, Renderer,
      Einstellungs-Suche, Kursdaten, Sprachen, Architektur-Wächter
- [x] entnahme plan konfigurieren können
- [x] alle szenarien teilen den gleichen zeitraum
- [x] responsive design
- [x] als MCP server zur Verfügung stellen — `npm run mcp`, drei Tools über stdio
- [x] video pop up ist super klein
- [x] einstellungen in kategorien aufteilen und suchbar machen
- [x] Videos konfigurierbar mit Aufhänger → Aufbau → Pointe
- [x] WebM → MP4 im Browser umwandeln (ffmpeg.wasm)
- [x] Verschiedene Darstellungsoptionen bei dem Graphen
- [x] Alle tests in einem dediziertem `test/` Verzeichnis
- [x] entnahme muss auch auf das eingezahlte geld einberechnet werden — die Serie
      „Ohne Rendite" ist jetzt ein echtes 0-%-Szenario mit denselben Entnahmen und
      ist rund zehn Jahre nach Rentenbeginn aufgebraucht
- [x] auch inflation mit einberechnen — Schalter „Beträge inflationsbereinigt":
      der eingetragene Betrag gilt als heutige Kaufkraft, nominal wächst er mit
- [x] in dem video müssen alle szenarien dargestellt werden können — eine Zeile je
      Szenario in seiner Farbe, plus Platzhalter `{{szenarien}}`
- [x] Invests in eine aktie mit anzeigen — Serie „Kursverlauf" mit echten
      Monatsrenditen über `api/quotes.ts`
- [x] mehrsprachigkeit — Deutsch und Englisch, Katalog nur für Abweichungen
- [x] License — MIT
- [x] git history fixen — thematische Commits statt eines Wusts
- [x] ~~github pages deploy step~~ — entfällt: GitHub Pages führt keine
      Serverfunktionen aus, die Kursdaten brauchen aber eine. Stattdessen Vercel
      (`vercel.json`).

## Ideen

- [ ] Szenarien speichern / per Link teilen — `serialize()` und `deserialize()`
      sind vorhanden und getestet, es fehlt nur die Anbindung
- [ ] Steuern (Abgeltungsteuer, Vorabpauschale) als weitere Serie
- [ ] Sparraten-Dynamik über die Inflation hinaus (z. B. Gehaltssprünge)
- [ ] Tonspur oder Untertitel fürs Reel
- [ ] Weitere Sprachen — der Katalog ist dafür vorbereitet
