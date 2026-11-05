import { useMemo, useState } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates } from '../lib/hooks'
import { useSchemaReady } from '../lib/schema'
import { optionsOf } from '../lib/options'
import { teamOfTheWeek } from '../lib/week'
import { dayLabel } from '../lib/dates'
import { drawWeek, shareImage } from '../lib/shareImages'
import { getMyCode } from '../lib/identity'
import PageHeader from '../components/PageHeader'
import NeedsUpdate from '../components/NeedsUpdate'
import Avatar from '../components/Avatar'
import Loading from '../components/Loading'
import { Pitch } from '../components/Lineup'
import { t } from '../i18n'

// Team of the Week: the best players of the last game day, on the pitch and as a list.
export default function Week() {
  const ready = useSchemaReady()
  return (
    <main className="page">
      <PageHeader title={t('stats.week.title')} back="#/stats" />
      {ready === false ? <NeedsUpdate /> : ready ? <WeekBody /> : <Loading />}
    </main>
  )
}

function WeekBody() {
  const [sharing, setSharing] = useState(false)
  const { data, reload } = useLoad(async () => {
    const [players, history, schedule] = await Promise.all([api.listPlayers(), api.getHistory(), api.getSchedule()])
    const me = getMyCode() ? await api.getVoter(getMyCode()).catch(() => null) : null
    return { players, history, schedule, me }
  }, [])
  useLiveUpdates(reload)

  const view = useMemo(() => {
    if (!data) return null
    const opts = optionsOf(data.schedule)
    const week = teamOfTheWeek(data.players, data.history, { size: data.schedule?.team_size ?? 6, mvp: opts.mvp, assists: opts.assists })
    return { week, opts, byId: Object.fromEntries(data.players.map((p) => [p.id, p])) }
  }, [data])

  if (!view) return <Loading />
  const { week, opts, byId } = view
  if (!week) return <p className="card empty muted">{t('stats.week.empty')}</p>

  const lineOf = (r) =>
    [t('stats.week.wins', { count: r.wins }), t('sport.goals', { count: r.goals }), opts.assists && t('sport.assists', { count: r.assists })].filter(Boolean).join(' · ')
  const rules = t('stats.week.points') + (opts.assists ? t('stats.week.pointsAssists') : '') + (opts.mvp ? t('stats.week.pointsMvp') : '')
  const day = dayLabel(week.night.day)
  const mine = data.me && week.team.some((r) => r.id === data.me.id)

  return (
    <>
      <p className="muted center">{t('stats.week.sub', { day })}</p>
      {mine && <p className="card week-you"><strong>{t('stats.week.youAreIn')}</strong><span className="muted small">{t('stats.week.youAreInText')}</span></p>}
      <div className="week-pitch"><Pitch ids={week.team.map((r) => r.id)} byId={byId} side="week" star={week.star} deal /></div>
      <section className="stack">
        {week.team.map((r) => byId[r.id] && (
          <a key={r.id} className={`card award-line${r.id === week.star ? ' week-star' : ''}`} href={`#/card/${r.id}`}>
            <Avatar player={byId[r.id]} size={34} />
            <span className="stack tight">
              <strong>{byId[r.id].name}{r.id === week.star && ` · ${t('stats.week.star')}`}</strong>
              <span className="muted small">{lineOf(r)}{opts.mvp && r.mvp > 0 ? ` · 🌟 ${r.mvp}` : ''}</span>
            </span>
            <b className="week-pts">{t('stats.week.pts', { count: r.points })}</b>
          </a>
        ))}
      </section>
      <p className="muted small center">{rules}</p>
      <button
        className="btn ghost"
        disabled={sharing}
        onClick={async () => {
          setSharing(true)
          try {
            const rows = week.team.filter((r) => byId[r.id]).map((r) => ({ name: byId[r.id].name, line: lineOf(r) }))
            const blob = await drawWeek({ title: t('stats.week.title'), sub: `${data.me?.group?.name ?? ''} · ${day}`, rows })
            await shareImage(blob, 'team-of-the-week.jpg', t('stats.week.shareText'))
          } finally {
            setSharing(false)
          }
        }}
      >
        {sharing ? t('stats.card.preparing') : t('stats.week.share')}
      </button>
    </>
  )
}
