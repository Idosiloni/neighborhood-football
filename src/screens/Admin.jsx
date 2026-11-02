import { useEffect, useState } from 'react'
import { api } from '../data'
import PlayersTab from './admin/PlayersTab'
import LinksTab from './admin/LinksTab'
import RankingTab from './admin/RankingTab'
import GameTab from './admin/GameTab'
import PageHeader from '../components/PageHeader'

const TABS = [
  { id: 'players', label: 'שחקנים' },
  { id: 'links', label: 'קישורים' },
  { id: 'ranking', label: 'דירוג' },
  { id: 'game', label: 'קבוצה' },
]

// The group's admins (whoever opened it, and whoever he made admin) manage it here,
// recognized by their personal code like every other player.
export default function Admin() {
  const [admin, setAdmin] = useState()
  const [tab, setTab] = useState('players')
  const [players, setPlayers] = useState([])
  const [group, setGroup] = useState(null)

  const reload = () => Promise.all([api.listPlayers().then(setPlayers), api.getGroup().then(setGroup)])

  useEffect(() => {
    api.getAdmin().then(setAdmin, () => setAdmin(false))
  }, [])
  useEffect(() => {
    if (admin) reload()
  }, [admin])

  if (admin === undefined) return <main className="page"><p className="center">טוען…</p></main>
  if (!admin) {
    return (
      <main className="page">
        <PageHeader title="ניהול" back="#/me" />
        <div className="card empty">
          <div className="empty-emoji">🔒</div>
          <strong>רק מנהלי הקבוצה נכנסים לכאן</strong>
          <p className="muted">מי שפתח את הקבוצה הוא המנהל, והוא יכול להפוך שחקנים נוספים למנהלים.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page admin">
      <PageHeader title="ניהול" sub={group ? `${group.name} · רק המנהלים רואים את המסך הזה` : 'רק המנהלים רואים את המסך הזה'} back="#/me" />
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'players' && <PlayersTab players={players} reload={reload} />}
      {tab === 'links' && <LinksTab players={players} group={group} />}
      {tab === 'ranking' && <RankingTab players={players} />}
      {tab === 'game' && <GameTab group={group} reload={reload} />}
    </main>
  )
}
