# Imposter

Das Partyspiel für Handys: alle bekommen dasselbe geheime Wort – außer dem Imposter.
Reihum nennt jede:r ein einziges Wort, dann wird diskutiert und abgestimmt.

Deutsch ist Standard, Englisch lässt sich im Startmenü umschalten.

**Live:** https://imposter-puce.vercel.app

## Zwei Spielarten

| | Ein Handy | Eigene Handys |
|---|---|---|
| Aufbau | Ein Gerät wandert durch die Runde | Raum-Code, jede:r steigt am eigenen Gerät ein |
| Karten | Nacheinander aufdecken | Jede:r sieht nur die eigene |
| Abstimmung | Tisch einigt sich, einer tippt | Geheim, jede:r für sich |
| Internet | Nicht nötig, läuft offline | Nötig |

## Entwickeln

```bash
npm install
npm run dev      # http://localhost:5173 – im Netz unter der LAN-IP erreichbar
npm run build
npm run preview
npm run icons    # PNG-Icons neu rendern

npm run test:rules                           # Spielregeln, ohne Server
npm run test:live                            # Abnahmelauf gegen die Produktion
npm run test:live -- http://localhost:5173   # ... oder gegen den Dev-Server
```

`scripts/rules.mjs` prüft die Regeln selbst, mit geseedetem Zufall und ohne Netz:
dass dreimal hintereinander Imposter selten bleibt, dass der Imposter nicht ständig
anfangen oder abschließen muss, dass die Uhr weiterläuft statt neu zu starten, dass
eine abgelaufene Uhr die Runde an die Imposter gibt, eine laufende Abstimmung aber
stehen lässt, und dass kein Punkt auf einem Konto landet, bevor die Runde vorbei ist. Es lädt die
TypeScript-Module über Vites SSR-Loader und braucht deshalb keinen Testrunner.

`scripts/acceptance.mjs` spielt eine komplette Online-Partie durch und prüft dabei
das, was man beim Klicken nicht sieht: dass der Imposter das Wort nie geschickt
bekommt, dass eine abgegebene Stimme ihr Ziel nicht verrät, dass nur der Gastgeber
die Runde taktet, dass eine neue Partie nicht die Bereit-Meldungen der alten erbt,
dass ein abgesprungenes Handy seinen Platz zurückbekommt und dass der Stream
innerhalb einer Sekunde pusht.

Der Dev-Server bindet auf alle Interfaces, also lässt sich `http://<LAN-IP>:5173`
direkt am Handy öffnen. **Der Online-Modus funktioniert lokal ohne jede Cloud:**
ohne Upstash-Credentials fällt `api/_lib/kv.ts` auf einen In-Memory-Store zurück,
und ein Vite-Plugin führt die Dateien in `api/` genauso aus wie Vercel es tut.
Auf Vercel ist dieser Fallback gesperrt – dort sind fehlende Credentials ein Fehler.

## Spielablauf

1. **Startmenü** – Sprache, dann Spielart wählen.
2. **Aufstellung** – die Reihenfolge der Liste ist die Reihenfolge am Tisch; Pfeile
   stellen um. Online macht das der Gastgeber in der Lobby.
3. **Einstellungen** – Anzahl Imposter, Kategorie-Hinweis, Runden, Uhr (1–5 Minuten),
   „Letzte Chance", Reihenfolge, Fairness, Punkte, Wortkategorien. Online stellt das
   der Gastgeber.
4. **Karten** – jede:r deckt einmal auf.
5. **Diskussion** – Startspieler:in, Reihenfolge, die Rundenuhr. Läuft sie ab, ohne
   dass abgestimmt wurde, ist die Runde vorbei und gehört den Imposter.
6. **Abstimmung** – eine Person fliegt raus, ihre Rolle wird aufgedeckt. Nur ihre. Eine
   einmal eröffnete Abstimmung wird zu Ende gespielt, auch wenn die Uhr dabei abläuft.
7. **Patt** – hat die Abstimmung nichts entschieden, wählt der Gastgeber: *Neue
   Wortrunde* oder *Direkt abstimmen*. Die Uhr läuft dabei weiter.
8. Zivilisten gewinnen, wenn alle Imposter draußen sind; Imposter gewinnen, sobald sie
   gleich viele sind wie der Rest – oder sobald die Uhr abgelaufen ist.
9. **Punkte** nach jeder Runde, Endstand nach der letzten.

## Punkte

Jede Zeile ist in den Einstellungen einstellbar; 0 schaltet sie ab.

| Wofür | Wer | Standard |
|---|---|---|
| Stimme landet auf einem Imposter | der Zivilist, der getippt hat | +1 |
| Abstimmung überstanden | jeder noch lebende Imposter | +1 pro Abstimmung |
| Wort bei „Letzte Chance" erraten | der erwischte Imposter | +1 |
| Die Uhr läuft ab | jeder noch lebende Imposter | +1 |
| Runde gewonnen | die siegreiche Seite | 0 (aus) |

