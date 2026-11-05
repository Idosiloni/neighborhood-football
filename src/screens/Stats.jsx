import { useMemo, useState } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates } from '../lib/hooks'
import { useSchemaReady } from '../lib/schema'
import { computeAwards, computeStats } from '../lib/stats'
import { t } from '../i18n'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import NeedsUpdate from '../components/NeedsUpdate'

// Labels come from stats.boards.<key>, read when shown.
const BOARDS = [
  { key: 'goals', value: (s) => s.goals, show: (s) => s.goals },
  { key: 'assists', value: (s) => s.assists, show: (s) => s.assists },
  { key: 'wins', value: (s) => s.wins, show: (s) => s.wins },
  { key: 'rate', value: (s) => (s.games >= 3 ? s.winRate : -1), show: (s) => (s.games >= 3 ? `${Math.round(s.winRate * 100)}%` : '–') },
]

export default function Stats() {
  const ready = useSchemaReady()
  return (
    <main className="page">
      <PageHeader title={t('stats.title')} sub={t('stats.sub')} />
      {ready === false ? <NeedsUpdate /> : ready ? <StatsBody /> : <p className="center muted">{t('common.loading')}</p>}
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

  if (!view) return <p className="center muted">{t('common.loading')}</p>
  const { stats, awards, byId } = view

  if (stats.matchCount === 0) {
    return (
      <div className="card empty">
        <div className="empty-emoji">📊</div>
        <strong>{t('stats.empty.title')}</strong>
        <p className="muted">{t('stats.empty.text')}</p>
      </div>
    )
  }

  const b = BOARDS.find((x) => x.key === board)
  const rows = stats.players.filter((s) => byId[s.id]?.active && s.games > 0).sort((x, y) => b.value(y) - b.value(x) || x.games - y.games)

  return (
    <>
      <p className="muted small">{t('stats.matchesSoFar', { count: stats.matchCount })}</p>
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
        <h2 className="section-title">{t('stats.boardsTitle')}</h2>
        <div className="tabs" role="tablist">
          {BOARDS.map((x) => (
            <button key={x.key} role="tab" aria-selected={board === x.key} className={board === x.key ? 'on' : ''} onClick={() => setBoard(x.key)}>
              {t(`stats.boards.${x.key}`)}
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
                  <small>{t('stats.games', { count: s.games })}</small>
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
