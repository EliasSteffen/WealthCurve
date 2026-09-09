# Todos

## Erledigt

- [x] `{{rendite}}` im Video nennt immer das erste sichtbare Szenario —
      jetzt `{{s1.rendite}}`, `{{s2.endkapital}}` je Szenario und `{{renditen}}`
      als Sammelform (`94f084f`)
- [x] `selectActiveParamIds` — der Kommentar war falsch, nicht das Verhalten;
      Karten, die dadurch leer werden, nennen jetzt den Grund (`e2fb18d`)
- [x] Farbe soll wählbar sein — Szenariofarbe aus den acht geprüften
      Palettenfarben, belegte gesperrt (`23ecaea`)
- [x] Platzhalter je Szenario (`94f084f`)
- [x] Start der Auszahlung im Video anzeigen (`7111e4b`)
- [x] Logo für die Web-App (`c63daff`)
- [x] Auszahlung generell optional (`e2fb18d`)
- [x] Eingabe des Startjahrs — der Rohtext bleibt beim Tippen stehen, geklemmt
      wird erst beim Verlassen (`b94e711`)
- [x] Szenario-Einstellungen getrennt — zwei Bereiche „Nur <Szenario>" und
      „Für alle Szenarien" (`8635e42`)
- [x] Jahreszahlen im Video optional (`7111e4b`)

## Offen

- [ ] Szenarien speichern / per Link teilen — `serialize()` und `deserialize()`
      sind vorhanden und getestet, es fehlt nur die Anbindung. Das MCP-Werkzeug
      `zustand` benutzt beide bereits.
- [ ] Steuern (Abgeltungsteuer, Vorabpauschale) als weitere Serie — die
      Vorabpauschale braucht den Basiszins je Jahr, also eine Datenquelle
- [ ] Sparraten-Dynamik über die Inflation hinaus (z. B. Gehaltssprünge)
- [ ] Tonspur oder Untertitel fürs Reel — `MediaRecorder` nimmt nur das Canvas
      auf, Ton bräuchte eine zweite Spur
- [ ] Weitere Sprachen — der Katalog ist dafür vorbereitet

## Aufgefallen, aber nicht angefasst

- [ ] Die Legende im Video zeigt beim Vergleich einen Eintrag je Serie und nimmt
      dafür die Farbe der zuletzt gebauten Linie — im Bild kann so „Zinseszins"
      orange sein, obwohl die erste Kurve blau ist.