**Gebucht wird während der Runde, ausgezahlt erst danach.** Ein Punktestand, der mitten
in der Runde steigt, würde verraten, wer richtig getippt hat – deshalb sammelt die Runde
ihre Punkte in `round.earned` und schreibt sie erst am Rundenende gut. Die Wertung zeigt
dann neben jedem Namen, was die Runde eingebracht hat.

## Weniger Zufall

Reiner Zufall ist oft genug unfair, dass es am Tisch auffällt. Drei Stellschrauben,
alle abschaltbar:

- **Imposter-Rotation.** Wer die Karte gerade hatte, wiegt in der nächsten Ziehung ein
  Viertel, wer sie zweimal hatte ein Sechzehntel. Bei fünf Leuten fällt „zweimal
  hintereinander" damit von 20 % auf rund 6 %, dreimal hintereinander wird zur
  Ausnahme – bleibt aber möglich, sonst wäre es keine Ziehung mehr.
- **Randplätze.** Anfangen heißt ohne Anhaltspunkt reden, abschließen heißt gegen fünf
  Hinweise anreden; beides trifft den Imposter härter als alle anderen. Er wird deshalb
  mit einstellbarer Wahrscheinlichkeit aus dem ersten und letzten Stuhl geschoben –
  nicht immer, sonst wäre der Startplatz selbst die Auskunft.
- **Reihenfolge.** *Rotierend* behält die Aufstellung bei und rückt den Start jede Runde
  einen Platz weiter, *Fix* nimmt sie genau so, *Zufall* mischt neu.

## Architektur

```
src/
  game/state.ts      reine, serialisierbare Spiellogik (Reducer, kein React)
  game/words.ts      Wortbank, jedes Wort als de/en-Paar
  game/i18n.ts       Übersetzungen, typsicher über den deutschen Schlüsselsatz
  online/protocol.ts Wire-Format, von Client und API geteilt
  online/client.ts   fetch-Wrapper und der EventSource-Hook
  game/portraits.ts  Rollenbilder, Namens-Portraits und die Gast-Heuristik
  game/fairness.ts   gewichtete Ziehung und Sitzordnung, rein und testbar
  game/leaderboard.ts  Leaderboard, pro Gerät, über beide Spielarten
  components/RoleCard.tsx  verdeckte Karte, Flip-Animation, Bild
  components/PortraitCard.tsx  jedes Gesicht als volle Karte, über Context
  screens/           ein Screen pro Phase, lokal wie online
api/
  room.ts            Raum anlegen, beitreten, Snapshot
  action.ts          jede Zustandsänderung, mit Autorisierung
  stream.ts          Server-Sent Events
  _lib/kv.ts         Upstash über REST, mit In-Memory-Fallback
  _lib/room.ts       Persistenz, Präsenz, Redaktion der Sicht
```

`game/state.ts` läuft auf beiden Seiten: der Browser nutzt ihn für Pass-and-Play,
die API für den Online-Raum. Er kennt weder DOM noch Zufall zur Laufzeit – Runden
erzeugt `makeRound()` und gibt sie als Action hinein.

**Was ein Gerät erfahren darf**, entscheidet `viewFor()` auf dem Server: der Imposter
bekommt das Wort gar nicht erst geschickt, und wer rausgewählt wird, deckt nur die
eigene Rolle auf – nie die der anderen. Abstimmungen liegen in einem Redis-Hash,
Bereit-Meldungen in einem Set, damit gleichzeitige Klicks sich nicht überschreiben;
wer die Abstimmung vollmacht, wertet sie aus und hält dafür kurz ein Lock.

**Die Rollenkarte** liegt verdeckt, bis der Knopf unten gedrückt wird; dann dreht
sie in 3D auf das Bild für die eigene Rolle. Die Rückseite ist fuer beide Rollen
identisch, damit der Bildschirm vorher nichts verrät. Eigene Portraits für
bestimmte Namen trägt man in `src/game/portraits.ts` ein – das Bild erscheint dann
über dem Namen statt der Initiale.

**Portraits** matchen breit: Großschreibung, Umlaute und Satzzeichen sind egal, und
nur das erste Namenstoken zählt. „Jan“, „JAN“ und „Jan-Andre“ landen also auf
demselben Bild, „Janine“ bleibt fremd. Wer kein eigenes Bild hat, bekommt eines von
zwei Gast-Portraits; welches, entscheidet eine Namensheuristik – die liegt manchmal
daneben, dagegen hilft ein Eintrag in `ALIASES`. Dieselben Bilder erscheinen als
Avatar-Bubble in jeder Liste: Lobby, Abstimmung, Rundenwertung, Endstand.

