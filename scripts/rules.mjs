/**
 * Prüft die Spielregeln selbst — ohne Server, ohne Browser, ohne Glück: der
 * Zufallsgenerator wird geseedet, also ist jeder Lauf derselbe.
 *
 * Geprüft wird das, was man beim Spielen erst nach Stunden merken würde: dass
 * dreimal hintereinander Imposter selten bleibt, dass der Imposter nicht
 * ständig anfangen oder abschließen muss, und dass kein Punkt auf einem Konto
 * landet, bevor die Runde vorbei ist — ein Punktestand, der mitten in der
 * Runde steigt, verrät, wer richtig getippt hat.
 *
 *   npm run test:rules
 */

import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
  // Nur zwei reine Module werden geladen; der Abhängigkeits-Scanner hätte
  // hier nichts zu tun und würde beim Schließen nur Lärm machen.
  optimizeDeps: { noDiscovery: true, include: [] },
})
const { pickImposters, buildOrder } = await server.ssrLoadModule('/src/game/fairness.ts')
const state = await server.ssrLoadModule('/src/game/state.ts')
const { createGame, defaultSettings, makeRound, reduce } = state

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

/** Kleiner, deterministischer Generator, damit ein Lauf reproduzierbar ist. */
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ids = ['a', 'b', 'c', 'd', 'e']
const players = ids.map((id) => ({ id, name: id.toUpperCase(), score: 0 }))
const ROUNDS = 4000

// --------------------------------------------------------------- Rotation

section('Imposter-Rotation')

/** Spielt viele Runden und zählt, wie oft jemand dreimal in Folge dran war. */
function streaks(fairness) {
  const rnd = seeded(20260918)
  const history = []
  let triples = 0
  let repeats = 0
  for (let i = 0; i < ROUNDS; i++) {
    const picked = pickImposters(ids, 1, history, fairness, rnd)
    const [who] = picked
    const last = history[history.length - 1]
    const before = history[history.length - 2]
    if (last?.includes(who)) repeats++
    if (last?.includes(who) && before?.includes(who)) triples++
    history.push(picked)
  }
  return { triples: triples / ROUNDS, repeats: repeats / ROUNDS }
}

const plain = streaks(0)
const fair = streaks(1)

check(
  'ohne Rotation liegt die Wiederholung beim Zufall',
  Math.abs(plain.repeats - 0.2) < 0.03,
  `${(plain.repeats * 100).toFixed(1)} % statt 20 %`,
)
check(
  'mit Rotation wird die Wiederholung seltener',
  fair.repeats < plain.repeats / 2,
  `${(fair.repeats * 100).toFixed(1)} % statt ${(plain.repeats * 100).toFixed(1)} %`,
)
check(
  'dreimal hintereinander wird die Ausnahme',
  fair.triples < plain.triples / 4 && fair.triples < 0.01,
  `${(fair.triples * 100).toFixed(2)} % statt ${(plain.triples * 100).toFixed(2)} %`,
)
check('dreimal bleibt möglich', streaks(0.6).triples > 0, 'nie vorgekommen')

// --------------------------------------------------------------- Reihenfolge

section('Reihenfolge')

const isRotation = (order, base) => {
  const at = base.indexOf(order[0])
  return at >= 0 && order.every((id, i) => id === base[(at + i) % base.length])
}

const rnd = seeded(7)
check(
  'rotierend behält die Aufstellung bei',
  Array.from({ length: 50 }, (_, i) => buildOrder(ids, ['a'], 'rotate', i, 0.8, rnd)).every((o) =>
    isRotation(o, ids),
  ),
)
check(
  'rotierend lässt jeden einmal anfangen',
  new Set(Array.from({ length: 5 }, (_, i) => buildOrder(ids, [], 'rotate', i, 0, rnd)[0])).size === 5,
)
check(
  'fix ist genau die Aufstellung',
  buildOrder(ids, ['a'], 'lobby', 3, 0.8, rnd).join('') === ids.join(''),
)

function edgeShare(mode, avoidance) {
  const dice = seeded(99)
  let edges = 0
  for (let i = 0; i < ROUNDS; i++) {
    const order = buildOrder(ids, ['a'], mode, i, avoidance, dice)
    if (order[0] === 'a' || order[order.length - 1] === 'a') edges++
  }
  return edges / ROUNDS
}

const openEdges = edgeShare('random', 0)
const guardedEdges = edgeShare('random', 0.8)
const rotatingEdges = edgeShare('rotate', 0.8)
check(
  'ohne Schutz sitzt der Imposter so oft am Rand wie jeder',
  Math.abs(openEdges - 0.4) < 0.03,
  `${(openEdges * 100).toFixed(1)} %`,
)
check(
  'mit 80 % Schutz deutlich seltener',
  guardedEdges < 0.12,
  `${(guardedEdges * 100).toFixed(1)} %`,
)
check('der Rand bleibt möglich', guardedEdges > 0, 'nie am Rand')
// Rotierend ist die Voreinstellung, also muss der Schutz auch dort greifen —
// und zwar ohne die Rotation aufzuheben.
check(
  'auch rotierend bleibt der Imposter meist aus dem Rand',
  rotatingEdges < 0.15,
  `${(rotatingEdges * 100).toFixed(1)} %`,
)

