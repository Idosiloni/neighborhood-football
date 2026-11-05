import { useState } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates, useTicker } from '../lib/hooks'
import { play } from '../lib/sound'
import { getMyCode } from '../lib/identity'
import { gameLabel, nextGameDay, today } from '../lib/dates'
import { useOptions, useSchedule } from '../lib/schedule'
import Avatar from './Avatar'
import { dayName, formatKickoff, shortDate, t } from '../i18n'

// The weekday and short date of a 'YYYY-MM-DD' day, in the current language.
function dayParts(day) {
  const [y, m, d] = day.split('-').map(Number)
  return { day: dayName(new Date(y, m - 1, d).getDay()), date: shortDate(m, d) }
}

// The weekly sign-up list (instead of the WhatsApp list): tap "I'm in", you're added at the end.
// On game day these sign-ups are the attendance, in this order.
export default function SignupCard() {
  const schedule = useSchedule()
  const opts = useOptions()
  const day = nextGameDay(new Date(), schedule)
  const code = getMyCode()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data, reload } = useLoad(async () => {
    const [players, night, me, joinCode] = await Promise.all([
      api.listPlayers(),
      api.getNight(day),
      code ? api.getVoter(code).catch(() => null) : null,
      api.getJoinCode().catch(() => null),
    ])
    const attendance = night ? await api.listAttendance(night.id) : []
    return { players, night, attendance, me, joinCode }
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
        <span className="muted small">{isToday ? t('home.signup.today') : t('home.signup.thisWeek')}</span>
        <h2>{t('home.signup.noGame', dayParts(day))}</h2>
        <p className="muted">{t('home.signup.seeYou')}</p>
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

  // "Who's coming?" for the group's WhatsApp: with one-tap sign-up, a link that needs nothing;
  // otherwise the app (everyone signs up with their personal link).
  const askMessage = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const lines = [t('home.signup.askHeader', { when: gameLabel(day, schedule) })]
    if (list.length) lines.push(t('home.signup.askSoFar', { count: list.length }))
    lines.push(opts.quick_signup ? t('home.signup.askQuick', { link: `${base}#/in/${data.joinCode}` }) : t('home.signup.askApp', { link: base }))
    return lines.join('\n')
  }

  const copyList = async () => {
    const header = t('home.signup.listHeader', { ...dayParts(day), time: formatKickoff(schedule.kickoff) })
    const text = [header, ...list.map((p, i) => `${i + 1}. ${p.name}`)].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="card signup">
      <div className="signup-head">
        <div>
          <span className="muted small">{isToday ? t('home.signup.nextToday') : t('home.signup.next')}</span>
          <h2>{gameLabel(day, schedule)}</h2>
        </div>
        <span className={`signup-count${list.length >= full ? ' full' : ''}`}>
          <b>{list.length}</b>/{full}
        </span>
      </div>
      <Countdown day={day} kickoff={schedule.kickoff} />

      {list.length === 0 ? (
        <p className="muted">{t('home.signup.empty')}</p>
      ) : (
        <ol className="signup-list">
          {list.map((p, i) => (
            <li key={p.id} className={`${i >= full ? 'extra' : ''}${me?.id === p.id ? ' me' : ''}`}>
              <span className="signup-num">{i + 1}</span>
              <Avatar player={p} size={26} />
              <span className="signup-name">{p.name}</span>
              {i === full && <span className="signup-tag">{t('home.signup.waiting')}</span>}
            </li>
          ))}
        </ol>
      )}

      {me ? (
        <button className={`btn big${imIn ? ' ghost' : ''}`} onClick={toggle} disabled={busy}>
          {busy ? '…' : imIn ? t('home.signup.out') : t('home.signup.in')}
        </button>
      ) : (
        <a className="btn ghost" href="#/join">{t('home.signup.joinFirst')}</a>
      )}
      {me && data.joinCode && (
        <a className="btn small wa" href={`https://wa.me/?text=${encodeURIComponent(askMessage())}`} target="_blank" rel="noreferrer">
          📣 {t('home.signup.ask')}
        </a>
      )}
      {list.length > 0 && (
        <button className="link-btn" onClick={copyList}>{copied ? t('home.signup.copied') : t('home.signup.copy')}</button>
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
    [Math.floor(s / 86400), 'days'],
    [Math.floor((s % 86400) / 3600), 'hours'],
    [Math.floor((s % 3600) / 60), 'minutes'],
    [s % 60, 'seconds'],
  ]
  return (
    <div className="countdown" aria-label={t('home.signup.countdown')}>
      {parts.map(([n, unit], i) => (i === 0 && n === 0 ? null : (
        <span key={unit}><b>{String(n).padStart(2, '0')}</b><small>{t(`home.signup.units.${unit}`)}</small></span>
      )))}
    </div>
  )
}
