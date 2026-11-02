import { useMemo, useState } from 'react'
import { drawCard, shareCard } from '../lib/cardImage'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { useSchemaReady } from '../lib/schema'
import { cardAttributes, computeAwards, computeStats, funTraits, tagline } from '../lib/stats'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import NeedsUpdate from '../components/NeedsUpdate'
import { positionsText } from '../lib/positions'
import { usePhoto } from '../lib/photos'


export default function PlayerCard({ id }) {
  const ready = useSchemaReady()
  return (
    <main className="page">
      <PageHeader title="כרטיס שחקן" back="#/stats" />
      {ready === false ? <NeedsUpdate /> : ready ? <CardBody id={id} /> : <p className="center muted">טוען…</p>}
    </main>
  )
}

export function CardBody({ id }) {
  const { data } = useLoad(async () => {
    const [players, history] = await Promise.all([api.listPlayers(), api.getHistory()])
    return { players, history }
  }, [id])

  const view = useMemo(() => {
    if (!data) return null
    const player = data.players.find((p) => p.id === id)
    if (!player) return { player: null }
    const stats = computeStats(data.players, data.history.matches, data.history.goals, data.history.mvp)
    const awards = computeAwards(stats).filter((a) => a.ids.includes(id))
    return { player, s: stats.byId[id], awards }
  }, [data, id])

  const [sharing, setSharing] = useState(false)

  if (!view) return <p className="center muted">טוען…</p>
  if (!view.player) return <p className="center muted">השחקן לא נמצא.</p>

  const { player, s, awards } = view
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
        {player.nickname && <div className="fut-nick">״{player.nickname}״</div>}
        {!player.nickname && awards[0] && <div className="fut-nick">{awards[0].title}</div>}
        <div className="fut-attrs">
          {attrs.map((a) => (
            <div key={a.label}><b>{a.value}</b><span>{a.label}</span></div>
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
        {sharing ? 'מכין תמונה…' : '📤 שתף את הכרטיס'}
      </button>
      <p className="tagline">{tagline(player)}</p>
      {traits.length > 0 && (
        <div className="trait-row">
          {traits.map((t) => <span key={t.label} className="trait">{t.emoji} {t.label}</span>)}
        </div>
      )}
      {s.overall == null && <p className="muted center small">הדירוג על הכרטיס מופיע אחרי 3 משחקים. הוא מחושב רק מתוצאות המשחקים.</p>}

      {awards.length > 0 && (
        <section className="stack">
          <h2 className="section-title">התארים שלו</h2>
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
