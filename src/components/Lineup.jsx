import { useState } from 'react'
import { formation } from '../lib/lineup'
import { TEAM } from '../lib/teamsMeta'
import Avatar from './Avatar'
import { t } from '../i18n'

function Spot({ player, side, i = 0, star = false }) {
  return (
    <div className={`spot side-${side}${star ? ' star' : ''}`} style={{ '--i': i }}>
      <Avatar player={player} size={46} />
      <span>{player.name}</span>
    </div>
  )
}

// The team drawn on a pitch in its formation, attack at the top. Switch between the two teams.
// deal: players fly in one by one, from the keeper forward (when teams were just made).
export default function Lineup({ teamA, teamB, byId, deal = false }) {
  const [side, setSide] = useState('a')
  return (
    <div className="lineup">
      <div className="lineup-tabs" role="tablist">
        {['a', 'b'].map((s) => (
          <button key={s} role="tab" aria-selected={side === s} className={`side-${s}${side === s ? ' on' : ''}`} onClick={() => setSide(s)}>
            {TEAM[s].name}
          </button>
        ))}
      </div>
      <Pitch key={side} ids={side === 'a' ? teamA : teamB} byId={byId} side={side} deal={deal} />
    </div>
  )
}

// One team on the pitch. side: 'a' / 'b' (bib colors) or 'week' (Team of the Week).
// A team without a keeper shows "rotating in goal", except the Team of the Week (just no keeper).
export function Pitch({ ids, byId, side, deal = false, star = null }) {
  const f = formation(ids, byId)
  const order = new Map([f.keeper, ...f.rows.def, ...f.rows.mid, ...f.rows.att].filter(Boolean).map((p, i) => [p.id, i]))
  const spot = (p) => <Spot key={p.id} player={p} side={side} i={order.get(p.id)} star={p.id === star} />
  return (
    <div className={`pitch${deal ? ' dealing' : ''}`}>
      <div className="pitch-lines" aria-hidden="true" />
      {['att', 'mid', 'def'].map((row) => (
        <div key={row} className="pitch-row">{f.rows[row].map(spot)}</div>
      ))}
      <div className="pitch-row keeper">
        {f.keeper ? spot(f.keeper) : side !== 'week' && (
          <div className="spot rotating">
            <span className="rotating-glove">🧤</span>
            <span>{t('match.rotatingKeeper')}</span>
          </div>
        )}
      </div>
      <span className="pitch-label" dir="ltr">{f.label}</span>
    </div>
  )
}
