# Todos

- [ ] `{{rendite}}` im Video nennt immer das erste sichtbare Szenario. Bei zwei
      Szenarien mit verschiedenen Renditen ist das irreführend — ein
      `{{renditen}}` analog zu `{{szenarien}}` wäre die Entsprechung.

- [ ] `selectActiveParamIds` ist laut Kommentar „nur für die visuelle
      Hervorhebung", steuert aber tatsächlich, ob ein Regler überhaupt gerendert
      wird. Entweder der Kommentar oder das Verhalten ist falsch.

- [ ] Farbe soll wählbar sein
- [ ] platzhalter bei mehreren szenarien sollen auch je szenario verfügbar sein (scenario::placeholder oder so)
- [ ] In dem Video den Start der Auszahlung mit anzeigen, falls es auszahlungen geben soll.
- [ ] Logo für die Web-App
- [ ] auszahlung genrell optional machen
- [ ] die eingabe eines start jahres ist sehr buggy und lässt nur das eintippen von 1900 oder 2100 zu...
- [ ] das scenario setting gehört in eine andere spalte (es muss visuell deutlich werden, was je scenario gepseichert wird und was über die scenarien hinweg gilt)
- [ ] jahreszahlen im video optional sichbar sein.

- [ ] Szenarien speichern / per Link teilen — `serialize()` und `deserialize()`
      sind vorhanden und getestet, es fehlt nur die Anbindung. Das MCP-Werkzeug
      `zustand` benutzt beide bereits.
- [ ] Steuern (Abgeltungsteuer, Vorabpauschale) als weitere Serie
- [ ] Sparraten-Dynamik über die Inflation hinaus (z. B. Gehaltssprünge)
- [ ] Tonspur oder Untertitel fürs Reel
- [ ] Weitere Sprachen — der Katalog ist dafür vorbereitet
