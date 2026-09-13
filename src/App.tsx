import { useEffect, useMemo, useState } from 'react'
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
import { HomeScreen } from './screens/HomeScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { RevealScreen } from './screens/RevealScreen'
import { DiscussScreen } from './screens/DiscussScreen'
import { VoteScreen } from './screens/VoteScreen'
import {
  EjectedScreen,
  GameEndScreen,
  LastChanceScreen,
  RoundEndScreen,
} from './screens/ResultScreens'

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

export default function App() {
  const [lang, setLang] = usePersisted<Lang>('imposter.lang', 'de')
  const [names, setNames] = usePersisted<string[]>('imposter.players', [])
  const [stored, setStored] = usePersisted<Settings>('imposter.settings', defaultSettings(4))
  const [atSettings, setAtSettings] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)

  const t = useMemo(() => translator(lang), [lang])
  const settings = useMemo(
    () => sanitize(stored, Math.max(names.length, 3)),
    [stored, names.length],
  )

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const dispatch = (action: Action) => setGame((g) => (g ? reduce(g, action) : g))

  const start = () => {
    const players = names.map((name, i) => ({ id: `p${i}`, name, score: 0 }))
    setGame(createGame(players, settings))
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

  if (!game) {
    return atSettings ? (
      <SettingsScreen
        t={t}
        lang={lang}
        playerCount={names.length}
        settings={settings}
        onSettings={setStored}
        onBack={() => setAtSettings(false)}
        onStart={start}
      />
    ) : (
      <HomeScreen
        t={t}
        lang={lang}
        onLang={setLang}
        names={names}
        onNames={setNames}
        onNext={() => setAtSettings(true)}
      />
    )
  }

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
            setAtSettings(false)
          }}
        />
      )
  }
}
