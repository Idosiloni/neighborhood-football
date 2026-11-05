import { useEffect, useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { skip, unplaced } from '../lib/placement'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import { t, tx } from '../i18n'
import Loading from '../components/Loading'

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
        <PageHeader title={t('onboarding.place.newPlayer')} back="#/" />
        {data && !data.me ? <p className="center muted">{t('onboarding.place.needJoin')}</p> : <Loading />}
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
        <PageHeader title={t('onboarding.place.allSet')} back="#/" />
        <div className="card empty">
          <div className="empty-emoji">✅</div>
          <strong>{t('onboarding.place.upToDate')}</strong>
          <a className="btn" href="#/">{t('onboarding.place.home')}</a>
        </div>
      </main>
    )
  }

  return (
    <main className="page">
      <PageHeader
        title={t('onboarding.place.where', { name: current.name })}
        sub={queue.length > 1 ? t('onboarding.place.more', { count: queue.length - 1 }) : t('onboarding.place.justJoined')}
        back="#/"
      />
      <div className="place-new">
        <Avatar player={current} size={84} />
        <p>{tx('onboarding.place.tap', { name: <strong>{current.name}</strong> })}</p>
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
        {t('onboarding.place.last', { name: current.name })}
      </button>
      <button className="link-btn" onClick={later}>{t('onboarding.place.skip')}</button>
    </main>
  )
}