**Zwei Tabellen:** der Endstand einer Partie und das **Leaderboard**, das jede
beendete Partie mitzählt – Punkte, Partien, Siege. Es liegt im localStorage des
Geräts, gilt für beide Spielarten und wird über eine Spiel-ID gegen Doppelzählung
abgesichert. Erreichbar vom Startmenü und von jedem Endstand.

**Die Rolle steht im Raum, nicht auf der Karte.** Verdeckt sehen beide Karten gleich
aus. Aufgedeckt färbt sich der Hintergrund *hinter* der Karte rot, wenn du Zivilist
bist, und bleibt schwarz, wenn du Imposter bist; das Zivilisten-Bild selbst bleibt, wie
es gezeichnet ist. Das ist bewusst gewählt und kostet etwas: vorher waren beide Karten
auf wenige Punkte pro Farbkanal angeglichen, weil im Livetest der Schein vom Handy die
Rolle verriet, bevor jemand ein Wort gesagt hatte. Die Raumfarbe ist der größere
Leuchtfleck – wer aufdeckt, sollte das Handy also abschirmen.

**Eine Uhr pro Wortrunde, und sie gehört dem Server.** `round.deadlineAt` ist ein
Zeitpunkt, kein Restwert: jedes Handy zählt auf denselben Moment herunter, ein Reload
nimmt die Uhr dort auf, wo sie war, und eine zweite Wortrunde frisst dieselben Minuten
weiter. Läuft sie ab, während noch diskutiert wird, beendet der Server die Runde und
schreibt sie den Imposter gut. Läuft sie ab, während schon abgestimmt wird, buchen die
überlebenden Imposter nur ihren Punkt – die Stimmen, die bereits liegen, verfallen
nicht.

**Der Gastgeber wandert mit.** Verlässt er den Raum, erbt ihn jemand, der gerade am
Handy ist; mitten im Spiel bleibt sein Platz stehen, damit die Runde nicht
auseinanderfällt. Ist er einfach weg, ohne sich abzumelden, kann ihn nach rund
anderthalb Minuten jede:r andere übernehmen.

**Ein leerer Platz gehört weiter dem, der ihn hatte.** Wer rausfliegt, neu lädt oder
das Spiel schließt, kommt mit demselben Namen an denselben Platz zurück – mitten im
Spiel und auch von einem anderen Gerät, weil der Platz dabei ein neues Token bekommt.
Solange jemand auf dem Platz online ist, bleibt der Name gesperrt.

**Der Stream hat ein Netz unter sich.** Ein Handy, das in der Tasche einschläft, kommt
mit einer `EventSource` zurück, die sich nie wieder verbindet – das war der Grund,
warum im Livetest ausgerechnet der Gastgeber neu laden musste. Jetzt bewacht ein Timer
den Stream: vier Sekunden still und der Raum wird über HTTP nachgeladen, elf Sekunden
still und der Stream wird weggeworfen und neu aufgebaut. Jeder Wechsel zurück in den
Vordergrund lädt sofort nach. Wo Server-Sent Events ganz blockiert sind, trägt das
Nachladen die Partie allein.

Mobile-First: `100dvh`, `env(safe-area-inset-*)`, Touchziele ≥ 52 px, 16-px-Inputs
(kein iOS-Zoom), `clamp()`-Typografie, PWA-Manifest plus Service Worker.

## Betrieb

Vercel-Projekt `imposter`, Region `fra1`, Upstash Redis `imposter-kv` (Free).
Push auf `master` deployt automatisch.

Drei bewusste Kompromisse:

- **Der Stream pollt.** Upstash spricht REST, also kein Pub/Sub: `api/stream.ts` liest
  einmal pro Sekunde einen Versionszähler und schickt den Raum nur bei Änderung. Das
  kostet rund ein Redis-Kommando pro Sekunde und Spieler – auf dem Free-Tier (500.000
  Kommandos/Monat) reicht das für etwa 15 Stunden Spiel mit acht Leuten.
- **Relative Imports in `api/` brauchen `.js`.** Vercel transpiliert die Dateien
  einzeln nach ESM statt sie zu bündeln, und Node löst extensionlose Specifier
  zur Laufzeit nicht auf. Vite mappt `.js` weiterhin auf die `.ts`-Datei, lokal
  fällt es also nicht auf – dafuer stirbt jede Function in Produktion.
- **Das Token steht in der Stream-URL.** `EventSource` kann keine Header setzen. Es ist
  ein Wegwerf-Token für einen Raum, der nach sechs Stunden verfällt; sauberer wäre ein
  HttpOnly-Cookie.

## Offen

- [ ] Eigene Wortlisten
- [ ] QR-Code für den Raum-Beitritt
- [ ] Punkte-Voreinstellungen als benannte Profile
