import { myGroups, openGroup } from '../lib/identity'
import Icon from '../components/Icon'
import InstallHint from '../components/InstallHint'
import { t, tl, tx } from '../i18n'

// First screen on a phone that isn't in a group (yet): open a new group, or join one.
export default function Welcome({ invalid = false }) {
  const others = myGroups()
  const [title1, title2] = tl('onboarding.welcome.title')
  const step = (n) => tx(`onboarding.welcome.step${n}`, { b: <b>{t(`onboarding.welcome.step${n}b`)}</b> })

  return (
    <main className="page home">
      <header className="hero">
        <div className="hero-pitch" aria-hidden="true" />
        {/* A long word ("Neighborhood") gets the smaller title size so it fits the screen. */}
        <h1 className={Math.max(title1.length, title2.length) > 8 ? 'long' : ''}>{title1}<br />{title2}</h1>
        <p>{t('onboarding.welcome.tagline')}</p>
      </header>

      {invalid && <p className="note">{t('onboarding.welcome.invalid')}</p>}

      {others.length > 0 && (
        <section className="stack">
          <h2 className="section-title">{t('onboarding.welcome.myGroups')}</h2>
          {others.map((g) => (
            <button key={g.code} className="card cta-card" onClick={() => openGroup(g.code)}>
              <strong>⚽ {g.name}</strong>
              <Icon name="forward" />
            </button>
          ))}
        </section>
      )}

      <a className="card cta-card" href="#/join">
        <div>
          <strong>{t('onboarding.welcome.haveCode')}</strong>
          <p className="muted">{t('onboarding.welcome.haveCodeHint')}</p>
        </div>
        <Icon name="forward" />
      </a>

      <a className="card cta-card" href="#/new">
        <div>
          <strong>{t('onboarding.welcome.newGroup')}</strong>
          <p className="muted">{t('onboarding.welcome.newGroupHint')}</p>
        </div>
        <Icon name="forward" />
      </a>

      <section className="card stack how-it-works">
        <h2>{t('onboarding.welcome.howTitle')}</h2>
        <ol className="steps">
          <li>{step(1)}</li>
          <li>{step(2)}</li>
          <li>{step(3)}</li>
        </ol>
      </section>

      <a className="admin-entry" href="#/vote">{t('onboarding.welcome.personalCode')}</a>
      <InstallHint />
    </main>
  )
}
