import { useEffect, useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { gameLabel, nextGameDay } from '../lib/dates'
import { play } from '../lib/sound'
import { setGroupLanguage, t } from '../i18n'
import { applyTeamColors } from '../lib/teamColors'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'

// "Who's coming?" from the group's link, for groups that allow it (options.quick_signup):
// tap your name and you're on the list. No personal link, no joining, no password.
// The phone remembers whom it signed up, and only that name can be taken off again from here
// (anyone with the link could otherwise empty the list); everything else is in the app.
const MINE = (groupId) => `quick-me:${groupId}`
const readMine = (groupId) => {
  try {
    return localStorage.getItem(MINE(groupId))
  } catch {
    return null
  }
}
const writeMine = (groupId, id) => {
  try {
    if (id) localStorage.setItem(MINE(groupId), id)
    else localStorage.removeItem(MINE(groupId))
  } catch {
    // private mode: this visit only
  }
}

export default function QuickSignup({ joinCode = '' }) {
  const { data, error, reload } = useLoad(async () => {
    const preview = await api.groupPreview(joinCode)
    if (!preview) return { missing: true }
    const day = nextGameDay(new Date(), preview)
    const roster = await api.quickRoster(joinCode, day)
    return { preview, day, roster }
  }, [joinCode])
  const [mine, setMine] = useState(null)
  const [busy, setBusy] = useState(null)
  const [failed, setFailed] = useState(false)

  const groupId = data?.roster?.id
  useEffect(() => {
    if (!groupId) return
    setMine(readMine(groupId))
    applyTeamColors(data.roster.options)
    if (data.roster.options?.lang) setGroupLanguage(data.roster.options.lang)
    // Live: someone else taps in, the list here updates too.
    return api.subscribe(() => reload(), groupId)
  }, [groupId])

  if (error && !data) return <main className="page"><p className="err center">{t('common.offline')}</p></main>
  if (!data) return <main className="page"><p className="center muted">{t('common.loading')}</p></main>

  const join = `#/join/${joinCode}`
  if (data.missing) {
    return (
      <main className="page">
        <PageHeader title={t('onboarding.quick.title')} back="#/" />
        <p className="err">{t('onboarding.errors.invalidJoinCode')}</p>
      </main>
    )
  }
  if (!data.roster) {
    return (
      <main className="page">
        <PageHeader title={data.preview.name} back="#/" />
        <div className="card stack">
          <p>{t('onboarding.quick.off')}</p>
          <a className="btn big" href={join}>{t('onboarding.quick.joinInstead')}</a>
        </div>
      </main>
    )
  }

  const { roster, day } = data
  const coming = new Set(roster.coming)
  const when = gameLabel(day, roster)

  const tap = async (p) => {
    const isIn = coming.has(p.id)
    if (isIn && p.id !== mine) return // someone else's name: only they take it off
    setBusy(p.id)
    setFailed(false)
    try {
      await api.quickSignup(joinCode, p.id, day, !isIn)
      if (!isIn) {
        writeMine(roster.id, p.id)
        setMine(p.id)
        play('pop')
      } else {
        writeMine(roster.id, null)
        setMine(null)
      }
      await reload()
    } catch {
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="page">
      <PageHeader title={t('onboarding.quick.title')} sub={t('onboarding.quick.sub', { group: roster.name, when })} />
      {roster.cancelled ? (
        <div className="card empty"><strong>{t('onboarding.quick.cancelled')}</strong></div>
      ) : (
        <section className="card stack">
          <div className="signup-head">
            <strong>{mine && coming.has(mine) ? t('onboarding.quick.youreIn') : t('onboarding.quick.tap')}</strong>
            <span className="signup-count"><b>{coming.size}</b>/{roster.team_size * 2}</span>
          </div>
          <div className="attend-grid">
            {roster.players.map((p) => {
              const isIn = coming.has(p.id)
              const me = p.id === mine
              return (
                <button key={p.id} type="button" className={`attend${isIn ? ' on' : ''}${me ? ' me' : ''}`} aria-pressed={isIn}
                  disabled={busy !== null || (isIn && !me)} onClick={() => tap(p)}>
                  <Avatar player={{ ...p, photo: null }} size={44} />
                  <span>{p.name}</span>
                  {me && isIn && <small>{t('onboarding.quick.tapAgain')}</small>}
                </button>
              )
            })}
          </div>
          {failed && <p className="err">{t('common.failed')}</p>}
        </section>
      )}
      <a className="link-btn center" href={join}>{t('onboarding.quick.notListed')}</a>
    </main>
  )
}
