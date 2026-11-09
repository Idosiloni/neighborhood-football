import { useState } from 'react'
import { api } from '../data'
import { GAME } from '../lib/dates'
import { dayName, formatKickoff, language, t, tl } from '../i18n'
import { openGroup, setMyCode } from '../lib/identity'
import { cleanOptions, optionsOf } from '../lib/options'
import PageHeader from '../components/PageHeader'
import ProfileForm from '../components/ProfileForm'
import InviteCard from '../components/InviteCard'
import MyLink from '../components/MyLink'
import { LevelFields, RulesFields, rulesSummary, WhenFields } from '../components/GameSettings'

// The server's error keys and their texts (onboarding.create.errors.*).
const ERRORS = {
  'group name required': 'groupNameRequired',
  'name required': 'nameRequired',
  'invalid settings': 'invalidSettings',
}

// Opening a new group, one step at a time: its name, when and where they play, the game rules,
// and the organizer's own profile. He becomes its first player and admin. Every step but the
// name comes filled in, so "Continue" all the way works too.
export default function CreateGroup() {
  const [step, setStep] = useState(0)
  const [groupName, setGroupName] = useState('')
  const [settings, setSettings] = useState({ ...GAME, venue: '' })
  const [created, setCreated] = useState(null) // { code, group }

  if (created) return <Ready {...created} settings={settings} />

  const back = step === 0 ? '#/' : null
  const steps = tl('onboarding.create.steps')
  const next = (e) => {
    e?.preventDefault()
    setStep(step + 1)
    window.scrollTo(0, 0)
  }

  return (
    <main className="page">
      <PageHeader title={t('onboarding.create.title')} sub={step === 0 ? t('onboarding.create.sub') : groupName} back={back} />
      <ol className="wizard" aria-label={t('onboarding.create.stepsLabel')}>
        {steps.map((label, i) => (
          <li key={label} className={i === step ? 'now' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span>{i < step ? '✓' : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <form className="stack" onSubmit={next}>
          <label className="field">
            {t('onboarding.create.nameLabel')}
            <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('onboarding.create.namePlaceholder')} maxLength={40} autoFocus />
          </label>
          <h2 className="section-title">{t('onboarding.create.whenTitle')}</h2>
          <WhenFields value={settings} onChange={setSettings} />
          <p className="muted small">{t('onboarding.create.whenHint')}</p>
          <details className="more-profile">
            <summary>{t('onboarding.create.rulesTitle')}</summary>
            <div className="stack">
              <LevelFields value={optionsOf(settings)} onChange={(fields) => setSettings({ ...settings, options: { ...optionsOf(settings), ...fields } })} />
              <RulesFields value={settings} onChange={setSettings} />
            </div>
          </details>
          <button className="btn big" disabled={!groupName.trim()}>{t('common.continue')}</button>
        </form>
      )}

      {step === 1 && (
        <>
          <h2 className="section-title">{t('onboarding.create.meTitle')}</h2>
          <ProfileForm
            withName
            compact
            initial={{ name: '', emoji: '⚽', photo: null, positions: [], nickname: '' }}
            submitLabel={t('onboarding.create.submit')}
            onSubmit={async (f) => {
              let code
              try {
                code = await api.createGroup(groupName, f, { ...settings, venue: settings.venue.trim() || null, options: { ...cleanOptions(settings.options), lang: language() } })
              } catch (err) {
                const key = Object.keys(ERRORS).find((k) => err.message?.includes(k))
                throw new Error(key ? t(`onboarding.create.errors.${ERRORS[key]}`) : t('common.failed'))
              }
              // Saved at once: the group exists now, and this code is the only way to manage it.
              setMyCode(code)
              const me = await api.getVoter(code).catch(() => null)
              if (me) setMyCode(code, me.group)
              setCreated({ code, group: me?.group ?? { name: groupName.trim() } })
              window.scrollTo(0, 0)
            }}
          />
          <button className="link-btn" onClick={() => setStep(0)}>{t('common.back')}</button>
        </>
      )}
    </main>
  )
}

// Right after opening: invite the players, and keep the admin link safe.
function Ready({ code, group, settings }) {
  const venue = settings.venue.trim()
  const when = t(venue ? 'onboarding.create.everyAt' : 'onboarding.create.every', {
    day: dayName(settings.weekday),
    time: formatKickoff(settings.kickoff),
    venue,
  })
  return (
    <main className="page">
      <div className="card empty ready-card">
        <div className="empty-emoji">🎉</div>
        <h1>{t('onboarding.create.ready', { name: group.name })}</h1>
        <p>{when}</p>
        <p className="muted small">{rulesSummary(settings)}</p>
      </div>

      <h2 className="section-title">{t('onboarding.create.inviteTitle')}</h2>
      <InviteCard />

      <h2 className="section-title">{t('onboarding.create.linkTitle')}</h2>
      <MyLink code={code} admin />

      <button className="btn big" onClick={() => openGroup(code)}>{t('onboarding.create.toGroup')}</button>
      <p className="muted small center">{t('onboarding.create.changeLater')}</p>
    </main>
  )
}
