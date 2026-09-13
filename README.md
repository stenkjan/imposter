# Imposter

Das Partyspiel für ein Handy: alle bekennen dasselbe geheime Wort – außer dem Imposter.
Reihum nennt jede:r ein einziges Wort, dann wird diskutiert und abgestimmt.

Deutsch ist Standard, Englisch lässt sich im Startmenü umschalten.

## Stand

**Pass-and-Play** (ein Gerät wandert durch die Runde) ist fertig spielbar.
**Online-Modus** (jede:r am eigenen Handy) ist vorbereitet, aber noch nicht gebaut –
siehe [Roadmap](#roadmap).

## Entwickeln

```bash
npm install
npm run dev      # http://localhost:5173 – im Netz erreichbar unter der LAN-IP
npm run build    # Produktionsbundle nach dist/
npm run preview  # dist/ lokal servieren
npm run icons    # PNG-Icons aus scripts/make-icons.mjs neu rendern
```

Der Dev-Server bindet an alle Interfaces (`server.host: true`), also lässt sich
`http://<LAN-IP>:5173` direkt am echten Handy öffnen.

## Spielablauf

1. **Startmenü** – Sprache, Spieler:innen hinzufügen (3–12).
2. **Einstellungen** – Anzahl Imposter, Kategorie-Hinweis für den Imposter,
   Runden, Diskussions-Timer, „Letzte Chance", Wortkategorien.
3. **Karten** – Handy wandert; jede:r deckt einmal auf.
4. **Diskussion** – Startspieler:in, Reihenfolge, optionaler Timer.
5. **Abstimmung** – eine Person fliegt raus, Rolle wird aufgedeckt.
6. Zivilisten gewinnen, wenn alle Imposter draußen sind; Imposter gewinnen,
   sobald sie gleich viele sind wie der Rest. Sonst geht die Diskussion weiter.
7. **Punkte** nach jeder Runde, Endstand nach der letzten.

Punkte: Zivilisten +2 pro gewonnener Runde, Imposter +3 fürs Überleben.
Errät ein erwischter Imposter das Wort, bekommt er +2 und die Zivilisten nur +1.

## Architektur

```
src/
  game/
    state.ts     reine, serialisierbare Spiellogik (Reducer, keine React-Imports)
    words.ts     Wortbank, jedes Wort als de/en-Paar
    i18n.ts      Übersetzungen, typsicher über den deutschen Schlüsselsatz
  screens/       ein Screen pro Spielphase
  components/    SVG-Figuren und geteilte UI-Bausteine
  hooks.ts       localStorage-State, Countdown, Haptik
```

`game/state.ts` kennt weder DOM noch Zufall zur Laufzeit: Runden werden von
`makeRound()` erzeugt und als Action in den Reducer gegeben. Genau das macht den
Online-Modus später einfach – ein Gerät würfelt, alle reduzieren zum selben Zustand.

Mobile-First: `100dvh`, `env(safe-area-inset-*)`, Touchziele ≥ 52 px,
16-px-Inputs (kein iOS-Zoom), `clamp()`-Typografie, PWA-Manifest plus
Service Worker für Offline-Runden.

## Roadmap

- [ ] **Online-Modus**: Raum-Code, jede:r am eigenen Gerät, Live-Sync.
      Braucht einen kleinen Realtime-Backend-Dienst; der Reducer ist dafür fertig.
- [ ] Geheime Einzelabstimmung statt gemeinsamer Tap-Entscheidung
- [ ] Eigene Wortlisten
- [ ] Mehrere Hinweisrunden pro Wort konfigurierbar
