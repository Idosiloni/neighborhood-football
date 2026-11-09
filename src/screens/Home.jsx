import { Fragment, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { api } from '../data'
import { useLoad, useLiveUpdates } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { useSchemaReady } from '../lib/schema'
import { today } from '../lib/dates'
import { computeAwards, computeStats } from '../lib/stats'
import { scoreOf } from '../lib/clock'
import { TEAM } from '../lib/teamsMeta'
import InstallHint from '../components/InstallHint'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import InviteButton from '../components/InviteButton'
import SignupCard from '../components/SignupCard'
import NotifyCard from '../components/NotifyCard'
import InviteCard from '../components/InviteCard'
import GroupSwitcher from '../components/GroupSwitcher'
import { unplaced } from '../lib/placement'
import { t, tl } from '../i18n'
import { useOptions, useSchedule } from '../lib/schedule'
import { isFresh, teamOfTheWeek } from '../lib/week'
import { tierOf } from '../lib/stats'
import { fullCard } from '../lib/attributes'
import { positionsOf } from '../lib/positions'
import { rememberTier, seenTier, wentUp } from '../lib/cardSeen'

export default function Home() {
  const ready = useSchemaReady()
  const opts = useOptions() // which features this group uses
  const schedule = useSchedule()
  const code = getMyCode()
  const day = today()

  const { data, reload } = useLoad(async () => {
    const me = code ? await api.getVoter(code).catch(() => null) : null
    if (!ready) return { me }
    const [players, night, history, myVotes, cats, requests] = await Promise.all([
      api.listPlayers(),
      api.getNight(day),
      api.getHistory(),
      me ? api.myMvpVotes(code).catch(() => []) : [],
      me && opts.rating === 'attrs' ? api.attrCards().catch(() => null) : null,
      me?.is_admin && api.adminRequests ? api.adminRequests().catch(() => []) : [],
    ])
    const attendance = night ? await api.listAttendance(night.id) : []
    return { me, players, night, attendance, history, myVotes, cats, requests }
  }, [ready, code, day, opts.rating])
  useLiveUpdates(reload)

  const view = useMemo(() => {
    if (!data?.history) return null
    const { players, night, attendance, history } = data
    const tonight = night ? history.matches.filter((m) => m.night_id === night.id) : []
    const live = tonight.find((m) => m.status === 'live')
    const stats = computeStats(players, history.matches, history.goals, history.mvp)
    const awards = computeAwards(stats)
    const active = players.filter((p) => p.active)
    // registered players first (newest first), then those who haven't signed up yet
    const roster = [...active].sort((x, y) => (y.claimed_at ?? '').localeCompare(x.claimed_at ?? ''))
    const last = [...history.matches].filter((m) => m.status === 'finished').sort((x, y) => (y.ended_at ?? '').localeCompare(x.ended_at ?? ''))[0]
    // A match I played in the last day that I haven't picked an MVP for yet.
    const meId = data.me?.id
    const voted = new Set((data.myVotes ?? []).map((v) => v.match_id))
    const toVote = meId
      ? history.matches
          .filter((m) => m.status === 'finished' && !voted.has(m.id) && [...m.team_a, ...m.team_b].includes(meId))
          .filter((m) => Date.now() - Date.parse(m.ended_at ?? m.created_at) < 24 * 3600_000)
          .sort((x, y) => (y.ended_at ?? '').localeCompare(x.ended_at ?? ''))[0]
      : null
    // My card's color now (to tell when it went up) and this week's best team.
    const mine = meId && players.find((p) => p.id === meId)
    const myOverall = mine ? (fullCard(data.cats, mine, positionsOf(mine))?.overall ?? stats.byId[meId]?.overall) : null
    const week = teamOfTheWeek(players, history, { size: schedule.team_size ?? 6, mvp: opts.mvp, assists: opts.assists })
    return {
      myTier: mine ? tierOf(myOverall) : null,
      upTo: mine && wentUp(meId, tierOf(myOverall)) ? tierOf(myOverall) : null,
      week: isFresh(week, day) ? week : null,
      inWeek: isFresh(week, day) && week.team.some((r) => r.id === meId),
      newOnes: unplaced(players, data.me),
      toVote,
      roster,
      registered: active.filter((p) => p.claimed_at).length,
      last,
      lastScore: last ? scoreOf(history.goals.filter((g) => g.match_id === last.id)) : null,
      byId: Object.fromEntries(players.map((p) => [p.id, p])),
      present: attendance.length,
      finishedCount: history.matches.filter((m) => m.status === 'finished').length,
      played: tonight.filter((m) => m.status === 'finished').length,
      live,
      liveScore: live ? scoreOf(history.goals.filter((g) => g.match_id === live.id)) : null,
      featured: awards.filter((a) => ['scorer', 'hot', 'duo'].includes(a.key)),
    }
  }, [data, schedule.team_size, opts.mvp, opts.assists, day])

  // The first look at my card's color is only remembered, so the next move up can be revealed.
  useEffect(() => {
    if (view?.myTier && data?.me && seenTier(data.me.id) == null) rememberTier(data.me.id, view.myTier)
  }, [view?.myTier, data?.me])

  const me = data?.me
  const groupName = me?.group?.name

  // What needs me, most important first. Only the top two show; the rest wait under "more".
  const showRankCta = Boolean(me && ready && opts.rating === 'peers' && !me.ranking && view?.roster?.length > 2)
  const todo = []
  if (data?.requests?.length > 0) {
    todo.push({ key: 'requests', node: (
      <a key="requests" className="card cta-card" href="#/admin/links">
        <div><strong>{t('home.push.requests', { count: data.requests.length })}</strong></div>
        <Icon name="forward" />
      </a>
    ) })
  }
  if (view?.toVote && opts.mvp) {
    todo.push({ key: 'mvp', node: (
      <a key="mvp" className="card cta-card mvp-cta" href={`#/match/${view.toVote.id}`}>
        <div>
          <strong>{t('home.mvpAsk', { num: view.toVote.num })}</strong>
          <p className="muted">{t('home.mvpText')}</p>
        </div>
        <Icon name="forward" />
      </a>
    ) })
  }
  if (view?.upTo) {
    todo.push({ key: 'up', node: (
      <a key="up" className={`card cta-card up-cta ${view.upTo}`} href="#/me">
        <div>
          <strong>{t('stats.reveal.homeTitle', { tier: t(`stats.tiers.${view.upTo}`) })}</strong>
          <p className="muted">{t('stats.reveal.homeText')}</p>
        </div>
        <Icon name="forward" />
      </a>
    ) })
  }
  if (showRankCta) {
    todo.push({ key: 'rank', node: (
      <a key="rank" className="card cta-card rank-cta" href={`#/v/${code}`}>
        <div>
          <strong>{t('home.rankTitle')}</strong>
          <p className="muted">{t('home.rankText')}</p>
        </div>
        <Icon name="forward" />
      </a>
    ) })
  }
  if (view?.newOnes?.length > 0 && opts.rating === 'peers') {
    todo.push({ key: 'new', node: (
      <a key="new" className="card cta-card" href="#/place">
        <div>
          <strong>{t('home.newPlayers', { count: view.newOnes.length, name: view.newOnes[0].name })}</strong>
          <p className="muted">{t('home.newPlayersText', { count: view.newOnes.length, name: view.newOnes[0].name })}</p>
        </div>
        <Icon name="forward" />
      </a>
    ) })
  }
  if (view?.inWeek) {
    todo.push({ key: 'week', node: (
      <a key="week" className="card cta-card week-you" href="#/week">
        <div>
          <strong>{t('stats.week.youAreIn')}</strong>
          <p className="muted">{t('stats.week.youAreInText')}</p>
        </div>
        <Icon name="forward" />
      </a>
    ) })
  }

  return (
    <main className="page home">
      <header className="hero compact">
        <div className="hero-pitch" aria-hidden="true" />
        <div className="hero-text">
          {groupName ? <h1 className={groupName.length > 12 ? 'long' : ''}>{groupName}</h1> : <h1 className={Math.max(...tl('home.heroTitle').map((l) => l.length)) > 8 ? 'long' : ''}>{tl('home.heroTitle').map((line, i) => <Fragment key={i}>{i > 0 && ' '}{line}</Fragment>)}</h1>}
          <p>{me ? t('home.hello', { name: me.name }) : t('home.tagline')}</p>
        </div>
        <GroupSwitcher label={t('home.myGroups')} className="hero-switch" />
      </header>

      {me?.is_admin && view && view.roster.length <= 1 && (
        <section className="card stack">
          <strong>{t('home.ready.title')}</strong>
          <p className="muted">{t('home.ready.text')}</p>
          <a className="btn ghost small" href="#/admin">{t('home.ready.addMyself')}</a>
        </section>
      )}
      {me?.is_admin && view && view.roster.length <= 1 && <InviteCard />}

      {view?.live && (
        <a className="card live-card" href={`#/match/${view.live.id}`}>
          <span className="live-dot">{t('home.liveNow', { num: view.live.num })}</span>
          <div className="live-score">
            <span className="team-a-text">{TEAM.a.short} {view.liveScore.a}</span>
            <span className="muted">–</span>
            <span className="team-b-text">{view.liveScore.b} {TEAM.b.short}</span>
          </div>
        </a>
      )}

      {view?.present > 0 && (
        <a className="card cta-card tonight-cta" href="#/tonight">
          <div>
            <strong>{t('home.tonight')}</strong>
            <p className="muted">{t('home.tonightNow', { arrived: t('home.arrived', { count: view.present }), games: t('home.games', { count: view.played }) })}</p>
          </div>
          <Icon name="forward" />
        </a>
      )}

      {ready && <SignupCard />}
      {me && ready && view && view.finishedCount === 0 && (
        <FirstGame inviteDone={view.registered >= 4} rankDone={opts.rating !== 'peers' || Boolean(me.ranking)} showRank={opts.rating === 'peers' && view.roster.length > 2} code={code} />
      )}
      {me && ready && <NotifyCard compact />}

      <AnimatePresence initial={false}>
        {todo.slice(0, 2).map((c, i) => (
          <m.div key={c.key} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, delay: i * 0.05 }}>
            {c.node}
          </m.div>
        ))}
      </AnimatePresence>
      {todo.length > 2 && (
        <details className="more-todo">
          <summary>{t('home.moreTodo', { count: todo.length - 2 })}</summary>
          <div className="stack">{todo.slice(2).map((c) => c.node)}</div>
        </details>
      )}

      {/* Only what the bottom bar doesn't already have: tonight while it's on, and rating. */}
      {(view?.week || opts.rating === 'attrs' || (opts.rating === 'peers' && !showRankCta)) && (
        <nav className="quick-links">
          {view?.week && !view.inWeek && (
            <a className="quick-link" href="#/week">
              <span className="quick-emoji" aria-hidden="true">⭐</span>
              <span>
                <strong>{t('stats.week.title')}</strong>
                <small>{view.week.team.map((r) => view.byId[r.id]?.name).filter(Boolean).slice(0, 3).join(', ')}…</small>
              </span>
              <Icon name="forward" size={18} />
            </a>
          )}
          {opts.rating === 'attrs' && (
            <a className="quick-link" href="#/rate">
              <span className="quick-emoji" aria-hidden="true">📊</span>
              <span>
                <strong>{t('stats.rate.cta')}</strong>
                <small>{t('stats.rate.ctaText')}</small>
              </span>
              <Icon name="forward" size={18} />
            </a>
          )}
          {opts.rating === 'peers' && !showRankCta && (
            <a className="quick-link" href={code ? `#/v/${code}` : '#/vote'}>
              <span className="quick-emoji" aria-hidden="true">🗳️</span>
              <span>
                <strong>{t('home.ranking')}</strong>
                <small>{me?.ranking ? t('home.rankingUpdate') : t('home.rankingSecret')}</small>
              </span>
              <Icon name="forward" size={18} />
            </a>
          )}
        </nav>
      )}

      {view?.last && (
        <a className="card last-result" href={`#/match/${view.last.id}`}>
          <span className="muted small">{t('home.lastGame')}</span>
          <div className="last-score">
            <span className={view.last.winner === 'a' ? 'won' : ''} style={{ '--c': TEAM.a.color }}>{TEAM.a.name} <b>{view.lastScore.a}</b></span>
            <span className="muted">–</span>
            <span className={view.last.winner === 'b' ? 'won' : ''} style={{ '--c': TEAM.b.color }}><b>{view.lastScore.b}</b> {TEAM.b.name}</span>
          </div>
        </a>
      )}

      {view?.roster?.length > 0 && (
        <section className="stack">
          <div className="section-head">
            <h2 className="section-title">{t('home.ourPlayers')}</h2>
            <span className="muted small">{t('home.registered', { count: view.registered, total: view.roster.length })}</span>
          </div>
          <div className="roster">
            {view.roster.map((p) => (
              <a key={p.id} href={`#/card/${p.id}`} className={`roster-item${p.claimed_at ? '' : ' pending'}`}>
                <Avatar player={p} size={52} />
                <span>{p.name}</span>
              </a>
            ))}
          </div>
          {me && <InviteButton />}
        </section>
      )}

      {me && ready && !view?.roster?.length && <InviteButton />}

      {view?.featured?.length > 0 && (
        <section className="stack">
          <h2 className="section-title">{t('home.podium')}</h2>
          <div className="featured">
            {view.featured.map((a) => (
              <a key={a.key} className="featured-item" href={`#/card/${a.ids.at(-1)}`}>
                <span className="award-emoji">{a.emoji}</span>
                <span className="award-faces">{a.ids.map((id) => view.byId[id] && <Avatar key={id} player={view.byId[id]} size={26} />)}</span>
                <span className="featured-text">
                  <strong>{a.title}</strong>
                  <small>{a.ids.map((id) => view.byId[id]?.name).filter(Boolean).join(' + ')}: {a.text}</small>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <InstallHint />

      {me?.is_admin && (
        <a className="admin-entry" href="#/admin">
          <Icon name="gear" size={18} />
          {t('home.manage')}
        </a>
      )}
    </main>
  )
}

// Before anything has been played: the few things that get the group ready, ticked as they happen.
function FirstGame({ inviteDone, rankDone, showRank, code }) {
  if (inviteDone && (rankDone || !showRank)) return null
  const item = (done, text, action) => (
    <li className={done ? 'done' : ''}>
      {action && !done ? (
        <button type="button" className="row-link" onClick={action}><span className="tick" aria-hidden="true">{done ? '✓' : ''}</span><span>{text}</span></button>
      ) : (
        <><span className="tick" aria-hidden="true">{done ? '✓' : ''}</span><span>{text}</span></>
      )}
    </li>
  )
  return (
    <section className="card getready">
      <h2>{t('home.firstGame.title')}</h2>
      <ul>
        {item(inviteDone, t('home.firstGame.invite'), () => document.querySelector('.roster')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))}
        {showRank && item(rankDone, t('home.firstGame.rank'), () => { window.location.hash = `#/v/${code}` })}
      </ul>
    </section>
  )
}
