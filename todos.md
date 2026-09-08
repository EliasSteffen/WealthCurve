## Erledigt

- [x] tests — 96 Tests: Finanzmathematik, Registries, Store, Architektur-Wächter
- [x] entnahme plan konfigurieren können
  - Phasenmodell (ansparen → entnehmen, Rest arbeitet weiter), Entnahmeregeln als
    Registry (fester Betrag / Prozentregel), Depot läuft nie ins Minus,
    „Kapital reicht bis Jahr X" als Kennzahl
- [x] alle szenarien teilen den gleichen zeitraum — Anspar- und Auszahldauer sind
      globale Modell-Einstellungen, nicht Szenario-Parameter
- [x] responsive design — einklappbare Sidebar mit eigenem Scroll auf dem Desktop,
      Bottom-Sheet über nativem `<dialog>` auf Mobil

## Offen

- [ ] als MCP server zur Verfügung stellen
  - Die API ist dafür geschnitten: `buildProjection(input)` ist ein Aufruf mit
    reinem JSON rein und raus, ohne Store. `npm run demo` führt genau diesen Weg
    in Node vor. Es fehlt nur noch der stdio-Server, der die Funktion als Tool
    anbietet.
- [ ] video pop up ist super klein. unbedienbar!
- [ ] einstellungen in kategorien aufteilen und suchbar machen und generell besser organisieren
- [ ] Videos konfigurierbar machen mit aufhänger -> aufbau -> pointe
- [ ] WebM → MP4 im Browser umwandeln (ffmpeg.wasm), für Browser ohne MP4-Aufnahme
a
## Ideen

- [ ] Szenarien speichern / per Link teilen — `serialize()` und `deserialize()`
      sind vorhanden und getestet, es fehlt nur die Anbindung
- [ ] Steuern (Abgeltungsteuer, Vorabpauschale) als weitere Serie
- [ ] Sparraten-Dynamik (jährliche Erhöhung der Rate)

- [ ] Invests in eine aktie mit anzeigen. daten von yahoo finance (vermutlich die beste daten quelle).
  - [ ] Wie hätte sich das geld nicht bei festen 8% pa entwickelt sondern bei monatlichen invests in eine bestimmte aktie/etf/...
- [ ] in dem video aufhänger ... müssen auch alle szenarien dargestellt werden können.
- [ ] mehrsprachigkeit
- [ ] License
- [ ] git history fixen
- [ ] github pages deploy step einfügen
- [ ] auch inflation mit einberechnen
- [ ] entnahme muss auch auf das eingezahlte geld einberechnet werden.
