/**
 * Abnahmelauf gegen eine laufende Instanz: spielt eine komplette Online-Partie
 * durch und prüft dabei die Dinge, die man beim Klicken nicht sieht — dass der
 * Imposter das Wort nie geschickt bekommt, dass eine Stimme niemanden verrät,
 * dass nur der Gastgeber die Runde taktet und dass der Stream wirklich pusht.
 *
 *   npm run test:live                     # gegen die Produktion
 *   npm run test:live -- http://localhost:5173
 */

const BASE = (process.argv[2] ?? 'https://imposter-puce.vercel.app').replace(/\/$/, '')

let passed = 0
let failed = 0

const check = (label, condition, detail = '') => {
  if (condition) {
    passed++
    console.log(`  ok   ${label}`)
  } else {
    failed++
    console.log(`  FAIL ${label} ${detail}`)
  }
}

const section = (title) => console.log(`\n${title}`)

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

const act = (creds, action) => post('/api/action', { ...creds, action })
const snapshot = (creds) => post('/api/room', { op: 'snapshot', ...creds })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --------------------------------------------------------------- room, joining

section('Raum und Beitritt')
const host = await post('/api/room', { op: 'create', name: 'Jan', lang: 'de' })
const code = host.code
check('Raum angelegt', code?.length === 4 && Boolean(host.token), JSON.stringify(host))

const players = [host]
for (const name of ['Eddy', 'Matze', 'Lara', 'Marco']) {
  players.push(await post('/api/room', { op: 'join', code, name }))
}
check('vier beigetreten', players.slice(1).every((p) => p.token))
check(
  'Name doppelt abgelehnt',
  (await post('/api/room', { op: 'join', code, name: 'jan' })).error === 'name-taken',
)
check(
  'unbekannter Code abgelehnt',
  (await post('/api/room', { op: 'join', code: 'ZZZZ', name: 'X' })).error === 'no-such-room',
)
check(
  'fremdes Token abgelehnt',
  (await act({ ...players[1], token: 'falsch' }, { type: 'ready' })).error === 'not-a-member',
)

// --------------------------------------------------------------- permissions

section('Rechte')
check('Nicht-Host startet nicht', (await act(players[1], { type: 'start' })).error === 'host-only')
check(
  'Uebernahme bei anwesendem Host abgelehnt',
  (await act(players[1], { type: 'claimHost' })).error === 'host-present',
)

// --------------------------------------------------------------- start

section('Einstellungen und Start')
await act(host, {
  type: 'settings',
  settings: {
    imposters: 1,
    imposterHint: 'near',
    rounds: 2,
    timerSeconds: 0,
    lastChance: true,
    categoryIds: ['animals', 'food', 'austria'],
    orderMode: 'rotate',
    imposterFairness: 1,
    edgeAvoidance: 0.8,
    points: {
      voteCorrect: 1,
      imposterSurvive: 1,
      imposterGuess: 1,
      clockSurvived: 1,
      civilianWin: 0,
      imposterWin: 0,
    },
  },
})
let view = await act(host, { type: 'start' })
check('Spiel gestartet', view.round?.phase === 'reveal', JSON.stringify(view).slice(0, 120))
check('gameId vergeben', Boolean(view.gameId))
check(
  'Beitritt nach Start gesperrt',
  (await post('/api/room', { op: 'join', code, name: 'Spaet' })).error === 'already-started',
)

// --------------------------------------------------------------- secrecy

section('Geheimhaltung')
const cards = []
for (const p of players) cards.push(await snapshot(p))
const imposters = cards.filter((v) => v.round.imposter)
check('genau ein Imposter', imposters.length === 1)
check('Imposter bekommt kein Wort', imposters.every((v) => v.round.word === null))
check('Imposter sieht die Kategorie', imposters.every((v) => v.round.category))
const words = new Set(cards.filter((v) => !v.round.imposter).map((v) => v.round.word))
check('Zivilisten teilen ein Wort', words.size === 1, [...words].join('/'))
check('Imposter-Liste verborgen', cards.every((v) => v.round.imposterIds === null))

// Der Hinweis ist ein Nachbarwort, kein Leck: er geht nur an den Imposter und
// ist nie das Wort, das die Zivilisten auf der Karte haben.
const civilians = cards.filter((v) => !v.round.imposter)
check(
  'Imposter bekommt sein Nachbarwort',
  imposters.every((v) => typeof v.round.near === 'string' && v.round.near.length > 0),
  JSON.stringify(imposters.map((v) => v.round.near)),
)
check('Zivilisten bekommen keinen Hinweis', civilians.every((v) => v.round.near === null))
check(
  'der Nachbar ist nie das Wort',
  imposters.every((v) => ![...words].some((w) => w.toLowerCase() === v.round.near.toLowerCase())),
)

// --------------------------------------------------------------- play

section('Partie')
for (const p of players) view = await act(p, { type: 'ready' })
check('alle bereit -> Diskussion', view.round.phase === 'discuss')
check(
  'Nicht-Host schaltet nicht weiter',
  (await act(players[1], { type: 'toVote' })).error === 'host-only',
)

