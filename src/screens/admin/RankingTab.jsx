import { useEffect, useState } from 'react'
import { api } from '../../data'
import Avatar from '../../components/Avatar'
import { compareNames, listOf, t, tx } from '../../i18n'
import { useOptions } from '../../lib/schedule'

// What the admin sees here depends on how the group rates: the players' ballots, the admins' own
// stars, or nothing (teams by positions only).
export default function RankingTab({ players }) {
  const { rating } = useOptions()
  if (rating === 'admin') return <StarRatings players={players} />
  if (rating === 'none') return <p className="note">{t('admin.stars.none')}</p>
  return <PeerRanking players={players} />
}

// 1–5 stars per active player, saved on every tap. Only admins see them.
function StarRatings({ players }) {
  const [stars, setStars] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    api.adminStars().then((rows) => setStars(Object.fromEntries(rows.map((r) => [r.player_id, r.stars]))), () => setError(true))
  }, [players])

  if (error) return <p className="err">{t('stats.ranking.loadFailed')}</p>
  if (!stars) return <p className="center">{t('common.loading')}</p>

  const active = players.filter((p) => p.active).sort((a, b) => compareNames(a.name, b.name))
  const set = async (id, value) => {
    const before = stars[id] ?? null
    setStars({ ...stars, [id]: value })
    try {
      await api.setStars(id, value)
    } catch {
      setStars((s) => ({ ...s, [id]: before }))
    }
  }

  return (
    <section className="stack">
      <div className="card stack">
        <strong>{t('admin.stars.title')}</strong>
        <p className="muted small">{t('admin.stars.hint')}</p>
        <span className="muted small">{t('admin.stars.rated', { n: active.filter((p) => stars[p.id]).length, total: active.length })}</span>
      </div>
      <ul className="player-list">
        {active.map((p) => (
          <li key={p.id} className="card star-row">
            <Avatar player={p} size={34} />
            <span className="rank-name">{p.name}</span>
            <span className="stars" role="radiogroup" aria-label={p.name}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} role="radio" aria-checked={stars[p.id] === n} aria-label={t('admin.stars.star', { count: n })}
                  className={(stars[p.id] ?? 0) >= n ? 'on' : ''} onClick={() => set(p.id, stars[p.id] === n ? null : n)}>★</button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PeerRanking({ players }) {
  const [rows, setRows] = useState()
  const [status, setStatus] = useState([])
  const [error, setError] = useState(false)

  useEffect(() => {
    api.getRatings().then(setRows, () => setError(true))
    api.ballotStatus().then(setStatus, () => setStatus([])) // an older server has no status: just skip it
  }, [players])

  if (error) return <p className="err">{t('stats.ranking.loadFailed')}</p>
  if (!rows) return <p className="center">{t('common.loading')}</p>

  const byId = new Map(players.map((p) => [p.id, p]))
  const list = rows
    .filter((r) => byId.has(r.player_id))
    .map((r) => ({ ...r, player: byId.get(r.player_id), score: r.score == null ? null : Number(r.score) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const voted = list.filter((r) => r.has_voted)
  const missing = list.filter((r) => !r.has_voted)
  const lazy = status.filter((b) => b.moved === 0 && b.ranked >= 3 && byId.has(b.player_id))

  return (
    <section className="stack">
      <div className="vote-count">
        <span>{tx('stats.ranking.rankedForReal', { n: <strong>{voted.length - lazy.length}</strong>, total: list.length })}</span>
        {missing.length > 0 && <small>{t('stats.ranking.notYet', { names: listOf(missing.map((r) => r.player.name)) })}</small>}
        {lazy.length > 0 && (
          <small className="warn">{t('stats.ranking.lazy', { names: listOf(lazy.map((b) => byId.get(b.player_id).name)) })}</small>
        )}
      </div>
      {status.length > 0 && <BallotList status={status} byId={byId} />}

      {voted.length === 0 ? (
        <p className="muted center">{t('stats.ranking.noVotes')}</p>
      ) : (
        <ol className="rating-list">
          {list.map((r, i) => (
            <li key={r.player_id}>
              <span className="rank-num">{r.score == null ? '–' : i + 1}</span>
              <Avatar player={r.player} size={40} />
              <span className="rank-name">
                {r.player.name}
                <small>{t('stats.ranking.votes', { count: r.votes })}{r.avg_rank != null ? t('stats.ranking.avgRank', { avg: r.avg_rank }) : ''}</small>
              </span>
              <span className="score">
                <b>{r.score == null ? '–' : Math.round(r.score)}</b>
                <span className="bar"><span style={{ width: `${r.score ?? 0}%` }} /></span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small">{t('stats.ranking.scoreNote')}</p>
    </section>
  )
}

// Who ranked, and how seriously: how many players each one moved from the starting (ABC) order.
function BallotList({ status, byId }) {
  const [open, setOpen] = useState(false)
  const rows = status
    .filter((b) => byId.has(b.player_id))
    .map((b) => ({ ...b, player: byId.get(b.player_id) }))
    .sort((x, y) => (x.moved ?? -1) - (y.moved ?? -1) || compareNames(x.player.name, y.player.name))

  return (
    <div className="card stack">
      <button type="button" className="link-btn" onClick={() => setOpen(!open)}>
        {open ? t('stats.ranking.ballotsHide') : t('stats.ranking.ballotsShow')}
      </button>
      {open && (
        <ul className="ballot-list">
          {rows.map((b) => (
            <li key={b.player_id} className={b.ranked == null ? 'none' : b.moved === 0 && b.ranked >= 3 ? 'lazy' : ''}>
              <Avatar player={b.player} size={32} />
              <span>{b.player.name}</span>
              <small>
                {b.ranked == null
                  ? t('stats.ranking.ballotNone')
                  : b.moved == null
                    ? t('stats.ranking.ballotRanked', { count: b.ranked })
                    : b.moved === 0 && b.ranked >= 3
                      ? t('stats.ranking.ballotLazy')
                      : t('stats.ranking.ballotMoved', { moved: b.moved, ranked: b.ranked })}
              </small>
            </li>
          ))}
        </ul>
      )}
      {open && <p className="muted small">{t('stats.ranking.ballotsNote')}</p>}
    </div>
  )
}
