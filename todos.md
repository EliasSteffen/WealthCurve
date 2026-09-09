## Offen

- [ ] `{{rendite}}` im Video nennt immer das erste sichtbare Szenario. Bei zwei
      Szenarien mit verschiedenen Renditen ist das irreführend — ein
      `{{renditen}}` analog zu `{{szenarien}}` wäre die Entsprechung.

- [ ] `selectActiveParamIds` ist laut Kommentar „nur für die visuelle
      Hervorhebung", steuert aber tatsächlich, ob ein Regler überhaupt gerendert
      wird. Entweder der Kommentar oder das Verhalten ist falsch.

- [ ] Farbe soll wählbar sein

- [ ] In dem Video den Start der Auszahlung mit anzeigen, falls es auszahlungen geben soll.
- [ ] Logo für die Web-App

## Erledigt in dieser Runde

- [x] **1. co-authored by aus allen Commits entfernen** — von dir selbst
      erledigt. Nachgeprüft: eine Suche über alle 11 Commit-Bodies nach
      `co-author`, `noreply@anthropic` und `claude` findet nichts, und die SHAs
      haben sich geändert. Kein Commit nötig.
- [x] **2. anfangsalter oder anfangsjahr als option** — `9b4b53b`. Die Achse
      beschriftet wahlweise mit Lebensalter oder Kalenderjahr. Reine Anzeige:
      `year` bleibt überall ein Index, ein Test hält fest, dass das Umschalten
      keine Zahl ändert. Fürs Startjahr gilt deine Regel: ohne Anker zeichnet
      der Kursverlauf nichts, mit Anker springt er um die passenden Monate in
      die Historie — „ab wann hätte man gehalten?".
- [x] **3. einstellungen anders kategorisieren und darstellen** — „Generell"
      war mit neun Bedienelementen zum Sammelbecken geworden. Jetzt acht
      schlanke Kategorien mit höchstens vier Elementen, dazu ein Schalter
      Kompakt/Alles. Kompakt zeigt fünf Karten, „Alles" alle acht; die Suche
      hebt die Einschränkung auf, weil wer sucht finden will.

