import { useCallback, useEffect, useMemo, useState } from 'react'
import { translator, type Lang } from './game/i18n'
import {
  createGame,
  defaultSettings,
  isLastRound,
  makeRound,
  normaliseSettings,
  reduce,
  type Action,
  type GameState,
  type Settings,
} from './game/state'
import { usePersisted } from './hooks'
import { loadCredentials, sendAction, snapshot, storeCredentials, useRoom } from './online/client'
import { recordGame } from './game/leaderboard'
import { isValidCode, type Credentials } from './online/protocol'
import { PortraitProvider } from './components/PortraitCard'
import { HomeScreen } from './screens/HomeScreen'
import { PlayersScreen } from './screens/PlayersScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { RevealScreen } from './screens/RevealScreen'
import { DiscussScreen } from './screens/DiscussScreen'
import { VoteScreen } from './screens/VoteScreen'
import { OnlineEntryScreen } from './screens/OnlineEntryScreen'
import { RoomScreen } from './screens/RoomScreen'
import {
  EjectedScreen,
  GameEndScreen,
  LastChanceScreen,
  RoundEndScreen,
  StandoffScreen,
} from './screens/ResultScreens'

type Route = 'home' | 'players' | 'settings' | 'online' | 'room'

/** A shared link lands as /?room=ABCD; consume it so a reload stays clean. */
function takeRoomFromUrl(): string {
  const code = (new URLSearchParams(location.search).get('room') ?? '').toUpperCase()
  if (!code) return ''
  history.replaceState(null, '', location.pathname)
  return isValidCode(code) ? code : ''
}

