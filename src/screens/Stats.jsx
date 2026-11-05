import { useMemo, useState } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates } from '../lib/hooks'
import { useSchemaReady } from '../lib/schema'
import { computeAwards, computeStats, historyIn, seasonPeriods } from '../lib/stats'
import { t } from '../i18n'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import NeedsUpdate from '../components/NeedsUpdate'
import FormDots from '../components/FormDots'

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

// Season table columns to sort by. Win % only counts players with a few games.
const SORTS = [
  { key: 'wins', value: (s) => s.wins * 1000 + s.draws, label: () => t('stats.boards.wins') },
  { key: 'rate', value: (s) => (s.games >= 3 ? s.winRate : -1), label: () => t('stats.boards.rate') },
  { key: 'goals', value: (s) => s.goals, label: () => t('stats.boards.goals') },
  { key: 'assists', value: (s) => s.assists, label: () => t('stats.boards.assists') },
  { key: 'games', value: (s) => s.games, label: () => t('stats.table.games') },
]

function StatsBody() {
  const [board, setBoard] = useState('goals')
  const [sort, setSort] = useState('wins')
  const [scope, setScope] = useState(null) // a season's key, 'all', or null = the current season
  const { data, reload } = useLoad(async () => {
    const [players, history, seasons] = await Promise.all([api.listPlayers(), api.getHistory(), api.listSeasons()])
    return { players, history, seasons }
  }, [])
  useLiveUpdates(reload)

  const periods = useMemo(() => (data ? seasonPeriods(data.seasons, data.history.nights) : []), [data])
  const current = periods.at(-1)?.key ?? 'all'
  const active = scope ?? current
  const period = periods.find((p) => p.key === active) ?? null

  const view = useMemo(() => {
    if (!data) return null
    const h = historyIn(data.history, period)
    const stats = computeStats(data.players, h.matches, h.goals, h.mvp)
    return { stats, awards: computeAwards(stats), byId: Object.fromEntries(data.players.map((p) => [p.id, p])) }
  }, [data, period])

  if (!view) return <p className="center muted">{t('common.loading')}</p>
  const { stats, awards, byId } = view

  // Seasons: the current one, the earlier ones (newest first), and all time.
  const chips = periods.length
    ? [...[...periods].reverse().map((p, i) => ({ key: p.key, label: i === 0 ? t('stats.season.current') : p.name ?? t('stats.season.earlier') })), { key: 'all', label: t('stats.season.all') }]
    : []
  const seasonChips = chips.length > 0 && (
    <div className="chips season-chips">
      {chips.map((c) => (
        <button key={c.key} type="button" className={active === c.key ? 'on' : ''} aria-pressed={active === c.key} onClick={() => setScope(c.key)}>{c.label}</button>
      ))}
    </div>
  )

  if (stats.matchCount === 0) {
    const previous = periods.length > 1 && active === current ? periods.at(-2) : null
    return (
      <>
        {seasonChips}
        <div className="card empty">
          <div className="empty-emoji">📊</div>
          <strong>{previous ? t('stats.season.justStarted') : t('stats.empty.title')}</strong>
          <p className="muted">{previous ? t('stats.season.justStartedText') : t('stats.empty.text')}</p>
          {previous && <button className="btn ghost" onClick={() => setScope(previous.key)}>{t('stats.season.lastSeason')}</button>}
        </div>
      </>
    )
  }

  const b = BOARDS.find((x) => x.key === board)
  const played = stats.players.filter((s) => byId[s.id]?.active && s.games > 0)
  const rows = [...played].sort((x, y) => b.value(y) - b.value(x) || x.games - y.games)
  const by = SORTS.find((x) => x.key === sort)
  const table = [...played].sort((x, y) => by.value(y) - by.value(x) || y.games - x.games)

  return (
    <>
      {seasonChips}
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
        <h2 className="section-title">{t('stats.table.title')}</h2>
        <div className="chips" role="group" aria-label={t('stats.table.sortBy')}>
          {SORTS.map((x) => (
            <button key={x.key} type="button" className={sort === x.key ? 'on' : ''} aria-pressed={sort === x.key} onClick={() => setSort(x.key)}>{x.label()}</button>
          ))}
        </div>
        <div className="season-table" role="table">
          <div className="st-row st-head" role="row">
            <span role="columnheader">#</span>
            <span role="columnheader" className="st-name">{t('stats.table.name')}</span>
            <span role="columnheader">{t('stats.table.games')}</span>
            <span role="columnheader">{t('stats.table.record')}</span>
            <span role="columnheader">{sort === 'rate' ? '%' : t('stats.table.goals')}</span>
            <span role="columnheader">{t('stats.table.assists')}</span>
          </div>
          {table.map((s, i) => (
            <a key={s.id} className="st-row" role="row" href={`#/card/${s.id}`}>
              <span role="cell" className="st-num">{i + 1}</span>
              <span role="cell" className="st-name">
                <Avatar player={byId[s.id]} size={28} />
                <span className="st-name-text">
                  <span className="st-nm">{byId[s.id].name}</span>
                  <FormDots form={s.form} />
                </span>
              </span>
              <span role="cell">{s.games}</span>
              <span role="cell" dir="ltr">{s.wins}-{s.draws}-{s.losses}</span>
              <span role="cell">{sort === 'rate' ? (s.games >= 3 ? `${Math.round(s.winRate * 100)}` : '–') : s.goals}</span>
              <span role="cell">{s.assists}</span>
            </a>
          ))}
        </div>
        {sort === 'rate' && <p className="muted small">{t('stats.table.minGames', { count: 3 })}</p>}
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