- [x] **Knöpfe in der Seitenspalte nicht klickbar** — es waren zwei getrennte
      Fehler, der zweite war der eigentliche:

      1. **Geschlossener Dialog lag über der Seite.** `.settings-sheet` und
         `.video-dialog` setzten `display: flex` bedingungslos und hoben damit
         das `display: none` auf, das ein `<dialog>` ohne `[open]` vom Browser
         bekommt. Gemessen: der *geschlossene* Video-Dialog war 993 × 636 px
         groß, `opacity: 0`, `pointer-events: auto` — eine unsichtbare Fläche
         über dem oberen Seitenbereich, die jeden Klick darunter verschluckte.
         Je schmaler das Fenster, desto weiter reichte sie in die Seitenspalte.
         Behoben mit `display: none` in beiden `:not([open])`-Regeln; die
         Ein- und Ausblendung bleibt, dafür ist `transition: display
         allow-discrete` schon da.
      2. **Trefferflächen zu klein.** Symbolknöpfe 21 → 36 px, Seitenspalte
         einklappen 27 → 36 px, Regler 6 → 24 px (Spur bleibt optisch dünn,
         siehe `.slider` in index.css), Dialog-Schließen 28 → 40 px. Die
         Serien-Checkboxen bleiben 16 px, aber die ganze Zeile ist jetzt das
         Label und damit das Ziel — Padding am `<input>` ignorieren native
         Checkboxen, das war nachgemessen wirkungslos.

      Außerdem sagt ein deaktivierter Knopf jetzt im Titel, *warum* er nicht
      geht („Das letzte Szenario lässt sich nicht löschen") — vorher war er von
      einem kaputten nicht zu unterscheiden.

- [x] **2. die einstellungen einklappen funktioniert nicht** — die Logik war
      intakt (in jsdom geprüft), der Fehler saß im Padding:
      `cn('… p-4 sm:p-5', 'p-0')` ergibt `sm:p-5 p-0`, tailwind-merge lässt ein
      unpräfigiertes `p-0` das `sm:p-5` nicht überschreiben. Ab 640 px blieb eine
      fette leere Box stehen. `Card` hat jetzt `padded={false}` (gemessen
      378 → 61 px), und der Klappzustand liegt im Store — sonst vergisst ihn das
      Bottom-Sheet bei jedem Öffnen, weil es das Panel neu montiert.
- [x] **3. kategorie „einzahlung" und „auszahlung"**, rendite und startkapital in
      „generelle einstellungen" — die Zuordnung steht als `category` in der
      Parameter-Registry, nicht in einer zweiten Liste. Die Zeitraum-Felder
      stehen bei der Phase, auf die sie sich beziehen.
- [x] **4. mehrere aktien anzeigen können** — bis zu vier gleichzeitig. Aus einer
      Serie wird eine Kurve je Papier (`fanOut: 'markets'`), jede mit eigener
      Farbe, die weder einer anderen Serie noch einem Szenario gehört.
- [x] **5. sdk und mcp server mit vollzugriff, sowie die videos** — sieben
      Werkzeuge: komplette Projektion, Kursdaten, Zustands-Roundtrip,
      Videobauplan samt gerendertem PNG. Die Filmkodierung bleibt bewusst im
      Browser (Begründung im README).
- [x] **6. mobile gefällt mir sehr gut!** — danke!
- [x] **7. nicht auf vercel server-functions festcoden** — ein Handler, vier
      Wirte (`npm run dev`, `npm run serve`, Vercel, eigener Adapter). Ohne
      Serverfunktion bleibt die Seite voll nutzbar; Kurse kommen dann aus einer
      CSV- oder JSON-Datei.
- [x] **8. text in den generierten videos bei mehreren szenarien** — der
      Zeilenabstand folgt jetzt der Schrift statt der Bildhöhe, die
      Schriftgrößen der kürzeren Bildkante. Nebenbei zwei Altlasten gefunden: die
      Achsen zeichneten Beschriftungen oberhalb der Plotfläche, und die Fußzeile
      überlappte im Querformat.
- [x] **vite fehler (Dateiendungen)** — war eine Regression aus dem Serverumbau:
      vorher hatte `vite.config.ts` gar keine lokalen Importe. Die fünf
      betroffenen Importe tragen jetzt `.ts`, damit auch der native
      Config-Loader sie auflöst. Warnung ist weg.

## Erledigt (früher)

- [x] tests — inzwischen 220 Tests: Finanzmathematik, Registries, Store,
      Animation, Renderer, Einstellungs-Suche, Kursdaten, Sprachen,
      Architektur-Wächter
- [x] entnahme plan konfigurieren können
- [x] alle szenarien teilen den gleichen zeitraum
- [x] responsive design
- [x] als MCP server zur Verfügung stellen — `npm run mcp`, inzwischen sieben
      Tools über stdio
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
      Monatsrenditen
- [x] mehrsprachigkeit — Deutsch und Englisch, Katalog nur für Abweichungen
- [x] License — MIT
- [x] git history fixen — thematische Commits statt eines Wusts
- [x] ~~github pages deploy step~~ — überholt: seit dem Serverumbau läuft die
      Seite auch rein statisch, nur ohne Live-Kurse. Die kommen dann aus einer
      Datei. GitHub Pages wäre damit wieder möglich.

## Ideen

- [ ] Szenarien speichern / per Link teilen — `serialize()` und `deserialize()`
      sind vorhanden und getestet, es fehlt nur die Anbindung. Das MCP-Werkzeug
      `zustand` benutzt beide bereits.
- [ ] Steuern (Abgeltungsteuer, Vorabpauschale) als weitere Serie
- [ ] Sparraten-Dynamik über die Inflation hinaus (z. B. Gehaltssprünge)
- [ ] Tonspur oder Untertitel fürs Reel
- [ ] Weitere Sprachen — der Katalog ist dafür vorbereitet