export default function App() {
  const [lang, setLang] = usePersisted<Lang>('imposter.lang', 'de')
  const [names, setNames] = usePersisted<string[]>('imposter.players', [])
  const [stored, setStored] = usePersisted<Settings>('imposter.settings', defaultSettings(4))
  const [lastName, setLastName] = usePersisted<string>('imposter.name', '')

  const [invite] = useState(takeRoomFromUrl)
  const [route, setRoute] = useState<Route>(invite ? 'online' : 'home')
  const [game, setGame] = useState<GameState | null>(null)
  const [creds, setCreds] = useState<Credentials | null>(null)
  /**
   * Who has had the card, kept outside the game so it survives the trip back
   * through the line-up between two parties. Names are the ids here, so it
   * still lines up after somebody is added, dropped or moved.
   */
  const [rotation, setRotation] = useState<string[][]>([])

  const t = useMemo(() => translator(lang), [lang])
  // Guards against an older persisted shape after a category or option change.
  const settings = useMemo(
    () => normaliseSettings(stored, Math.max(names.length, 3)),
    [stored, names.length],
  )

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Reopen the room this phone was in, unless it has since expired.
  useEffect(() => {
    if (invite) return
    const saved = loadCredentials()
    if (!saved) return
    let cancelled = false
    snapshot(saved)
      .then(() => {
        if (cancelled) return
        setCreds(saved)
        setRoute('room')
      })
      .catch(() => storeCredentials(null))
    return () => {
      cancelled = true
    }
  }, [invite])

  /** The room is gone or we were thrown out: just forget it. */
  const dropRoom = useCallback(() => {
    storeCredentials(null)
    setCreds(null)
    setRoute('home')
  }, [])

  /** Deliberate exit: tell the room first, so the host role can move on. */
  const leaveRoom = useCallback(() => {
    const saved = loadCredentials()
    if (saved) void sendAction(saved, { type: 'leave' }).catch(() => {})
    dropRoom()
  }, [dropRoom])

  const room = useRoom(creds, dropRoom)

  // A finished game counts once towards the leaderboard.
  useEffect(() => {
    if (game?.phase === 'gameEnd') recordGame(game.id, game.players)
  }, [game?.phase, game?.id, game?.players])

  // ------------------------------------------------------------ local game

  const dispatch = (action: Action) => setGame((g) => (g ? reduce(g, action) : g))

  /** When the last card is turned, the round's clock starts. */
  const deadline = () =>
    settings.timerSeconds > 0 ? Date.now() + settings.timerSeconds * 1000 : null

  const startLocal = () => {
    setGame(
      createGame(
        // The name is the id: unique by the line-up's own rule, and stable
        // across a change of line-up, which index-based ids were not.
        names.map((name) => ({ id: name, name, score: 0 })),
        settings,
        rotation,
      ),
    )
  }

  const nextRound = () =>
    setGame((g) => {
      if (!g) return g
      if (isLastRound(g)) return reduce(g, { type: 'endGame' })
      return reduce(g, {
        type: 'startRound',
        round: makeRound(
          g.round.index + 1,
          g.players,
          g.settings,
          g.usedWords,
          g.imposterHistory,
        ),
      })
    })

  const screen = () => {
    if (game) {
      switch (game.phase) {
        case 'reveal':
          return (
            <RevealScreen
              t={t}
              lang={lang}
              state={game}
              onNext={() => dispatch({ type: 'revealNext', deadlineAt: deadline() })}
            />
          )
        case 'discuss':
          return (
            <DiscussScreen
              t={t}
              state={game}
              dispatch={dispatch}
              onVote={() => dispatch({ type: 'toVote' })}
            />
          )
        case 'vote':
          return (
            <VoteScreen
              t={t}
              state={game}
              onEject={(playerId) => dispatch({ type: 'eject', playerId })}
              onBack={() => setGame({ ...game, phase: 'discuss' })}
            />
          )
        case 'ejected':
          return (
            <EjectedScreen t={t} state={game} onNext={() => dispatch({ type: 'resolveEjection' })} />
          )
        case 'standoff':
          return (
            <StandoffScreen
              t={t}
              state={game}
              onContinue={(as) => dispatch({ type: 'continue', as })}
            />
          )
        case 'lastChance':
          return (
            <LastChanceScreen
              t={t}
              state={game}
              onResult={(correct) => dispatch({ type: 'lastChance', correct })}
            />
          )
        case 'roundEnd':
          return (
            <RoundEndScreen
              t={t}
              lang={lang}
              state={game}
              isLast={isLastRound(game)}
              onNext={nextRound}
            />
          )
        case 'gameEnd':
          return (
            <GameEndScreen
              t={t}
              state={game}
              // Back through the line-up rather than straight into the next
              // party: between two games the table usually wants the clock,
              // the round count or who is playing changed.
              onPlayAgain={() => {
                setRotation(game.imposterHistory)
                setGame(null)
                setRoute('players')
              }}
            />
          )
      }
    }

    // ---------------------------------------------------------- everything else

    switch (route) {
      case 'players':
        return (
          <PlayersScreen
            t={t}
            names={names}
            onNames={setNames}
            onBack={() => setRoute('home')}
            onNext={() => setRoute('settings')}
          />
        )

      case 'settings':
        return (
          <SettingsScreen
            t={t}
            lang={lang}
            playerCount={names.length}
            settings={settings}
            onSettings={setStored}
            onBack={() => setRoute('players')}
            onStart={startLocal}
          />
        )

      case 'online':
        return (
          <OnlineEntryScreen
            t={t}
            lang={lang}
            presetCode={invite}
            lastName={lastName}
            onBack={() => setRoute('home')}
            onEntered={(next, name) => {
              storeCredentials(next)
              setLastName(name)
              setCreds(next)
              setRoute('room')
            }}
          />
        )

      case 'room':
        return room.view ? (
          <RoomScreen
            t={translator(room.view.lang)}
            view={room.view}
            live={room.live}
            error={room.error}
            act={(action) => void room.act(action)}
            refresh={() => void room.refresh()}
            onLeave={leaveRoom}
          />
        ) : (
          <div className="screen">
            <div className="verdict">
              <p className="hint">{room.error ? t(room.error as never) : `${t('connecting')}…`}</p>
              {room.error && (
                <button className="btn btn-ghost" onClick={leaveRoom}>
                  {t('back')}
                </button>
              )}
            </div>
          </div>
        )

      default:
        return (
          <HomeScreen
            t={t}
            lang={lang}
            onLang={setLang}
            onLocal={() => setRoute('players')}
            onOnline={() => setRoute('online')}
          />
        )
    }
  }

  // Every face in the app opens as a full card; the room brings its own provider.
  return <PortraitProvider t={t}>{screen()}</PortraitProvider>
}
