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
- [x] Logo als Favicon — dazu apple-touch-icon, Web-Manifest und theme-color;
      alle Symbole entstehen aus `src/render/logo.ts` über `npm run icons`
      (`b258465`)
- [x] Sparraten-Dynamik über die Inflation hinaus (`54225db`)
- [x] Eigene Einstellungsseite — Dialog mit den Reitern Diagramm, Video und
      Allgemein; die Seitenspalte bleibt der schnelle Zugriff (`7c6ecaf`)
- [x] Weitere Einstellmöglichkeiten für das Video — Farbschema, Bildrate,
      Kopfzeile und Legende (`5dc3192`)
- [x] Tonspur und Untertitel fürs Reel — die Aufnahme legt eine gewählte
      Audiodatei als zweite Spur dazu, die Szenentexte gibt es als `.srt`
      (`ebea905`)

## Offen

- [ ] Die Legende im Video zeigt beim Vergleich einen Eintrag je Serie und nimmt
      dafür die Farbe der zuletzt gebauten Linie — im Bild kann so „Zinseszins"
      orange sein, obwohl die erste Kurve blau ist.
- [ ] `public/icons.svg` ist ein Rest aus der Projektvorlage (Bluesky- und
      andere Symbole) und wird von nichts referenziert.
- [ ] Die Tonspur lässt sich vor der Aufnahme nicht vorhören, und ihre Länge
      wird nicht mit der des Videos verglichen — sie endet einfach mit der
      Aufnahme.
