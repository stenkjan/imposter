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
3. **Einstellungen** – Anzahl Imposter, Imposter-Hinweis, Runden, Uhr (1–5 Minuten),
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
10. **Nochmal spielen** führt zurück in die Aufstellung, nicht direkt in die
    nächste Partie: Uhr, Rundenzahl, Wortkategorien, Sitzordnung und wer
    überhaupt mitspielt sind alle dort einstellbar und während einer laufenden
    Partie gesperrt. Online heißt das, der Raum steht wieder in der Lobby und
    ein neues Handy kommt rein. Wer die Karte schon hatte, merkt sich das Spiel
    über die Pause hinweg, damit die Rotation nicht bei null anfängt.

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

## Der Hinweis für den Imposter

Nichts zu wissen ist für den Imposter kein Spiel, sondern Raten. Die Kategorie
allein hilft kaum – die verrät der erste Tipp am Tisch ohnehin. Deshalb sind es
drei Stufen, einstellbar wie alles andere:

| Stufe | Der Imposter sieht |
|---|---|
| Aus | nichts |
| Kategorie | „🦊 Kategorie: Tiere" |
| **Nachbarwort** (Standard) | dazu „🧭 Nah dran: Schmetterling" – das Wort ist *Biene* |

**Die Distanz ist das ganze Design.** Jedes Wort trägt in `src/game/words.ts`
einen Nachbarn, und der liegt bewusst im mittleren Band, das Partyspiele wie
*Undercover* so kalibrieren: Wolf/Fuchs, Bier/Most, Tennis/Badminton. Ein Tipp
über den Nachbarn passt fast immer auch auf das echte Wort, aber der Nachbar ist
nie das Wort, nie ein Teil davon und nie ein Synonym.

Einen Schritt näher (Frosch/Kröte, Espresso/Kaffee) und der Imposter hätte die
Karte auch gleich bekommen können; einen Schritt weiter (Wüste/Strand) und der
Hinweis sagt nichts, was die Kategorie nicht schon sagte.

Zwei Regeln prüft `scripts/rules.mjs` für alle 200 Wörter, weil beide eine Runde
still ruinieren: der Nachbar ist nie das Wort selbst, und er steht nie selbst in
derselben Kategorie – sonst könnte der Imposter ihn streichen und hätte die
Auswahl kleiner gemacht, statt sich eine Richtung zu holen. Online entscheidet
der Server, wer den Nachbarn bekommt; die Zivilisten sehen ihn nie.

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
es gezeichnet ist. Ein roter Schleier über einer Karte, auf der ZIVILIST steht, sagte
Gefahr und meinte nichts – das verwirrt mehr, als es tarnt.

Gemessen gegen den Imposter-Schirm, größter Kanal der Durchschnittsfarbe, im Browser
bei 390×844 – kleiner heißt besser getarnt:

| Zivilisten-Variante | ganzer Schirm | obere Hälfte |
|---|---|---|
| Schleier, Raum schwarz | 22,6 | 31,8 |
| Schleier, Raum rot | 16,0 | 22,3 |
| Bild klar, Raum schwarz | 34,2 | 44,2 |
| **Bild klar, Raum rot** (so läuft es) | **34,5** | **44,5** |

Der rote Raum ist also *nicht* der Verräter: bei klarem Bild bewegt er nichts (34,2 vs
34,5), und mit dem alten Schleier hat er die Tarnung sogar verbessert – die
Imposter-Karte ist eine Wand aus Feuer, und der rote Raum zieht den Zivilisten-Schirm
da hin. Was die Tarnung kostet, ist das klare Bild selbst (16,0 → 34,5), und der
Abstand liegt überwiegend in Grün und Blau, nicht in Rot: die Zivilisten-Szene ist
schlicht heller und bunter als das Feuer. Das Feuer weiter herunterzuziehen schließt
die Lücke nicht – `saturate(0.15)` plus Aufhellung kommt auf 27,2 und ruiniert dabei
die Imposter-Karte. Der verbleibende Hebel wäre die Zeichnung, kein Filter.

**Eine Uhr pro Wortrunde, und sie gehört dem Server.** `round.deadlineAt` ist ein
Zeitpunkt, kein Restwert: jedes Handy zählt auf denselben Moment herunter, ein Reload
nimmt die Uhr dort auf, wo sie war, und eine zweite Wortrunde frisst dieselben Minuten
weiter. Läuft sie ab, während noch diskutiert wird, beendet der Server die Runde und
schreibt sie den Imposter gut. Läuft sie ab, während schon abgestimmt wird, buchen die
überlebenden Imposter nur ihren Punkt – die Stimmen, die bereits liegen, verfallen
nicht.

**Zwischen zwei Partien macht der Raum auf.** `restart` legt die Punkte auf null
und setzt `room.game` auf `null`, statt sofort die nächste Partie anzulegen –
`settings`, `order`, `kick` und der Beitritt werfen alle `already-started`,
solange ein Spiel läuft, und genau die braucht man zwischen zwei Partien. Was die
Pause überleben muss, ist die Imposter-Rotation: sie wandert vorher nach
`room.imposterHistory`, sonst bekäme dieselbe Person die Karte gleich wieder.
Lokal macht das dieselbe Wendung über die Aufstellung; dort sind die Spieler-Ids
seither die Namen, weil ein Index nach dem Hinzufügen oder Umstellen auf jemand
anderen zeigt und die Rotation damit auf die Falschen gerechnet hätte.

**Der Gastgeber wandert mit.** Verlässt er den Raum, erbt ihn jemand, der gerade am
Handy ist. Ist er einfach weg, ohne sich abzumelden, kann ihn nach rund anderthalb
Minuten jede:r andere übernehmen.

**Wer weggeht, ist weg – der Platz bleibt trotzdem seiner.** Mitten im Spiel stand
der Weggegangene bisher weiter in der Leiste, und das war nicht nur hässlich: die
Runde zählte ihn mit, also wartete die Abstimmung auf eine Stimme, die nie kam, und
die Bereit-Meldung kam nie auf 4/4. Jetzt verschwindet er aus der Leiste und aus
`round.alive`, sobald er geht.

Sein Sitz und sein Punktestand bleiben aber im Raum liegen (`room.away`), denn
derselbe Name führt jederzeit dorthin zurück – von demselben Handy oder einem
anderen, weil der Platz dabei ein neues Token bekommt. Zurück heißt zurück in die
Leiste, nicht in die laufende Runde: die nächste Runde teilt ihm wieder eine Karte
aus. Solange jemand auf dem Platz online ist, bleibt der Name gesperrt, und zurück in
der Lobby werden die liegen gebliebenen Plätze endgültig geräumt.

Ein Weggang ist keine Abstimmung, also verdient niemand daran. Die Runde muss aber
merken, dass der Tisch anders aussieht: geht der einzige Imposter, gewinnen die
Zivilisten – eine Runde ohne Imposter ist nicht spielbar. Sind die Imposter nach dem
Weggang nicht mehr in der Unterzahl, gewinnen sie, dieselbe Regel wie nach einer
Abstimmung. Und rutscht der Tisch unter drei Leute, endet die Partie statt eine
Runde zu beginnen, die keine wäre.

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
