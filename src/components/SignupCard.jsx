import { useState } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates, useTicker } from '../lib/hooks'
import { play } from '../lib/sound'
import { getMyCode } from '../lib/identity'
import { gameLabel, nextGameDay, today } from '../lib/dates'
import { useSchedule } from '../lib/schedule'
import Avatar from './Avatar'

// The weekly sign-up list (instead of the WhatsApp list): tap "I'm in", you're added at the end.
// On game day these sign-ups are the attendance, in this order.
export default function SignupCard() {
  const schedule = useSchedule()
  const day = nextGameDay(new Date(), schedule)
  const code = getMyCode()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data, reload } = useLoad(async () => {
    const [players, night, me] = await Promise.all([
      api.listPlayers(),
      api.getNight(day),
      code ? api.getVoter(code).catch(() => null) : null,
    ])
    const attendance = night ? await api.listAttendance(night.id) : []
    return { players, night, attendance, me }
  }, [day, code])
  useLiveUpdates(reload)

  if (!data) return null

  const byId = Object.fromEntries(data.players.map((p) => [p.id, p]))
  const list = data.attendance.map((a) => byId[a.player_id]).filter((p) => p?.active)
  const me = data.me
  const imIn = me && list.some((p) => p.id === me.id)
  const isToday = day === today()
  const full = schedule.team_size * 2

  if (data.night?.cancelled) {
    return (
      <section className="card signup cancelled">
        <span className="muted small">{isToday ? 'היום' : 'השבוע'}</span>
        <h2>אין משחק {gameLabel(day, schedule).split(',')[0]} 😴</h2>
        <p className="muted">נתראה בשבוע הבא.</p>
      </section>
    )
  }

  const toggle = async () => {
    setBusy(true)
    try {
      const night = data.night ?? (await api.ensureNight(day))
      await api.setPresent(night.id, me.id, !imIn)
      if (!imIn) play('pop')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const copyList = async () => {
    const text = [gameLabel(day, schedule).replace(',', ''), ...list.map((p, i) => `${i + 1}. ${p.name}`)].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="card signup">
      <div className="signup-head">
        <div>
          <span className="muted small">{isToday ? 'המשחק היום' : 'המשחק הקרוב'}</span>
          <h2>{gameLabel(day, schedule)}</h2>
        </div>
        <span className={`signup-count${list.length >= full ? ' full' : ''}`}>
          <b>{list.length}</b>/{full}
        </span>
      </div>
      <Countdown day={day} kickoff={schedule.kickoff} />

      {list.length === 0 ? (
        <p className="muted">עוד אף אחד לא נרשם. תהיה הראשון!</p>
      ) : (
        <ol className="signup-list">
          {list.map((p, i) => (
            <li key={p.id} className={`${i >= full ? 'extra' : ''}${me?.id === p.id ? ' me' : ''}`}>
              <span className="signup-num">{i + 1}</span>
              <Avatar player={p} size={26} />
              <span className="signup-name">{p.name}</span>
              {i === full && <span className="signup-tag">ממתינים</span>}
            </li>
          ))}
        </ol>
      )}

      {me ? (
        <button className={`btn big${imIn ? ' ghost' : ''}`} onClick={toggle} disabled={busy}>
          {busy ? '…' : imIn ? 'לא אוכל לבוא' : 'אני בא ✋'}
        </button>
      ) : (
        <a className="btn ghost" href="#/join">כדי להירשם למשחק, הצטרף לאפליקציה</a>
      )}
      {list.length > 0 && (
        <button className="link-btn" onClick={copyList}>{copied ? '✓ הרשימה הועתקה' : 'העתק את הרשימה לוואטסאפ'}</button>
      )}
    </section>
  )
}

// Days, hours, minutes and seconds to kick-off. Gone once the game has started.
function Countdown({ day, kickoff }) {
  useTicker(true, 1000)
  const [y, mo, d] = day.split('-').map(Number)
  const [h, mi] = kickoff.split(':').map(Number)
  const left = new Date(y, mo - 1, d, h, mi).getTime() - Date.now()
  if (left <= 0) return null
  const s = Math.floor(left / 1000)
  const parts = [
    [Math.floor(s / 86400), 'ימים'],
    [Math.floor((s % 86400) / 3600), 'שעות'],
    [Math.floor((s % 3600) / 60), 'דקות'],
    [s % 60, 'שניות'],
  ]
  return (
    <div className="countdown" aria-label="זמן עד המשחק">
      {parts.map(([n, label], i) => (i === 0 && n === 0 ? null : (
        <span key={label}><b>{String(n).padStart(2, '0')}</b><small>{label}</small></span>
      )))}
    </div>
  )
}
