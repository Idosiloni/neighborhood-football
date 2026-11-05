import { useEffect, useState } from 'react'
import { api } from '../data'
import PlayersTab from './admin/PlayersTab'
import LinksTab from './admin/LinksTab'
import RankingTab from './admin/RankingTab'
import GameTab from './admin/GameTab'
import PageHeader from '../components/PageHeader'
import { t } from '../i18n'

// Tab names are in admin.tabs.
const TABS = ['players', 'links', 'ranking', 'game']

// The group's admins (whoever opened it, and whoever they made admin) manage it here,
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

  if (admin === undefined) return <main className="page"><p className="center">{t('common.loading')}</p></main>
  if (!admin) {
    return (
      <main className="page">
        <PageHeader title={t('admin.title')} back="#/me" />
        <div className="card empty">
          <div className="empty-emoji">🔒</div>
          <strong>{t('admin.lockedTitle')}</strong>
          <p className="muted">{t('admin.lockedText')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page admin">
      <PageHeader title={t('admin.title')} sub={group ? t('admin.sub', { group: group.name }) : t('admin.subNoGroup')} back="#/me" />
      <nav className="tabs" role="tablist">
        {TABS.map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t(`admin.tabs.${id}`)}
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
