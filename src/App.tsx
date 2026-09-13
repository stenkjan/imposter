import { useCallback, useEffect, useMemo, useState } from 'react'
import { translator, type Lang } from './game/i18n'
import {
  createGame,
  defaultSettings,
  isLastRound,
  makeRound,
  maxImposters,
  reduce,
  type Action,
  type GameState,
  type Settings,
} from './game/state'
import { CATEGORIES } from './game/words'
import { usePersisted } from './hooks'
import { loadCredentials, snapshot, storeCredentials, useRoom } from './online/client'
import { isValidCode, type Credentials } from './online/protocol'
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
} from './screens/ResultScreens'

type Route = 'home' | 'players' | 'settings' | 'online' | 'room'

/** Guards against an older persisted shape after a category or option change. */
function sanitize(settings: Settings, playerCount: number): Settings {
  const known = CATEGORIES.map((c) => c.id)
  const categoryIds = settings.categoryIds?.filter((id) => known.includes(id)) ?? []
  return {
    ...defaultSettings(playerCount),
    ...settings,
    imposters: Math.min(Math.max(1, settings.imposters ?? 1), maxImposters(playerCount)),
    categoryIds: categoryIds.length ? categoryIds : known,
  }
}

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

  const t = useMemo(() => translator(lang), [lang])
  const settings = useMemo(
    () => sanitize(stored, Math.max(names.length, 3)),
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

  const leaveRoom = useCallback(() => {
    storeCredentials(null)
    setCreds(null)
    setRoute('home')
  }, [])

  const room = useRoom(creds, leaveRoom)

  // ------------------------------------------------------------ local game

  const dispatch = (action: Action) => setGame((g) => (g ? reduce(g, action) : g))

  const startLocal = () => {
    setGame(createGame(names.map((name, i) => ({ id: `p${i}`, name, score: 0 })), settings))
  }

  const nextRound = () =>
    setGame((g) => {
      if (!g) return g
      if (isLastRound(g)) return reduce(g, { type: 'endGame' })
      return reduce(g, {
        type: 'startRound',
        round: makeRound(g.round.index + 1, g.players, g.settings, g.usedWords),
      })
    })

  if (game) {
    switch (game.phase) {
      case 'reveal':
        return (
          <RevealScreen
            t={t}
            lang={lang}
            state={game}
            onNext={() => dispatch({ type: 'revealNext' })}
          />
        )
      case 'discuss':
        return (
          <DiscussScreen
            // Remounting per pass gives every discussion a fresh clock.
            key={`${game.round.index}-${game.round.pass}`}
            t={t}
            state={game}
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
            onPlayAgain={() => setGame(createGame(game.players, game.settings))}
            onNewLineup={() => {
              setGame(null)
              setRoute('players')
            }}
          />
        )
    }
  }

  // ------------------------------------------------------------ everything else

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
