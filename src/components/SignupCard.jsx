import { useRef, useState } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates, usePendingToggles, useTicker } from '../lib/hooks'
import { play } from '../lib/sound'
import { getMyCode } from '../lib/identity'
import { gameLabel, nextGameDay, today } from '../lib/dates'
import { useOptions, useSchedule } from '../lib/schedule'
import Avatar from './Avatar'
import GameLinks from './GameLinks'
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

  // "I'm in" shows at once and is saved behind the scenes; quick taps send only the last choice.
  const latest = useRef(null)
  const making = useRef(null)
  latest.current = data
  const { pending, set, failed } = usePendingToggles(async (playerId, want) => {
    // Several quick taps on a day with no list yet: the list is made once, not once per tap.
    if (!latest.current?.night && !making.current) making.current = api.ensureNight(day).finally(() => (making.current = null))
    const night = latest.current?.night ?? (await making.current)
    await api.setPresent(night.id, playerId, want)
  }, reload)

  if (!data) return null

  const byId = Object.fromEntries(data.players.map((p) => [p.id, p]))
  const me = data.me
  let list = data.attendance.map((a) => byId[a.player_id]).filter((p) => p?.active)
  // What this phone just tapped, until the server has it.
  if (me && me.id in pending) {
    const there = list.some((p) => p.id === me.id)
    if (pending[me.id] && !there && byId[me.id]) list = [...list, byId[me.id]]
    if (!pending[me.id] && there) list = list.filter((p) => p.id !== me.id)
  }
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

  const toggle = () => {
    if (!imIn) play('pop')
    set(me.id, !imIn)
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
          {list.length > 0 && list.length < full && <span className="muted small">{t('home.signup.missing', { count: full - list.length })}</span>}
        </div>
        <span className={`signup-count${list.length >= full ? ' full' : ''}`}>
          <b>{list.length}</b>/{full}
        </span>
      </div>
      <GameLinks day={day} schedule={schedule} groupName={me?.group?.name} />
      <Countdown day={day} kickoff={schedule.kickoff} />
      {/* Above the list, so it stays put when the list grows. */}
      {me ? (
        <button className={`btn big signup-btn${imIn ? ' ghost' : ''}`} onClick={toggle} aria-pressed={Boolean(imIn)}>
          {imIn ? t('home.signup.out') : t('home.signup.in')}
        </button>
      ) : (
        <a className="btn ghost" href="#/join">{t('home.signup.joinFirst')}</a>
      )}
      {failed && <p className="err small">{t('common.failed')}</p>}

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
