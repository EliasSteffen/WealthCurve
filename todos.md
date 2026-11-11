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
- [x] Legende im Video nimmt je Serie die Farbe der ersten Linie, nicht der
      zuletzt gebauten — „Zinseszins" bleibt blau (`429ce5e`)
- [x] `public/icons.svg` entfernt — Rest der Projektvorlage ohne Referenz
- [x] Szenario-Zusatz in der Legende auch bei Ersatznamen kürzen (`76fec73`)
- [x] Restliche Übersetzungslücken geschlossen, Video-Hooks verdrahtet, Guard-Test (`6ec41a4`)
- [x] Barrierefreiheit: Kontrast, Radiogruppen, Reiter, Backdrop-Klick, Fokus (`5c28c94`)
- [x] Zustand speichern, Teilen-Link, CSV-Export, Reset-Bestätigung, Code-Splitting (`fb061e8`)
- [x] Zahleneingabe je Sprache, Wertpapier-Races, Entnahmephase, Kennzahlen (`d95501a`)
- [x] Video: Querformat-Schriftgrößen, SRT-Leerzeilen, Übersetzungshooks (`429ce5e`)
- [x] Videoexport robust gegen Abbruch, Drift und Races (`6436fef`)
- [x] Prozentregel, Kursverlauf und Tagesgeld rechnen korrekt (`7864ac5`)
- [x] Modell und Zustand beim Einlesen validieren, `series`/`setEnabled` ergänzt (`bb7541d`)
- [x] Prüfungen laufen auf Branches und Pull Requests (`6f3e0b8`)
- [x] In-Memory-Cache und Abruf-Deduplizierung für `fetchQuotes` (`61a6a74`)
- [x] Server gehärtet: 400 bei kaputtem Pfad, 500 statt Absturz, Cache-Header (`5b6ad4f`)

## Offen

- [ ] Die Tonspur lässt sich vor der Aufnahme nicht vorhören, und ihre Länge
      wird nicht mit der des Videos verglichen — sie endet einfach mit der
      Aufnahme.
