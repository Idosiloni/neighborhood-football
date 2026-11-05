import { useEffect, useMemo, useState } from 'react'
import { drawCard, shareCard } from '../lib/cardImage'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { useSchemaReady } from '../lib/schema'
import { cardAttributes, computeAwards, computeStats, funTraits, headToHead, historyIn, milestones, nextTier, seasonPeriods, tagline, tierOf } from '../lib/stats'
import FormDots from '../components/FormDots'
import { fullCard, ratersRange } from '../lib/attributes'
import { isFresh, teamOfTheWeek } from '../lib/week'
import { rememberTier, wentUp } from '../lib/cardSeen'
import { today } from '../lib/dates'
import { getMyCode } from '../lib/identity'
import CardReveal from '../components/CardReveal'
import { optionsOf } from '../lib/options'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import NeedsUpdate from '../components/NeedsUpdate'
import { positionsOf, positionsText } from '../lib/positions'
import { usePhoto } from '../lib/photos'
import { t } from '../i18n'
import Loading from '../components/Loading'

export default function PlayerCard({ id }) {
  const ready = useSchemaReady()
  return (
    <main className="page">
      <PageHeader title={t('stats.card.title')} back="#/stats" />
      {ready === false ? <NeedsUpdate /> : ready ? <CardBody id={id} /> : <Loading />}
    </main>
  )
}

export function CardBody({ id }) {
  const { data } = useLoad(async () => {
    const [players, history, seasons, schedule] = await Promise.all([api.listPlayers(), api.getHistory(), api.listSeasons(), api.getSchedule()])
    // A group rating by categories: the published values for the cards.
    const cats = optionsOf(schedule).rating === 'attrs' ? await api.attrCards() : null
    const me = getMyCode() ? await api.getVoter(getMyCode()).catch(() => null) : null
    return { players, history, seasons, cats, schedule, meId: me?.id ?? null }
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
    // The full card: the player's categories (keepers-only: the goalkeeping ones) and the overall from them.
    const full = fullCard(data.cats, player, positionsOf(player))
    const opts = optionsOf(data.schedule)
    const week = teamOfTheWeek(data.players, data.history, { size: data.schedule?.team_size ?? 6, mvp: opts.mvp, assists: opts.assists })
    const inWeek = isFresh(week, today()) && week.team.some((x) => x.id === id)
    return { player, s: stats.byId[id], awards, h2h: headToHead(stats, id), now, full, opts, inWeek, mine: data.meId === id, byId: Object.fromEntries(data.players.map((p) => [p.id, p])) }
  }, [data, id])

  const [sharing, setSharing] = useState(false)
  const [reveal, setReveal] = useState(null) // { from, to } while the move up is shown

  const overallNow = view?.player ? (view.full?.overall ?? view.s.overall) : undefined
  const tierNow = overallNow === undefined ? null : tierOf(overallNow)
  // A card that went up since this phone last showed it opens with a reveal; then it is remembered.
  useEffect(() => {
    if (!tierNow) return
    if (wentUp(id, tierNow)) setReveal({ to: tierNow })
    rememberTier(id, tierNow)
  }, [id, tierNow])

  if (!view) return <Loading />
  if (!view.player) return <p className="center muted">{t('stats.card.notFound')}</p>

  const { player, s, awards, h2h, now, full, opts, inWeek, mine, byId } = view
  const marks = milestones(s)
  // With category ratings the card shows the categories, and their overall once every one is in.
  const overall = full?.overall ?? s.overall
  const tier = tierOf(overall)
  const next = nextTier(overall)
  const attrs = full
    ? full.keys.map((k) => ({ key: k, label: t(`stats.cats.${k}`), value: full.values[k] ?? '?' }))
    : cardAttributes(s, opts)
  const traits = funTraits(s, player)
  const card = <FutCard player={player} overall={overall} tier={tier} attrs={attrs} award={awards[0]} week={inWeek} />

  return (
    <>
      {reveal && (
        <CardReveal tier={reveal.to} mine={mine} name={player.name} onDone={() => setReveal(null)}>
          <FutCard player={player} overall={overall} tier={tier} attrs={attrs} award={awards[0]} />
        </CardReveal>
      )}
      {card}
      <p className="tier-line">
        {overall != null && <span className={`tier-chip ${tier}`}>{t(`stats.tiers.${tier}`)}</span>}
        {next && <span className="muted">{t('stats.tiers.toNext', { count: next.need, tier: t(`stats.tiers.${next.tier}`) })}</span>}
        {overall != null && !next && <span className="muted">{t('stats.tiers.top')}</span>}
      </p>
      <button
        className="btn ghost"
        disabled={sharing}
        onClick={async () => {
          setSharing(true)
          try {
            const blob = await drawCard({ player, overall, tier, attrs, traits, line: tagline(player) })
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
      {full && ratersRange(full.raters) && <p className="muted center small">{t('stats.fullCard.basedOn', { range: ratersRange(full.raters) })}</p>}
      {full && full.overall == null && <p className="muted center small">{t('stats.fullCard.missing')}</p>}
      {!full && s.overall == null && <p className="muted center small">{t('stats.card.ratingLater')}</p>}

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

// The card itself. week: in this week's Team of the Week (its own colors and a badge).
export function FutCard({ player, overall, tier, attrs, award, week = false }) {
  return (
    <div className={`fut-card ${tier}${week ? ' week' : ''}`} onPointerMove={tilt} onPointerLeave={untilt}>
      {week && <span className="fut-week">{t('stats.week.badge')}</span>}
      <div className="fut-top">
        <div className="fut-rating">
          <b>{overall ?? '?'}</b>
          <span>{positionsText(player, { short: true })}</span>
          {award && <span className="fut-side">{award.emoji}</span>}
        </div>
        <CardPhoto player={player} />
      </div>
      <div className="fut-name">{player.name}</div>
      {player.nickname && <div className="fut-nick">{t('stats.card.nickname', { name: player.nickname })}</div>}
      {!player.nickname && award && <div className="fut-nick">{award.title}</div>}
      <div className={`fut-attrs${attrs.length === 4 ? ' four' : ''}`}>
        {attrs.map((a) => (
          <div key={a.key}><b>{a.value}</b><span>{a.label}</span></div>
        ))}
      </div>
    </div>
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
