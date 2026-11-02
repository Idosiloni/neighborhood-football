import { useMemo, useState } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates } from '../lib/hooks'
import { useSchemaReady } from '../lib/schema'
import { computeAwards, computeStats, count } from '../lib/stats'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import NeedsUpdate from '../components/NeedsUpdate'

const BOARDS = [
  { key: 'goals', label: 'שערים', value: (s) => s.goals, show: (s) => s.goals },
  { key: 'assists', label: 'בישולים', value: (s) => s.assists, show: (s) => s.assists },
  { key: 'wins', label: 'ניצחונות', value: (s) => s.wins, show: (s) => s.wins },
  { key: 'rate', label: '% ניצחון', value: (s) => (s.games >= 3 ? s.winRate : -1), show: (s) => (s.games >= 3 ? `${Math.round(s.winRate * 100)}%` : '–') },
]

export default function Stats() {
  const ready = useSchemaReady()
  return (
    <main className="page">
      <PageHeader title="סטטיסטיקה" sub="פרסים, טבלאות וכרטיסי שחקן" />
      {ready === false ? <NeedsUpdate /> : ready ? <StatsBody /> : <p className="center muted">טוען…</p>}
    </main>
  )
}

function StatsBody() {
  const [board, setBoard] = useState('goals')
  const { data, reload } = useLoad(async () => {
    const [players, history] = await Promise.all([api.listPlayers(), api.getHistory()])
    return { players, history }
  }, [])
  useLiveUpdates(reload)

  const view = useMemo(() => {
    if (!data) return null
    const stats = computeStats(data.players, data.history.matches, data.history.goals, data.history.mvp)
    return { stats, awards: computeAwards(stats), byId: Object.fromEntries(data.players.map((p) => [p.id, p])) }
  }, [data])

  if (!view) return <p className="center muted">טוען…</p>
  const { stats, awards, byId } = view

  if (stats.matchCount === 0) {
    return (
      <div className="card empty">
        <div className="empty-emoji">📊</div>
        <strong>עוד אין משחקים שהסתיימו</strong>
        <p className="muted">אחרי המשחק הראשון יופיעו כאן מלך השערים, הצמד הזהב ועוד.</p>
      </div>
    )
  }

  const b = BOARDS.find((x) => x.key === board)
  const rows = stats.players.filter((s) => byId[s.id]?.active && s.games > 0).sort((x, y) => b.value(y) - b.value(x) || x.games - y.games)

  return (
    <>
      <p className="muted small">{count(stats.matchCount, 'משחק אחד', 'משחקים')} עד היום</p>
      <section className="award-grid">
        {awards.map((a) => (
          <a key={a.key} className="award" href={`#/card/${a.ids[a.ids.length - 1]}`}>
            <span className="award-emoji">{a.emoji}</span>
            <span className="award-title">{a.title}</span>
            <span className="award-faces">
              {a.ids.map((id) => byId[id] && <Avatar key={id} player={byId[id]} size={30} />)}
            </span>
            <span className="award-name">{a.ids.map((id) => byId[id]?.name).filter(Boolean).join(' + ')}</span>
            <span className="award-text">{a.text}</span>
          </a>
        ))}
      </section>

      <section className="stack">
        <h2 className="section-title">טבלאות</h2>
        <div className="tabs" role="tablist">
          {BOARDS.map((x) => (
            <button key={x.key} role="tab" aria-selected={board === x.key} className={board === x.key ? 'on' : ''} onClick={() => setBoard(x.key)}>
              {x.label}
            </button>
          ))}
        </div>
        <ol className="board-list">
          {rows.map((s, i) => (
            <li key={s.id}>
              <a href={`#/card/${s.id}`}>
                <span className="rank-num">{i + 1}</span>
                <Avatar player={byId[s.id]} size={36} />
                <span className="rank-name">
                  {byId[s.id].name}
                  <small>{count(s.games, 'משחק אחד', 'משחקים')}</small>
                </span>
                <b className="board-value">{b.show(s)}</b>
              </a>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
