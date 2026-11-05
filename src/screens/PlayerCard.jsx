import { useMemo, useState } from 'react'
import { drawCard, shareCard } from '../lib/cardImage'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { useSchemaReady } from '../lib/schema'
import { cardAttributes, computeAwards, computeStats, funTraits, headToHead, historyIn, milestones, seasonPeriods, tagline } from '../lib/stats'
import FormDots from '../components/FormDots'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import NeedsUpdate from '../components/NeedsUpdate'
import { positionsText } from '../lib/positions'
import { usePhoto } from '../lib/photos'
import { t } from '../i18n'

export default function PlayerCard({ id }) {
  const ready = useSchemaReady()
  return (
    <main className="page">
      <PageHeader title={t('stats.card.title')} back="#/stats" />
      {ready === false ? <NeedsUpdate /> : ready ? <CardBody id={id} /> : <p className="center muted">{t('common.loading')}</p>}
    </main>
  )
}

export function CardBody({ id }) {
  const { data } = useLoad(async () => {
    const [players, history, seasons] = await Promise.all([api.listPlayers(), api.getHistory(), api.listSeasons()])
    return { players, history, seasons }
  }, [id])

  const view = useMemo(() => {
    if (!data) return null
    const player = data.players.find((p) => p.id === id)
    if (!player) return { player: null }
    const stats = computeStats(data.players, data.history.matches, data.history.goals, data.history.mvp)
    const awards = computeAwards(stats).filter((a) => a.ids.includes(id))
    // The card is all time; with seasons, one line for the current one.
    const season = seasonPeriods(data.seasons, data.history.nights).at(-1)
    let now = null
    if (season) {
      const h = historyIn(data.history, season)
      now = computeStats(data.players, h.matches, h.goals, h.mvp).byId[id]
    }
    return { player, s: stats.byId[id], awards, h2h: headToHead(stats, id), now, byId: Object.fromEntries(data.players.map((p) => [p.id, p])) }
  }, [data, id])

  const [sharing, setSharing] = useState(false)

  if (!view) return <p className="center muted">{t('common.loading')}</p>
  if (!view.player) return <p className="center muted">{t('stats.card.notFound')}</p>

  const { player, s, awards, h2h, now, byId } = view
  const marks = milestones(s)
  const tier = s.overall == null ? 'new' : s.overall >= 75 ? 'gold' : s.overall >= 65 ? 'silver' : 'bronze'
  const attrs = cardAttributes(s)
  const traits = funTraits(s, player)

  return (
    <>
      <div className={`fut-card ${tier}`} onPointerMove={tilt} onPointerLeave={untilt}>
        <div className="fut-top">
          <div className="fut-rating">
            <b>{s.overall ?? '?'}</b>
            <span>{positionsText(player, { short: true })}</span>
            {awards[0] && <span className="fut-side">{awards[0].emoji}</span>}
          </div>
          <CardPhoto player={player} />
        </div>
        <div className="fut-name">{player.name}</div>
        {player.nickname && <div className="fut-nick">{t('stats.card.nickname', { name: player.nickname })}</div>}
        {!player.nickname && awards[0] && <div className="fut-nick">{awards[0].title}</div>}
        <div className="fut-attrs">
          {attrs.map((a) => (
            <div key={a.key}><b>{a.value}</b><span>{a.label}</span></div>
          ))}
        </div>
      </div>
      <button
        className="btn ghost"
        disabled={sharing}
        onClick={async () => {
          setSharing(true)
          try {
            const blob = await drawCard({ player, overall: s.overall, tier, attrs, traits, line: tagline(player) })
            await shareCard(blob, player.name)
          } finally {
            setSharing(false)
          }
        }}
      >
        {sharing ? t('stats.card.preparing') : t('stats.card.share')}
      </button>
      <p className="tagline">{tagline(player)}</p>
      {traits.length > 0 && (
        <div className="trait-row">
          {traits.map((x) => <span key={x.key} className="trait">{x.emoji} {x.label}</span>)}
        </div>
      )}
      {s.overall == null && <p className="muted center small">{t('stats.card.ratingLater')}</p>}

      {s.games > 0 && (
        <section className="card stack card-more">
          <div className="card-line">
            <strong>{t('stats.form.title')}</strong>
            <FormDots form={s.form} size="large" />
          </div>
          <span>{t('stats.cardMore.record', { w: s.wins, d: s.draws, l: s.losses })}</span>
          {now && now.games > 0 && (
            <span>{t('stats.cardMore.seasonLine', { games: t('stats.games', { count: now.games }), wins: now.wins, goals: now.goals })}</span>
          )}
          {s.attendance != null && (
            <span>{t('stats.cardMore.attendance', { pct: Math.round(s.attendance * 100), played: s.nightsPlayed, since: s.nightsSince })}</span>
          )}
          {s.nightStreak > 1 && <span>{t('stats.cardMore.nightStreak', { count: s.nightStreak })}</span>}
          {marks.length > 0 && (
            <div className="trait-row">
              {marks.map((m) => <span key={m.key} className="trait">{m.emoji} {m.label}</span>)}
            </div>
          )}
        </section>
      )}

      {(h2h.partners.length > 0 || h2h.opponents.length > 0) && (
        <section className="stack">
          {h2h.partners.length > 0 && (
            <>
              <h2 className="section-title">{t('stats.cardMore.partners')}</h2>
              {h2h.partners.slice(0, 3).map((p) => byId[p.id] && (
                <a key={p.id} className="card award-line" href={`#/card/${p.id}`}>
                  <Avatar player={byId[p.id]} size={30} />
                  <strong>{byId[p.id].name}</strong>
                  <span className="muted">{t('stats.cardMore.partnerLine', { wins: p.wins, games: p.games })}</span>
                </a>
              ))}
            </>
          )}
          {h2h.opponents.length > 0 && (
            <>
              <h2 className="section-title">{t('stats.cardMore.opponents')}</h2>
              {h2h.opponents.slice(0, 3).map((o) => byId[o.id] && (
                <a key={o.id} className="card award-line" href={`#/card/${o.id}`}>
                  <Avatar player={byId[o.id]} size={30} />
                  <strong>{byId[o.id].name}</strong>
                  <span className="muted" dir="auto">{t('stats.cardMore.opponentLine', { w: o.wins, d: o.draws, l: o.losses })}</span>
                </a>
              ))}
            </>
          )}
        </section>
      )}

      {awards.length > 0 && (
        <section className="stack">
          <h2 className="section-title">{t('stats.card.awardsTitle')}</h2>
          {awards.map((a) => (
            <div key={a.key} className="card award-line"><span>{a.emoji}</span><strong>{a.title}</strong><span className="muted">{a.text}</span></div>
          ))}
        </section>
      )}
    </>
  )
}

// The card leans toward the finger and a shine follows it.
function tilt(e) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  el.style.setProperty('--mx', `${x * 100}%`)
  el.style.setProperty('--my', `${y * 100}%`)
  el.style.transform = `perspective(700px) rotateY(${(x - 0.5) * 14}deg) rotateX(${(0.5 - y) * 14}deg)`
}

function untilt(e) {
  e.currentTarget.style.transform = ''
}

function CardPhoto({ player }) {
  const photo = usePhoto(player)
  return (
    <div className="fut-photo">
      {photo ? <img src={photo} alt="" /> : <span className="fut-emoji">{player.emoji || '⚽'}</span>}
    </div>
  )
}
