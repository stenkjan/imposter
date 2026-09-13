import { useState } from 'react'
import type { Translate } from '../game/i18n'
import { readCareer, resetCareer } from '../game/leaderboard'
import { Avatar, Sheet } from './ui'

/** The all-time table, kept on this device across evenings and both modes. */
export function CareerSheet({ t, onClose }: { t: Translate; onClose: () => void }) {
  const [rows, setRows] = useState(readCareer)
  const [confirming, setConfirming] = useState(false)
  const leader = rows[0]?.points ?? 0
  const plural = (n: number, one: 'careerGame' | 'careerWin', many: 'careerGames' | 'careerWins') =>
    `${n} ${t(n === 1 ? one : many)}`

  return (
    <Sheet title={t('career')} onClose={onClose}>
      {rows.length === 0 ? (
        <p className="empty">{t('careerEmpty')}</p>
      ) : (
        <ul className="score-list">
          {rows.map((row, i) => (
            <li
              key={row.name}
              className={i === 0 && leader > 0 ? 'score-row lead' : 'score-row'}
            >
              <span className="rank">{i + 1}</span>
              <Avatar name={row.name} size={34} />
              <span className="name">
                {row.name}
                <small className="sub">
                  {plural(row.games, 'careerGame', 'careerGames')} ·{' '}
                  {plural(row.wins, 'careerWin', 'careerWins')}
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
              resetCareer()
              setRows([])
              setConfirming(false)
            }}
          >
            {confirming ? t('careerResetConfirm') : t('careerReset')}
          </button>
        )}
      </div>
    </Sheet>
  )
}
