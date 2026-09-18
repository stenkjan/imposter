import { useState } from 'react'
import type { Translate } from '../game/i18n'
import { readLeaderboard, resetLeaderboard } from '../game/leaderboard'
import { Avatar, Sheet } from './ui'

/** The table across evenings, kept on this device and shared by both modes. */
export function LeaderboardSheet({ t, onClose }: { t: Translate; onClose: () => void }) {
  const [rows, setRows] = useState(readLeaderboard)
  const [confirming, setConfirming] = useState(false)
  const leader = rows[0]?.points ?? 0
  const plural = (
    n: number,
    one: 'leaderboardGame' | 'leaderboardWin',
    many: 'leaderboardGames' | 'leaderboardWins',
  ) => `${n} ${t(n === 1 ? one : many)}`

  return (
    <Sheet title={t('leaderboard')} onClose={onClose}>
      {rows.length === 0 ? (
        <p className="empty">{t('leaderboardEmpty')}</p>
      ) : (
        <ul className="score-list">
          {rows.map((row, i) => (
            <li key={row.name} className={i === 0 && leader > 0 ? 'score-row lead' : 'score-row'}>
              <span className="rank">{i + 1}</span>
              <Avatar name={row.name} size={34} points={row.points} />
              <span className="name">
                {row.name}
                <small className="sub">
                  {plural(row.games, 'leaderboardGame', 'leaderboardGames')} ·{' '}
                  {plural(row.wins, 'leaderboardWin', 'leaderboardWins')}
                </small>
              </span>
              <span className="pts">
                {row.points}
                <small>{t('pointsShort')}</small>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>
          {t('close')}
        </button>
        {rows.length > 0 && (
          <button
            className="btn btn-quiet"
            onClick={() => {
              if (!confirming) return setConfirming(true)
              resetLeaderboard()
              setRows([])
              setConfirming(false)
            }}
          >
            {confirming ? t('leaderboardResetConfirm') : t('leaderboardReset')}
          </button>
        )}
      </div>
    </Sheet>
  )
}
