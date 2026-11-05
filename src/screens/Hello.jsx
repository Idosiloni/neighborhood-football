import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { gameLabel, nextGameDay } from '../lib/dates'
import { useSchedule } from '../lib/schedule'
import { go } from '../lib/router'
import Avatar from '../components/Avatar'
import InstallHint from '../components/InstallHint'
import { rulesSummary } from '../components/GameSettings'
import { t, tx } from '../i18n'
import { optionsOf } from '../lib/options'

// Right after joining a group: what this group is, when it plays, and what to do first.
export default function Hello() {
  const code = getMyCode()
  const schedule = useSchedule()
  const { data } = useLoad(async () => {
    const [me, players] = await Promise.all([api.getVoter(code), api.listPlayers()])
    return { me, players }
  }, [code])

  if (!data?.me) return <main className="page"><p className="center muted">{t('common.loading')}</p></main>

  const { me, players } = data
  const meFull = players.find((p) => p.id === me.id) ?? me
  const others = players.filter((p) => p.active && p.id !== me.id).length
  const peers = optionsOf(schedule).rating === 'peers'
  const when = gameLabel(nextGameDay(new Date(), schedule), schedule)
  const step = (n) => tx(`onboarding.hello.step${n}`, { b: <b>{t(`onboarding.hello.step${n}b`)}</b> })

  return (
    <main className="page home">
      <header className="hero hello">
        <div className="hero-pitch" aria-hidden="true" />
        <Avatar player={meFull} size={84} />
        <h1 className="long">{t('onboarding.hello.title', { name: me.name })}</h1>
        <p>{t('onboarding.hello.inGroup', { group: me.group.name })}</p>
      </header>

      <section className="card stack">
        <span className="muted small">{t('onboarding.hello.next')}</span>
        <p className="big-day">{when}</p>
        {schedule.venue && <p>📍 {schedule.venue}</p>}
        <p className="muted small">{rulesSummary(schedule)}</p>
      </section>

      <h2 className="section-title">{t('onboarding.hello.whatNow')}</h2>
      <ol className="card steps hello-steps">
        <li>{step(1)}</li>
        <li>{step(2)}</li>
        <li>{step(3)}</li>
      </ol>

      {/* Ranking right away, unless the group doesn't rank (the admin rates, or nobody does). */}
      {others > 0 && peers ? (
        <button className="btn big" onClick={() => go(`/v/${code}`)}>{t('onboarding.hello.rankNow')}</button>
      ) : others === 0 ? (
        <p className="muted center">{t('onboarding.hello.noOne')}</p>
      ) : null}
      <button className={`btn big${others > 0 && peers ? ' ghost' : ''}`} onClick={() => go('/')}>{others > 0 && peers ? t('onboarding.hello.later') : t('onboarding.hello.home')}</button>
      <InstallHint />
    </main>
  )
}