let roundsPlayed = 0
let secrecyChecked = false
let scoreSecrecyChecked = false

for (let game = 0; game < 2; game++) {
  for (;;) {
    view = await act(host, { type: 'toVote' })
    const alive = view.round.alive
    const target = alive[0]
    const voters = players.filter((p) => alive.includes(p.playerId))

    await act(voters[0], { type: 'vote', targetId: target })
    if (!secrecyChecked && voters.length > 1) {
      const other = await snapshot(voters[1])
      const firstVoter = other.players.find((p) => p.id === voters[0].playerId)
      check('Stimme sichtbar, Ziel nicht', firstVoter.voted === true && other.round.myVote === null)
      secrecyChecked = true
    }
    for (const p of voters.slice(1)) view = await act(p, { type: 'vote', targetId: target })

    check('Abstimmung aufgeloest', view.round.phase === 'ejected')
    check(
      'nur die eine Rolle aufgedeckt',
      view.round.ejectedWasImposter !== null && view.round.imposterIds === null,
    )

    view = await act(host, { type: 'resolve' })

    if (!scoreSecrecyChecked) {
      // Ein Punktestand, der mitten in der Runde steigt, verraet, wer richtig
      // getippt hat. Gebucht wird waehrend der Runde, ausgezahlt erst danach.
      check(
        'Punkte bleiben bis zum Rundenende verborgen',
        view.players.every((p) => p.score === 0),
        JSON.stringify(view.players.map((p) => p.score)),
      )
      scoreSecrecyChecked = true
    }

    if (view.round.phase === 'standoff') {
      check('Patt fragt den Gastgeber', view.round.outcome === null)
      check(
        'nur der Gastgeber entscheidet das Patt',
        (await act(players[1], { type: 'continue', as: 'vote' })).error === 'host-only',
      )
      view = await act(host, { type: 'continue', as: 'vote' })
      check('direkt abstimmen springt in die Abstimmung', view.round.phase === 'vote')
    }
    if (view.round.phase === 'lastChance') {
      view = await act(host, { type: 'lastChance', correct: false })
    }
    if (view.round.phase === 'roundEnd') break
  }

  roundsPlayed++
  check(
    `Runde ${roundsPlayed} gewertet`,
    ['civilians', 'imposters'].includes(view.round.outcome) &&
      view.round.imposterIds !== null &&
      view.round.word !== null,
  )

  view = await act(host, { type: 'nextRound' })
  if (view.round.phase === 'gameEnd') break
  for (const p of players) await act(p, { type: 'ready' })
}

check('zwei Runden gespielt', roundsPlayed === 2)
check('Spielende erreicht', view.round.phase === 'gameEnd')
check(
  'Punkte vergeben',
  view.players.reduce((sum, p) => sum + p.score, 0) > 0,
)
// --------------------------------------------------------------- rematch

section('Neue Partie')
const rematch = await act(host, { type: 'restart' })
check('Neustart landet in der Lobby', rematch.stage === 'lobby' && rematch.round === null)
check('Punkte zurueck auf null', rematch.players.every((p) => p.score === 0))

// Genau das war vorher gesperrt: der Neustart sprang direkt in die naechste
// Partie, und Uhr, Rundenzahl, Aufstellung und Beitritt blieben zu.
const seating = rematch.players.map((p) => p.id)
const retimed = await act(host, {
  type: 'settings',
  settings: { ...rematch.settings, rounds: 4, timerSeconds: 180 },
})
check(
  'Uhr und Rundenzahl sind wieder einstellbar',
  retimed.settings.rounds === 4 && retimed.settings.timerSeconds === 180,
)
const latecomer = await post('/api/room', { op: 'join', code, name: 'Nachzuegler' })
check('ein neues Handy kommt rein', Boolean(latecomer.playerId), JSON.stringify(latecomer))
check('und bekommt einen Platz', (await snapshot(host)).players.length === 6)
await act(host, { type: 'kick', playerId: latecomer.playerId })

const reversed = [...seating].reverse()
const restacked = await act(host, { type: 'order', order: reversed })
check(
  'die Aufstellung laesst sich umstellen',
  restacked.players.map((p) => p.id).join() === reversed.join(),
)

// Zurueck auf die Ausgangslage, damit die folgenden Abschnitte dieselbe Runde
// pruefen wie bisher.
await act(host, { type: 'order', order: seating })
await act(host, { type: 'settings', settings: { ...retimed.settings, rounds: 2, timerSeconds: 0 } })
const restarted = await act(host, { type: 'start' })
check('und dann startet die neue Partie', restarted.round.phase === 'reveal')
// Der Fehler aus dem Livetest: die neue Partie erbte die Bereitmeldungen der
// alten, stand sofort auf 5/5 und kam trotzdem nie aus dem Warten heraus.
check('niemand ist vorab bereit', restarted.players.every((p) => !p.ready))
const oneReady = await act(players[1], { type: 'ready' })
check('eine Bereitmeldung startet noch nichts', oneReady.round.phase === 'reveal')
check('sie wird aber gezaehlt', oneReady.players.filter((p) => p.ready).length === 1)