// --------------------------------------------------------------- Punkte

section('Punkte')

const settings = { ...defaultSettings(5), rounds: 2, lastChance: true, timerSeconds: 120 }

/** Eine Runde bis zur ersten Abstimmung, mit bekanntem Imposter. */
function opening(overrides = {}) {
  const game = createGame(players, { ...settings, ...overrides })
  const round = { ...game.round, imposterIds: ['a'], order: ids, alive: ids }
  let next = { ...game, round }
  for (let i = 0; i < players.length; i++) {
    next = reduce(next, { type: 'revealNext', deadlineAt: Date.now() + 120_000 })
  }
  return next
}

let game = opening()
check('nach dem letzten Aufdecken beginnt die Diskussion', game.phase === 'discuss')
check('die Uhr läuft ab dann', typeof game.round.deadlineAt === 'number')

// b und c tippen richtig, d und e daneben, a wählt sich selbst nicht
const votes = { b: 'a', c: 'a', d: 'e', e: 'd', a: 'd' }
game = reduce(reduce(game, { type: 'toVote' }), { type: 'eject', playerId: 'a', votes })
check('richtige Stimmen werden gebucht', game.round.earned.b === 1 && game.round.earned.c === 1)
check('falsche Stimmen bringen nichts', !game.round.earned.d && !game.round.earned.e)
check('der Imposter bekommt nichts für seine eigene Stimme', !game.round.earned.a)
check(
  'kein Punkt steht mitten in der Runde am Konto',
  game.players.every((p) => p.score === 0),
)

game = reduce(game, { type: 'resolveEjection' })
check('der letzte Imposter draußen heißt letzte Chance', game.phase === 'lastChance')

const missed = reduce(game, { type: 'lastChance', correct: false })
const byId = (g, id) => g.players.find((p) => p.id === id).score
check('erst zum Rundenende wird ausgezahlt', missed.phase === 'roundEnd' && byId(missed, 'b') === 1)
check('der erwischte Imposter geht leer aus', byId(missed, 'a') === 0)

const guessed = reduce(game, { type: 'lastChance', correct: true })
check('erratenes Wort bringt dem Imposter einen Punkt', byId(guessed, 'a') === 1)
check('die richtigen Tipps bleiben trotzdem stehen', byId(guessed, 'b') === 1)

// --------------------------------------------------------------- Überleben

section('Überleben und Uhr')

game = opening()
game = reduce(reduce(game, { type: 'toVote' }), { type: 'eject', playerId: 'e', votes: { b: 'e' } })
game = reduce(game, { type: 'resolveEjection' })
check('ein überlebter Imposter steht im Patt', game.phase === 'standoff')
check('Überleben wird gebucht', game.round.earned.a === 1)
check('die Ausgeschiedene ist raus', !game.round.alive.includes('e'))

const again = reduce(game, { type: 'continue', as: 'vote' })
check('direkt abstimmen springt in die Abstimmung', again.phase === 'vote' && again.round.pass === 2)
const talking = reduce(game, { type: 'continue', as: 'discuss' })
check('neue Wortrunde geht zurück in die Diskussion', talking.phase === 'discuss')
check(
  'die Uhr läuft weiter statt neu',
  talking.round.deadlineAt === game.round.deadlineAt && talking.round.pass === 2,
)

const expired = reduce(talking, { type: 'expireClock' })
check('abgelaufene Uhr erzwingt die Abstimmung', expired.phase === 'vote')
check('durchgehalten bringt dem Imposter einen Punkt', expired.round.earned.a === 2)
check(
  'die Uhr zahlt nur einmal',
  reduce(expired, { type: 'expireClock' }).round.earned.a === 2,
)

const paused = reduce(talking, { type: 'pauseClock', at: 1_000 })
const resumed = reduce(paused, { type: 'resumeClock', at: 4_000 })
check(
  'pausieren schiebt die Uhr nach hinten',
  resumed.round.deadlineAt === talking.round.deadlineAt + 3_000 && resumed.round.pausedAt === null,
)

// --------------------------------------------------------------- ein Handy

section('Ein Handy')

let solo = opening()
solo = reduce(reduce(solo, { type: 'toVote' }), { type: 'eject', playerId: 'a' })
check(
  'ohne Stimmzettel teilt sich der Tisch den Punkt',
  ['b', 'c', 'd', 'e'].every((id) => solo.round.earned[id] === 1) && !solo.round.earned.a,
)

// --------------------------------------------------------------- Wörter

section('Wörter und Runden')

const first = createGame(players, settings)
const second = reduce(first, {
  type: 'startRound',
  round: makeRound(1, players, settings, first.usedWords, first.imposterHistory),
})
check('kein Wort zweimal', second.usedWords.length === 2 && second.usedWords[0] !== second.usedWords[1])
check('die Rotation merkt sich die Runde', second.imposterHistory.length === 2)

await server.close()
console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`)
process.exit(failed ? 1 : 0)
