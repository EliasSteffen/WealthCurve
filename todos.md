## Erledigt

- [x] tests — 149 Tests: Finanzmathematik, Registries, Store, Animation, Renderer,
      Einstellungs-Suche, Architektur-Wächter
- [x] entnahme plan konfigurieren können
  - Phasenmodell (ansparen → entnehmen, Rest arbeitet weiter), Entnahmeregeln als
    Registry (fester Betrag / Prozentregel), Depot läuft nie ins Minus,
    „Kapital reicht bis Jahr X" als Kennzahl
- [x] alle szenarien teilen den gleichen zeitraum — Anspar- und Auszahldauer sind
      globale Modell-Einstellungen, nicht Szenario-Parameter
- [x] responsive design — einklappbare Sidebar mit eigenem Scroll auf dem Desktop,
      Bottom-Sheet über nativem `<dialog>` auf Mobil
- [x] als MCP server zur Verfügung stellen — `npm run mcp`, drei Tools über stdio:
      `berechne`, `jahrestabelle`, `moeglichkeiten`
- [x] video pop up ist super klein — Dialog hat jetzt eine feste Größe statt nur
      `max-width`; die Vorschau füllt den freien Platz (307×545 statt 233×414)
- [x] einstellungen in kategorien aufteilen und suchbar machen — fünf Kategorien
      plus Suchfeld; der Index wird in `src/core/settings/` aus den Registries
      abgeleitet, eine neue Serie ist dadurch sofort auffindbar
- [x] Videos konfigurierbar machen mit aufhänger -> aufbau -> pointe — Text und
      Dauer je Abschnitt einstellbar, Platzhalter wie `{{zinsertrag}}`
- [x] WebM → MP4 im Browser umwandeln (ffmpeg.wasm) — lädt erst beim Klick,
      nicht beim Seitenaufruf
- [x] Verschiedene Darstellungsoptionen bei dem Graphen — fünf Stile als Registry
- [x] Alle tests in einem dediziertem `test/` Verzeichnis

## Offen

- [ ] entnahme muss auch auf das eingezahlte geld einberechnet werden
- [ ] auch inflation mit einberechnen
- [ ] in dem video aufhänger ... müssen auch alle szenarien dargestellt werden können
  - Die Kurven zeigen schon alle Szenarien; Titel, große Zahl und Platzhalter
    stammen bisher nur aus dem ersten.
- [ ] Invests in eine aktie mit anzeigen. daten von yahoo finance
  - [ ] Wie hätte sich das geld nicht bei festen 8 % p. a. entwickelt sondern bei
        monatlichen invests in eine bestimmte aktie/etf/…
- [ ] mehrsprachigkeit
- [ ] License
- [ ] git history fixen
- [ ] github pages deploy step einfügen

## Ideen

- [ ] Szenarien speichern / per Link teilen — `serialize()` und `deserialize()`
      sind vorhanden und getestet, es fehlt nur die Anbindung
- [ ] Steuern (Abgeltungsteuer, Vorabpauschale) als weitere Serie
- [ ] Sparraten-Dynamik (jährliche Erhöhung der Rate)
- [ ] Tonspur oder Untertitel fürs Reel
