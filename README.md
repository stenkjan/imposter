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
```

Der Dev-Server bindet auf alle Interfaces, also lässt sich `http://<LAN-IP>:5173`
direkt am Handy öffnen. **Der Online-Modus funktioniert lokal ohne jede Cloud:**
ohne Upstash-Credentials fällt `api/_lib/kv.ts` auf einen In-Memory-Store zurück,
und ein Vite-Plugin führt die Dateien in `api/` genauso aus wie Vercel es tut.
Auf Vercel ist dieser Fallback gesperrt – dort sind fehlende Credentials ein Fehler.

## Spielablauf

1. **Startmenü** – Sprache, dann Spielart wählen.
2. **Einstellungen** – Anzahl Imposter, Kategorie-Hinweis für den Imposter, Runden,
   Diskussions-Timer, „Letzte Chance", Wortkategorien. Online stellt das der Gastgeber.
3. **Karten** – jede:r deckt einmal auf.
4. **Diskussion** – Startspieler:in, Reihenfolge, optionaler Timer.
5. **Abstimmung** – eine Person fliegt raus, ihre Rolle wird aufgedeckt. Nur ihre.
6. Zivilisten gewinnen, wenn alle Imposter draußen sind; Imposter gewinnen, sobald sie
   gleich viele sind wie der Rest. Sonst geht die Diskussion mit den Übriggebliebenen weiter.
7. **Punkte** nach jeder Runde, Endstand nach der letzten.

Punkte: Zivilisten +2 pro gewonnener Runde, Imposter +3 fürs Überleben.
Errät ein erwischter Imposter das Wort, bekommt er +2 und die Zivilisten nur +1.

## Architektur

```
src/
  game/state.ts      reine, serialisierbare Spiellogik (Reducer, kein React)
  game/words.ts      Wortbank, jedes Wort als de/en-Paar
  game/i18n.ts       Übersetzungen, typsicher über den deutschen Schlüsselsatz
  online/protocol.ts Wire-Format, von Client und API geteilt
  online/client.ts   fetch-Wrapper und der EventSource-Hook
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

Mobile-First: `100dvh`, `env(safe-area-inset-*)`, Touchziele ≥ 52 px, 16-px-Inputs
(kein iOS-Zoom), `clamp()`-Typografie, PWA-Manifest plus Service Worker.

## Betrieb

Vercel-Projekt `imposter`, Region `fra1`, Upstash Redis `imposter-kv` (Free).
Push auf `master` deployt automatisch.

Zwei bewusste Kompromisse:

- **Der Stream pollt.** Upstash spricht REST, also kein Pub/Sub: `api/stream.ts` liest
  einmal pro Sekunde einen Versionszähler und schickt den Raum nur bei Änderung. Das
  kostet rund ein Redis-Kommando pro Sekunde und Spieler – auf dem Free-Tier (500.000
  Kommandos/Monat) reichen das für etwa 15 Stunden Spiel mit acht Leuten.
- **Das Token steht in der Stream-URL.** `EventSource` kann keine Header setzen. Es ist
  ein Wegwerf-Token für einen Raum, der nach sechs Stunden verfällt; sauberer wäre ein
  HttpOnly-Cookie.

## Offen

- [ ] Eigene Wortlisten
- [ ] Mehrere Hinweisrunden pro Wort konfigurierbar
- [ ] Gastgeber-Rolle weitergeben, wenn der Host das Spiel verlässt
- [ ] QR-Code für den Raum-Beitritt
