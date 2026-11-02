import { TEAM } from '../lib/teamsMeta'

// One line in a list of matches: "משחק 2 · כחולים 3 – 1 כתומים".
export default function MatchRow({ match, goals }) {
  const a = goals.filter((g) => g.match_id === match.id && g.team === 'a').length
  const b = goals.filter((g) => g.match_id === match.id && g.team === 'b').length
  return (
    <a className="match-row" href={`#/match/${match.id}`}>
      <span className="match-num">משחק {match.num}</span>
      <span className={`side${match.winner === 'a' ? ' won' : ''}`} style={{ '--c': TEAM.a.color }}>
        {TEAM.a.short} <b>{a}</b>
      </span>
      <span className="dash">–</span>
      <span className={`side${match.winner === 'b' ? ' won' : ''}`} style={{ '--c': TEAM.b.color }}>
        <b>{b}</b> {TEAM.b.short}
      </span>
      <span className="match-state">{match.status === 'live' ? <span className="live-dot">חי</span> : '🏁'}</span>
    </a>
  )
}
