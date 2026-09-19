import { useEffect, useState } from 'react'
import type { Translate } from '../game/i18n'
import type { ClientAction, PlayerView, RoomView, RoundView } from '../online/protocol'
import { Crew } from '../components/Characters'
import { RoleCard } from '../components/RoleCard'
import { LeaderboardSheet } from '../components/LeaderboardSheet'
import { PortraitProvider } from '../components/PortraitCard'
import { recordGame } from '../game/leaderboard'
import { MIN_PLAYERS } from '../game/state'
import { Avatar, Sheet, TopBar } from '../components/ui'
import {
  IconCheck,
  IconCrown,
  IconDown,
  IconExit,
  IconGear,
  IconPlay,
  IconRefresh,
  IconShare,
  IconUp,
  IconVote,
} from '../components/icons'
import { roomLink, shareRoom } from '../online/share'
import { buzz, useDeadline } from '../hooks'
import { SettingsScreen } from './SettingsScreen'

type Act = (action: ClientAction) => void

type Props = {
  t: Translate
  view: RoomView
  live: boolean
  error: string | null
  act: Act
  refresh: () => void
  onLeave: () => void
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const byId = (view: RoomView, id: string | null) =>
  id ? (view.players.find((p) => p.id === id) ?? null) : null

const isHost = (view: RoomView) => view.youId === view.hostId

/** Round 1/3 · Wortrunde 2 — the second line only once there has been one. */
const stepLabel = (t: Translate, round: RoundView) => {
  const round_ = t('round', { n: round.index + 1, total: round.rounds })
  return round.pass > 1 ? `${round_} · ${t('wordRoundCount', { n: round.pass })}` : round_
}

/** Room code, connection health, exit — and the offer to take over a room
 *  whose host has walked off with the pacing buttons. */
function RoomBar({
  t,
  view,
  live,
  act,
  refresh,
  onLeave,
  step,
}: Omit<Props, 'error'> & { step?: string }) {
  const host = byId(view, view.hostId)
  const hostAway = Boolean(host && !host.online)
  const youAreHost = isHost(view)

  return (
    <>
      <TopBar
        title={view.code}
        step={step}
        right={
          <button className="icon-btn" onClick={onLeave} aria-label={t('leaveRoom')}>
            <IconExit />
          </button>
        }
      />
      {!live && (
        // Polling has already taken over by the time this shows; the button is
        // for the impatient, and it is a far better answer than "reload the page".
        <div className="notice">
          <span>{t('offlineHint')}</span>
          <button className="btn btn-ghost" onClick={refresh}>
            <IconRefresh />
            {t('refreshNow')}
          </button>
        </div>
      )}
      {hostAway && !youAreHost && (
        <div className="notice">
          <span>{t('hostAway', { name: host?.name ?? '' })}</span>
          <button className="btn btn-ghost" onClick={() => act({ type: 'claimHost' })}>
            {t('takeOverHost')}
          </button>
        </div>
      )}
    </>
  )
}

function PlayerRow({
  t,
  player,
  view,
  act,
  showReady,
  showVoted,
  move,
}: {
  t: Translate
  player: PlayerView
  view: RoomView
  act: Act
  showReady?: boolean
  showVoted?: boolean
  move?: (by: -1 | 1) => void
}) {
  const host = player.id === view.hostId
  const youAreHost = isHost(view)
  const done = (showReady && player.ready) || (showVoted && player.voted)

  return (
    <li className="player-chip">
      <Avatar name={player.name} points={view.stage === 'game' ? player.score : null} />
      <span className="name">
        {player.name}
        {player.id === view.youId && ' ·'}
      </span>
      {host && (
        <span className="badge host" aria-label={t('youAreHost')}>
          <IconCrown />
        </span>
      )}
      {!player.online && <span className="tag-faint">{t('offlineTag')}</span>}
      {done && <span className="tick">✓</span>}
      {move && (
        <span className="order-grip">
          <button
            className="icon-btn"
            aria-label={t('moveUp', { name: player.name })}
            onClick={() => move(-1)}
          >
            <IconUp />
          </button>
          <button
            className="icon-btn"
            aria-label={t('moveDown', { name: player.name })}
            onClick={() => move(1)}
          >
            <IconDown />
          </button>
        </span>
      )}
      {youAreHost && view.stage === 'lobby' && !host && (
        <button
          className="remove"
          aria-label={t('kickPlayer')}
          onClick={() => act({ type: 'kick', playerId: player.id })}
        >
          ×
        </button>
      )}
    </li>
  )
}

/** The round's one clock, the same for every phone in the room. */
function Clock({
  t,
  view,
  round,
  act,
  onExpired,
}: {
  t: Translate
  view: RoomView
  round: RoundView
  act: Act
  onExpired: () => void
}) {
  const remaining = useDeadline(round.deadlineAt, round.pausedAt, onExpired)
  if (remaining === null) return null

  const total = Math.max(view.settings.timerSeconds, 1)
  const over = round.clockExpired || remaining === 0
  const paused = round.pausedAt !== null

  return (
    <div className="card">
      <div className="timer">
        <span className={remaining <= 10 && !over ? 'clock low' : 'clock'}>
          {over ? t('timeUp') : mmss(remaining)}
        </span>
        <div className="bar">
          <span style={{ width: `${Math.min(100, (remaining / total) * 100)}%` }} />
        </div>
      </div>
      {isHost(view) && !over && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: 12 }}
          onClick={() => {
            buzz()
            act({ type: paused ? 'resumeClock' : 'pauseClock' })
          }}
        >
          {paused ? t('resume') : t('pause')}
        </button>
      )}
      {paused && !over && <p className="hint">{t('clockPaused')}</p>}
    </div>
  )
}

