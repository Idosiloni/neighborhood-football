import { useState } from 'react'
import { formation } from '../lib/lineup'
import { TEAM } from '../lib/teamsMeta'
import Avatar from './Avatar'
import { t } from '../i18n'

function Spot({ player, side, i = 0 }) {
  return (
    <div className={`spot side-${side}`} style={{ '--i': i }}>
      <Avatar player={player} size={46} />
      <span>{player.name}</span>
    </div>
  )
}

// The team drawn on a pitch in its formation, attack at the top. Switch between the two teams.
// deal: players fly in one by one, from the keeper forward (when teams were just made).
export default function Lineup({ teamA, teamB, byId, deal = false }) {
  const [side, setSide] = useState('a')
  const f = formation(side === 'a' ? teamA : teamB, byId)
  const order = new Map([f.keeper, ...f.rows.def, ...f.rows.mid, ...f.rows.att].filter(Boolean).map((p, i) => [p.id, i]))

  return (
    <div className="lineup">
      <div className="lineup-tabs" role="tablist">
        {['a', 'b'].map((s) => (
          <button key={s} role="tab" aria-selected={side === s} className={`side-${s}${side === s ? ' on' : ''}`} onClick={() => setSide(s)}>
            {TEAM[s].name}
          </button>
        ))}
      </div>
      <div key={side} className={`pitch${deal ? ' dealing' : ''}`}>
        <div className="pitch-lines" aria-hidden="true" />
        {['att', 'mid', 'def'].map((row) => (
          <div key={row} className="pitch-row">
            {f.rows[row].map((p) => <Spot key={p.id} player={p} side={side} i={order.get(p.id)} />)}
          </div>
        ))}
        <div className="pitch-row keeper">
          {f.keeper ? (
            <Spot player={f.keeper} side={side} i={0} />
          ) : (
            <div className="spot rotating">
              <span className="rotating-glove">🧤</span>
              <span>{t('match.rotatingKeeper')}</span>
            </div>
          )}
        </div>
        <span className="pitch-label" dir="ltr">{f.label}</span>
      </div>
    </div>
  )
}
