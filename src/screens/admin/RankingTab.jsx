import { useEffect, useState } from 'react'
import { api } from '../../data'
import Avatar from '../../components/Avatar'

export default function RankingTab({ players }) {
  const [rows, setRows] = useState()
  const [status, setStatus] = useState([])
  const [error, setError] = useState(false)

  useEffect(() => {
    api.getRatings().then(setRows, () => setError(true))
    api.ballotStatus().then(setStatus, () => setStatus([])) // an older server has no status: just skip it
  }, [players])

  if (error) return <p className="err">לא הצלחתי לטעון את הדירוג</p>
  if (!rows) return <p className="center">טוען…</p>

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
        <span><strong>{voted.length - lazy.length}</strong> מתוך {list.length} דירגו באמת</span>
        {missing.length > 0 && <small>עוד לא דירגו: {missing.map((r) => r.player.name).join(', ')}</small>}
        {lazy.length > 0 && (
          <small className="warn">⚠️ שמרו בלי להזיז אף שחקן (הדירוג שלהם לא נספר): {lazy.map((b) => byId.get(b.player_id).name).join(', ')}</small>
        )}
      </div>
      {status.length > 0 && <BallotList status={status} byId={byId} />}

      {voted.length === 0 ? (
        <p className="muted center">עוד אין הצבעות. שלח קישורים בלשונית "קישורים".</p>
      ) : (
        <ol className="rating-list">
          {list.map((r, i) => (
            <li key={r.player_id}>
              <span className="rank-num">{r.score == null ? '–' : i + 1}</span>
              <Avatar player={r.player} size={40} />
              <span className="rank-name">
                {r.player.name}
                <small>{r.votes} מדרגים{r.avg_rank != null ? `, מקום ממוצע ${r.avg_rank}` : ''}</small>
              </span>
              <span className="score">
                <b>{r.score == null ? '–' : Math.round(r.score)}</b>
                <span className="bar"><span style={{ width: `${r.score ?? 0}%` }} /></span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small">
        הציון: 100 = כולם שמו אותו ראשון, 0 = כולם שמו אותו אחרון. ההצבעה של שחקן על עצמו לא נספרת.
      </p>
    </section>
  )
}

// Who ranked, and how seriously: how many players each one moved from the starting (ABC) order.
function BallotList({ status, byId }) {
  const [open, setOpen] = useState(false)
  const rows = status
    .filter((b) => byId.has(b.player_id))
    .map((b) => ({ ...b, player: byId.get(b.player_id) }))
    .sort((x, y) => (x.moved ?? -1) - (y.moved ?? -1) || x.player.name.localeCompare(y.player.name, 'he'))

  return (
    <div className="card stack">
      <button type="button" className="link-btn" onClick={() => setOpen(!open)}>
        {open ? 'הסתר' : 'מי דירג ואיך? (כמה שחקנים כל אחד הזיז)'}
      </button>
      {open && (
        <ul className="ballot-list">
          {rows.map((b) => (
            <li key={b.player_id} className={b.ranked == null ? 'none' : b.moved === 0 && b.ranked >= 3 ? 'lazy' : ''}>
              <Avatar player={b.player} size={32} />
              <span>{b.player.name}</span>
              <small>
                {b.ranked == null
                  ? 'עוד לא דירג'
                  : b.moved == null
                    ? `דירג ${b.ranked}`
                    : b.moved === 0 && b.ranked >= 3
                      ? '⚠️ לא הזיז אף אחד'
                      : `הזיז ${b.moved} מתוך ${b.ranked}`}
              </small>
            </li>
          ))}
        </ul>
      )}
      {open && <p className="muted small">רק המספרים: מה כל אחד דירג נשאר סודי, גם ממך. מי שלא הזיז אף אחד, הדירוג שלו פשוט לפי א"ב ולכן לא נספר. אפשר לבקש ממנו לדרג שוב.</p>}
    </div>
  )
}
