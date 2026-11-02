import { useEffect, useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { skip, unplaced } from '../lib/placement'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'

// One new player at a time: tap the first player he is better than. Saved after each one.
export default function Place() {
  const code = getMyCode()
  const { data } = useLoad(async () => {
    const [me, players] = await Promise.all([code ? api.getVoter(code) : null, api.listPlayers()])
    return { me, players }
  }, [code])
  const [order, setOrder] = useState(null)
  const [queue, setQueue] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data?.me) return
    const byId = new Map(data.players.map((p) => [p.id, p]))
    setOrder(data.me.ranking.filter((id) => byId.get(id)?.active && id !== data.me.id))
    setQueue(unplaced(data.players, data.me).map((p) => p.id))
  }, [data])

  if (!data || order === null) {
    return (
      <main className="page">
        <PageHeader title="שחקן חדש" back="#/" />
        <p className="center muted">{data && !data.me ? 'צריך קודם להצטרף ולדרג.' : 'טוען…'}</p>
      </main>
    )
  }

  const byId = Object.fromEntries(data.players.map((p) => [p.id, p]))
  const current = byId[queue[0]]

  const place = async (index) => {
    const next = [...order]
    next.splice(index, 0, current.id)
    setSaving(true)
    await api.submitBallot(code, next)
    setOrder(next)
    setQueue(queue.slice(1))
    setSaving(false)
  }

  const later = () => {
    skip(current.id)
    setQueue(queue.slice(1))
  }

  if (!current) {
    return (
      <main className="page">
        <PageHeader title="הכול מעודכן" back="#/" />
        <div className="card empty">
          <div className="empty-emoji">✅</div>
          <strong>הדירוג שלך מעודכן</strong>
          <a className="btn" href="#/">לדף הבית</a>
        </div>
      </main>
    )
  }

  return (
    <main className="page">
      <PageHeader title={`איפה ${current.name} אצלך?`} sub={queue.length > 1 ? `עוד ${queue.length - 1} אחריו` : 'שחקן חדש שהצטרף'} back="#/" />
      <div className="place-new">
        <Avatar player={current} size={84} />
        <p>לחץ על השחקן הראשון ש<strong>{current.name}</strong> יותר טוב ממנו:</p>
      </div>
      <ol className="place-list">
        {order.map((id, i) => byId[id] && (
          <li key={id}>
            <button onClick={() => place(i)} disabled={saving}>
              <span className="rank-num">{i + 1}</span>
              <Avatar player={byId[id]} size={32} />
              <span>{byId[id].name}</span>
            </button>
          </li>
        ))}
      </ol>
      <button className="btn ghost" onClick={() => place(order.length)} disabled={saving}>
        {current.name} פחות טוב מכולם
      </button>
      <button className="link-btn" onClick={later}>לא מכיר אותו עדיין, דלג</button>
    </main>
  )
}
