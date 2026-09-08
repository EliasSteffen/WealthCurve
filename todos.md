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
- [ ] zukünftige Ausbaustufe: video animationen ermöglichen (wie die instagram
      reels, die zeigen, wie viel der zinses-zins effekt bringt)
  - Architektur hält das offen: `buildProjection` ist rein und pro Frame
    aufrufbar, `rows` ist ein schlichtes Array und bis Jahr n schneidbar.
    Voraussetzung bleibt, dass Recharts die einzige Chart-Datei ist — das sichert
    der Wächtertest `src/core/no-react.test.ts` mit ab.

## Ideen

- [ ] Szenarien speichern / per Link teilen — `serialize()` und `deserialize()`
      sind vorhanden und getestet, es fehlt nur die Anbindung
- [ ] Steuern (Abgeltungsteuer, Vorabpauschale) als weitere Serie
- [ ] Sparraten-Dynamik (jährliche Erhöhung der Rate)