// --------------------------------------------------------------- rejoining

section('Wieder einsteigen')
const dropout = players[2]
await act(dropout, { type: 'leave' })
const back = await post('/api/room', { op: 'join', code, name: 'Matze' })
check('gleicher Platz zurueck', back.playerId === dropout.playerId, JSON.stringify(back))
check('als Rueckkehr gekennzeichnet', back.rejoined === true)
check('mit neuem Token', back.token !== dropout.token)
const seats = await snapshot(back)
check('kein zusaetzlicher Platz', seats.players.length === 5)
check(
  'das alte Token gilt nicht mehr',
  (await act(dropout, { type: 'ready' })).error === 'not-a-member',
)
check(
  'ein besetzter Name bleibt gesperrt',
  (await post('/api/room', { op: 'join', code, name: 'Matze' })).error === 'name-taken',
)
players[2] = back

// --------------------------------------------------------------- host handover

section('Gastgeber wandert')
await act(host, { type: 'leave' })
const after = await snapshot(players[1])
const names = Object.fromEntries(after.players.map((p) => [p.id, p.name]))
check('Host vererbt', names[after.hostId] !== 'Jan', names[after.hostId])
check('Platz bleibt im laufenden Spiel', after.players.length === 5)
check('neuer Host schaltet', !(await act(players[1], { type: 'toVote' })).error)

// --------------------------------------------------------------- line-up

section('Reihenfolge')
const lobby = await post('/api/room', { op: 'create', name: 'Ordner', lang: 'de' })
const guests = []
for (const name of ['Anna', 'Bert', 'Cleo']) {
  guests.push(await post('/api/room', { op: 'join', code: lobby.code, name }))
}
let lineup = await snapshot(lobby)
const wanted = lineup.players.map((p) => p.id).reverse()

check(
  'nur der Gastgeber stellt um',
  (await act(guests[0], { type: 'order', order: wanted })).error === 'host-only',
)
check(
  'eine unvollstaendige Aufstellung wird abgelehnt',
  (await act(lobby, { type: 'order', order: wanted.slice(1) })).error === 'bad-order',
)
lineup = await act(lobby, { type: 'order', order: wanted })
check('Aufstellung uebernommen', lineup.players.map((p) => p.id).join() === wanted.join())

await act(lobby, {
  type: 'settings',
  settings: { ...lineup.settings, orderMode: 'lobby', timerSeconds: 0 },
})
lineup = await act(lobby, { type: 'start' })
check('die Aufstellung ist die Reihenfolge', lineup.round.order.join() === wanted.join())

// --------------------------------------------------------------- the clock

section('Rundenuhr')
const timed = await post('/api/room', { op: 'create', name: 'Uhrmacher', lang: 'de' })
const watchers = [timed]
for (const name of ['Zeit', 'Geist']) {
  watchers.push(await post('/api/room', { op: 'join', code: timed.code, name }))
}
let ticking = await snapshot(timed)
await act(timed, {
  type: 'settings',
  settings: { ...ticking.settings, rounds: 1, timerSeconds: 2, lastChance: false },
})
ticking = await act(timed, { type: 'start' })
for (const p of watchers) ticking = await act(p, { type: 'ready' })
check('die Uhr startet mit der Diskussion', typeof ticking.round.deadlineAt === 'number')
check('und laeuft noch', ticking.round.clockExpired === false)

await sleep(2600)
ticking = await snapshot(timed)
check('abgelaufene Uhr entscheidet die Runde', ticking.round.phase === 'roundEnd')
check('und zwar für die Imposter', ticking.round.outcome === 'imposters')
check('und ist als abgelaufen vermerkt', ticking.round.clockExpired === true)
check('der Server sagt auch, dass die Uhr es war', ticking.round.clockDecided === true)

// --------------------------------------------------------------- live stream

section('Live-Stream')
const room2 = await post('/api/room', { op: 'create', name: 'Streamer', lang: 'en' })
const query = new URLSearchParams({
  code: room2.code,
  playerId: room2.playerId,
  token: room2.token,
})
const controller = new AbortController()
const events = []
const started = Date.now()

const stream = fetch(`${BASE}/api/stream?${query}`, { signal: controller.signal }).then(
  async (res) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n')) {
        if (line.startsWith('event:')) events.push([Date.now() - started, line.slice(7).trim()])
      }
    }
  },
)

await sleep(2500)
const joinedAt = Date.now() - started
await post('/api/room', { op: 'join', code: room2.code, name: 'Zuschauer' })
await sleep(2500)
controller.abort()
await stream.catch(() => {})

const states = events.filter(([, e]) => e === 'state').map(([t]) => t)
check('erster Zustand sofort', states.length >= 1 && states[0] < 1500, `${states[0]}ms`)
check('Beitritt wird gepusht', states.length >= 2, JSON.stringify(events))
if (states.length >= 2) {
  const delay = states[1] - joinedAt
  check('Push unter 1,5 s', delay < 1500, `${delay}ms`)
}

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`)
process.exit(failed ? 1 : 0)