/** Who is still to speak, in the order the host laid out in the lobby. */
function OrderList({ t, view, round }: { t: Translate; view: RoomView; round: RoundView }) {
  const speakers = round.order.map((id) => byId(view, id)!).filter(Boolean)
  const alive = speakers.filter((p) => round.alive.includes(p.id))

  return (
    <div className="card">
      <div className="card-head">
        <h3>{t('clueOrder')}</h3>
        <span>
          {alive.length}/{view.players.length}
        </span>
      </div>
      <ul className="order-list">
        {speakers.map((p) => {
          const gone = !round.alive.includes(p.id)
          const position = alive.indexOf(p)
          return (
            <li
              key={p.id}
              className={`order-item${gone ? ' gone' : ''}${position === 0 ? ' first' : ''}`}
            >
              <span className="num">{gone ? '×' : position + 1}</span>
              <span className="name">{p.name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// --------------------------------------------------------------- lobby

function Lobby({ t, view, live, error, act, refresh, onLeave }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shared, setShared] = useState<'idle' | 'copied' | 'manual'>('idle')
  const youAreHost = isHost(view)
  const host = byId(view, view.hostId)
  const tooFew = view.players.length < MIN_PLAYERS

  const share = async () => {
    buzz()
    const result = await shareRoom(view.code, t('appName'))
    if (result === 'manual') return setShared('manual')
    setShared('copied')
    window.setTimeout(() => setShared((s) => (s === 'copied' ? 'idle' : s)), 2200)
  }

  /** The roster is the speaking order, so rearranging it here is the whole feature. */
  const move = (index: number, by: -1 | 1) => {
    const target = index + by
    if (target < 0 || target >= view.players.length) return
    const order = view.players.map((p) => p.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    buzz()
    act({ type: 'order', order })
  }

  // Aenderungen greifen sofort, der Knopf schliesst nur wieder.
  if (settingsOpen && youAreHost) {
    return (
      <SettingsScreen
        t={t}
        lang={view.lang}
        playerCount={view.players.length}
        settings={view.settings}
        onSettings={(settings) => act({ type: 'settings', settings })}
        onBack={() => setSettingsOpen(false)}
        onStart={() => setSettingsOpen(false)}
        startLabel={t('done')}
        startIcon="check"
      />
    )
  }

  return (
    <div className="screen">
      <RoomBar t={t} view={view} live={live} act={act} refresh={refresh} onLeave={onLeave} />

      <button className="code-plate" onClick={() => void share()}>
        <small>{t('roomCode')}</small>
        <strong>{view.code}</strong>
        <span className="badge">
          {shared === 'copied' ? (
            <>
              <IconCheck size={15} />
              {t('linkCopied')}
            </>
          ) : (
            <>
              <IconShare size={15} />
              {t('shareRoom')}
            </>
          )}
        </span>
      </button>

      <div className="scroll">
        <div className="card">
          <div className="card-head">
            <h3>{t('players')}</h3>
            <span>{t('inRoom', { n: view.players.length })}</span>
          </div>
          <ul className="player-list">
            {view.players.map((p, i) => (
              <PlayerRow
                key={p.id}
                t={t}
                player={p}
                view={view}
                act={act}
                move={youAreHost ? (by) => move(i, by) : undefined}
              />
            ))}
          </ul>
          {youAreHost && <p className="hint">{t('lobbyOrderHint')}</p>}
        </div>
        {error && <p className="hint warn">{t(error as never)}</p>}
      </div>

      {shared === 'manual' && (
        <Sheet title={t('shareRoom')} onClose={() => setShared('idle')}>
          <p className="hint" style={{ textAlign: 'left', marginBottom: 10 }}>
            {t('copyManual')}
          </p>
          <input
            className="link-field"
            readOnly
            value={roomLink(view.code)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t('shareRoom')}
          />
          <button
            className="btn btn-ghost"
            style={{ marginTop: 14 }}
            onClick={() => setShared('idle')}
          >
            {t('close')}
          </button>
        </Sheet>
      )}

      <div className="actions">
        {youAreHost ? (
          <>
            {tooFew && <p className="hint">{t('needMorePlayers', { n: MIN_PLAYERS })}</p>}
            <button className="btn btn-go" disabled={tooFew} onClick={() => act({ type: 'start' })}>
              <IconPlay />
              {t('startGame')}
            </button>
            <button className="btn btn-quiet" onClick={() => setSettingsOpen(true)}>
              <IconGear size={16} />
              {t('settings')}
            </button>
          </>
        ) : (
          <p className="hint">{t('hostStarts', { name: host?.name ?? '' })}</p>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------------------- in game

function Reveal({ t, view, live, act, refresh, onLeave }: Props) {
  const round = view.round!
  const you = byId(view, view.youId)!
  const [open, setOpen] = useState(false)
  const readyCount = view.players.filter((p) => p.ready).length
  const waiting = view.players.length - readyCount

  if (you.ready) {
    return (
      <div className="screen">
        <RoomBar
          t={t}
          view={view}
          live={live}
          act={act}
          refresh={refresh}
          onLeave={onLeave}
          step={stepLabel(t, round)}
        />
        <div className="verdict">
          <Crew tone="neutral" size={96} />
          <h2>{t('waitingForOthers')}</h2>
          <p className="hint">{t('readyCount', { n: readyCount, total: view.players.length })}</p>
        </div>
        <div className="scroll">
          <ul className="player-list">
            {view.players.map((p) => (
              <PlayerRow key={p.id} t={t} player={p} view={view} act={act} showReady />
            ))}
          </ul>
        </div>
        {isHost(view) && waiting > 0 && (
          <div className="actions">
            <button className="btn btn-quiet" onClick={() => act({ type: 'skipWaiting' })}>
              {t('skipWaiting')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      <RoomBar
        t={t}
        view={view}
        live={live}
        act={act}
        refresh={refresh}
        onLeave={onLeave}
        step={stepLabel(t, round)}
      />

      <RoleCard
        t={t}
        name={you.name}
        open={open}
        onOpen={() => {
          buzz()
          setOpen(true)
        }}
        imposter={round.imposter}
        word={round.word}
        category={round.category}
        noHint={round.imposter && !round.category}
      />

      <div className="actions">
        {open ? (
          <button className="btn btn-primary" onClick={() => act({ type: 'ready' })}>
            {t('imReady')}
          </button>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={() => {
                buzz()
                setOpen(true)
              }}
            >
              {t('revealButton')}
            </button>
            <p className="hint">{t('readyCount', { n: readyCount, total: view.players.length })}</p>
          </>
        )}
      </div>
    </div>
  )
}

function Discuss({ t, view, live, act, refresh, onLeave }: Props) {
  const round = view.round!
  const youAreHost = isHost(view)
  const host = byId(view, view.hostId)
  const alive = round.order.filter((id) => round.alive.includes(id))
  const starter = byId(view, alive[0] ?? null)

  return (
    <div className="screen">
      <RoomBar
        t={t}
        view={view}
        live={live}
        act={act}
        refresh={refresh}
        onLeave={onLeave}
        step={stepLabel(t, round)}
      />

      <div className="hero" style={{ gap: 4, paddingBlock: 2 }}>
        <h2 style={{ fontSize: 'clamp(22px, 6.5vw, 30px)' }}>
          {starter ? t('startsWith', { name: starter.name }) : t('discussion')}
        </h2>
        <p>{t('discussHint')}</p>
      </div>

      {/* The clock runs on the server; expiring only means asking it what changed. */}
      <Clock t={t} view={view} round={round} act={act} onExpired={refresh} />

      <div className="scroll">
        <OrderList t={t} view={view} round={round} />
      </div>

      <div className="actions">
        {youAreHost ? (
          <button className="btn btn-primary" onClick={() => act({ type: 'toVote' })}>
            <IconVote />
            {t('toVote')}
          </button>
        ) : (
          <p className="hint">{t('waitingForHost', { name: host?.name ?? '' })}</p>
        )}
      </div>
    </div>
  )
}

function Vote({ t, view, live, act, refresh, onLeave }: Props) {
  const round = view.round!
  const alive = round.alive.map((id) => byId(view, id)!).filter(Boolean)
  const youAlive = round.alive.includes(view.youId)
  const votedCount = alive.filter((p) => p.voted).length
  const outstanding = alive.length - votedCount

  return (
    <div className="screen">
      <RoomBar
        t={t}
        view={view}
        live={live}
        act={act}
        refresh={refresh}
        onLeave={onLeave}
        step={stepLabel(t, round)}
      />
      <h2 style={{ fontSize: 20, fontWeight: 750 }}>{t('voteTitle')}</h2>
      <p className="hint">
        {youAlive ? t('votedCount', { n: votedCount, total: alive.length }) : t('spectating')}
      </p>
      {round.clockExpired && <p className="hint">{t('clockForced')}</p>}

      <div className="scroll">
        <ul className="vote-list">
          {alive.map((p) => (
            <li key={p.id}>
              <button
                className="vote-btn"
                aria-pressed={round.myVote === p.id}
                disabled={!youAlive}
                onClick={() => {
                  buzz()
                  act({ type: 'vote', targetId: round.myVote === p.id ? null : p.id })
                }}
              >
                <Avatar name={p.name} size={34} plain />
                <span className="name">{p.name}</span>
                {p.voted && <span className="tick">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="actions">
        {youAlive && round.myVote !== null && <p className="hint">{t('waitingForOthers')}</p>}
        {isHost(view) && outstanding > 0 && votedCount > 0 && (
          <button className="btn btn-quiet" onClick={() => act({ type: 'skipWaiting' })}>
            {t('skipWaiting')}
          </button>
        )}
      </div>
    </div>
  )
}

function Ejected({ t, view, live, act, refresh, onLeave }: Props) {
  const round = view.round!
  const ejected = byId(view, round.ejectedId)
  const caught = round.ejectedWasImposter
  const youAreHost = isHost(view)
  const host = byId(view, view.hostId)

  return (
    <div className="screen">
      <RoomBar
        t={t}
        view={view}
        live={live}
        act={act}
        refresh={refresh}
        onLeave={onLeave}
        step={stepLabel(t, round)}
      />
      <div className="verdict">
        <Crew tone={!ejected ? 'neutral' : caught ? 'imposter' : 'civilian'} size={110} />
        {ejected ? (
          <>
            <h2>{ejected.name}</h2>
            <span className={caught ? 'tag good' : 'tag bad'}>
              {caught ? t('wasImposter') : t('wasCivilian')}
            </span>
          </>
        ) : (
          <h2>{t('nobodyEjected')}</h2>
        )}
      </div>
      <div className="actions">
        {youAreHost ? (
          <button className="btn btn-primary" onClick={() => act({ type: 'resolve' })}>
            {t('next')}
          </button>
        ) : (
          <p className="hint">{t('waitingForHost', { name: host?.name ?? '' })}</p>
        )}
      </div>
    </div>
  )
}

/**
 * The vote settled nothing. Rather than dropping the table straight back into
 * a discussion, the host picks: another lap of clues, or go round again on the
 * same ones. Either way the clock keeps running where it left off.
 */
function Standoff({ t, view, live, act, refresh, onLeave }: Props) {
  const round = view.round!
  const youAreHost = isHost(view)
  const host = byId(view, view.hostId)

  return (
    <div className="screen">
      <RoomBar
        t={t}
        view={view}
        live={live}
        act={act}
        refresh={refresh}
        onLeave={onLeave}
        step={stepLabel(t, round)}
      />
      <div className="verdict" style={{ flex: 'none', paddingBlock: 4 }}>
        <Crew tone="neutral" size={92} />
        <h2>{t('standoffTitle')}</h2>
        <p className="hint">{t('standoffBody')}</p>
      </div>

      <Clock t={t} view={view} round={round} act={act} onExpired={refresh} />

      <div className="scroll">
        <OrderList t={t} view={view} round={round} />
      </div>

      <div className="actions">
        {youAreHost ? (
          <>
            <button
              className="btn btn-primary"
              onClick={() => act({ type: 'continue', as: 'discuss' })}
            >
              {t('newWordRound')}
            </button>
            <button className="btn btn-go" onClick={() => act({ type: 'continue', as: 'vote' })}>
              <IconVote />
              {t('voteAgain')}
            </button>
          </>
        ) : (
          <p className="hint">{t('waitingForHost', { name: host?.name ?? '' })}</p>
        )}
      </div>
    </div>
  )
}

function LastChance({ t, view, live, act, refresh, onLeave }: Props) {
  const round = view.round!
  const youAreHost = isHost(view)
  const host = byId(view, view.hostId)
  const names = (round.imposterIds ?? [])
    .map((id) => byId(view, id)?.name)
    .filter(Boolean)
    .join(' & ')

  return (
    <div className="screen">
      <RoomBar
        t={t}
        view={view}
        live={live}
        act={act}
        refresh={refresh}
        onLeave={onLeave}
        step={stepLabel(t, round)}
      />
      <div className="verdict">
        <Crew tone="imposter" size={110} />
        <h2>{t('lastChanceTitle')}</h2>
        <p className="hint" style={{ fontSize: 15 }}>
          {t('lastChanceBody', { names })}
        </p>
      </div>
      <div className="actions">
        {youAreHost ? (
          <>
            <button
              className="btn btn-primary"
              onClick={() => act({ type: 'lastChance', correct: true })}
            >
              {t('guessedRight')}
            </button>
            <button
              className="btn btn-go"
              onClick={() => act({ type: 'lastChance', correct: false })}
            >
              {t('guessedWrong')}
            </button>
          </>
        ) : (
          <p className="hint">{t('waitingForHost', { name: host?.name ?? '' })}</p>
        )}
      </div>
    </div>
  )
}

function Scores({
  t,
  view,
  earned,
}: {
  t: Translate
  view: RoomView
  earned?: Record<string, number> | null
}) {
  const table = [...view.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  const top = table[0]?.score ?? 0
  const soleLeader = top > 0 && table.filter((p) => p.score === top).length === 1
  return (
    <ul className="score-list">
      {table.map((p, i) => (
        <li key={p.id} className={soleLeader && p.score === top ? 'score-row lead' : 'score-row'}>
          <span className="rank">{i + 1}</span>
          <Avatar name={p.name} size={30} points={p.score} />
          <span className="name">{p.name}</span>
          {/* Where the points came from is half the fun of the table. */}
          {earned?.[p.id] ? <span className="gain">+{earned[p.id]}</span> : null}
          <span className="pts">
            {p.score}
            <small>{t('pointsShort')}</small>
          </span>
        </li>
      ))}
    </ul>
  )
}

function RoundEnd({ t, view, live, act, refresh, onLeave }: Props) {
  const round = view.round!
  const last = round.phase === 'gameEnd'
  const [board, setBoard] = useState(false)

  useEffect(() => {
    if (last && view.gameId) recordGame(view.gameId, view.players)
  }, [last, view.gameId, view.players])

  const impostersWon = round.outcome === 'imposters'
  const youAreHost = isHost(view)
  const host = byId(view, view.hostId)
  const imposterNames = (round.imposterIds ?? [])
    .map((id) => byId(view, id)?.name)
    .filter(Boolean)
    .join(', ')

  return (
    <div className="screen">
      <RoomBar
        t={t}
        view={view}
        live={live}
        act={act}
        refresh={refresh}
        onLeave={onLeave}
        step={stepLabel(t, round)}
      />

      <div className="verdict" style={{ flex: 'none', paddingBlock: 6 }}>
        <Crew tone={impostersWon ? 'imposter' : 'civilian'} size={84} />
        <h2>{last ? t('finalTitle') : impostersWon ? t('impostersWin') : t('civiliansWin')}</h2>
        {!last && round.clockDecided && <p className="hint">{t('clockRanOut')}</p>}
      </div>

      <div className="scroll">
        {!last && (
          <div className="reveal-word">
            <small>{t('theWordWas')}</small>
            <strong>{round.word}</strong>
          </div>
        )}
        <div className="card">
          {!last && (
            <div className="card-head">
              <h3>{(round.imposterIds ?? []).length > 1 ? t('impostersWere') : t('imposterWas')}</h3>
              <span>{imposterNames}</span>
            </div>
          )}
          <Scores t={t} view={view} earned={last ? null : round.earned} />
        </div>
      </div>

      <div className="actions">
        {last ? (
          youAreHost ? (
            <button className="btn btn-go" onClick={() => act({ type: 'restart' })}>
              {t('playAgain')}
            </button>
          ) : (
            <p className="hint">{t('waitingForHost', { name: host?.name ?? '' })}</p>
          )
        ) : youAreHost ? (
          <button className="btn btn-primary" onClick={() => act({ type: 'nextRound' })}>
            {t('nextRound')}
          </button>
        ) : (
          <p className="hint">{t('waitingForHost', { name: host?.name ?? '' })}</p>
        )}
        {last && (
          <button className="btn btn-quiet" onClick={() => setBoard(true)}>
            {t('leaderboard')}
          </button>
        )}
      </div>

      {board && <LeaderboardSheet t={t} onClose={() => setBoard(false)} />}
    </div>
  )
}

// --------------------------------------------------------------- router

export function RoomScreen(props: Props) {
  const { view } = props

  // A short buzz whenever the table moves on, so a pocketed phone is noticed.
  useEffect(() => {
    if (view.round) buzz()
  }, [view.round?.phase, view.round?.index, view.round?.pass])

  return (
    <PortraitProvider t={props.t}>
      <Stage {...props} />
    </PortraitProvider>
  )
}

function Stage(props: Props) {
  const { view } = props
  if (view.stage === 'lobby' || !view.round) return <Lobby {...props} />

  switch (view.round.phase) {
    case 'reveal':
      return <Reveal {...props} />
    case 'discuss':
      return <Discuss {...props} />
    case 'vote':
      return <Vote {...props} />
    case 'ejected':
      return <Ejected {...props} />
    case 'standoff':
      return <Standoff {...props} />
    case 'lastChance':
      return <LastChance {...props} />
    case 'roundEnd':
    case 'gameEnd':
      return <RoundEnd {...props} />
    default:
      return <Lobby {...props} />
  }
}
