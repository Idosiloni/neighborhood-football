import { useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { forgetMyCode, getMyCode, setMyCode } from '../lib/identity'
import { useSchemaReady } from '../lib/schema'
import { go } from '../lib/router'
import PageHeader from '../components/PageHeader'
import ProfileForm from '../components/ProfileForm'
import NeedsUpdate from '../components/NeedsUpdate'
import Icon from '../components/Icon'
import { CardBody } from './PlayerCard'
import InviteButton from '../components/InviteButton'
import GroupSwitcher from '../components/GroupSwitcher'
import MyLink from '../components/MyLink'
import { hasPhoto } from '../lib/photos'
import { GOAL_SOUNDS, goalSound, preview, setGoalSound, setSoundOn, soundOn } from '../lib/sound'
import { LOCALES, pickedLocale, setLocale, t } from '../i18n'
import { setTextSize, TEXT_SIZES, textSize } from '../lib/textSize'
import { useOptions } from '../lib/schedule'

export default function Me({ edit = false }) {
  const opts = useOptions() // which features this group uses
  const [code, setCode] = useState(getMyCode)
  const ready = useSchemaReady()
  const { data: me } = useLoad(async () => {
    if (!code) return null
    const voter = await api.getVoter(code)
    if (!voter) return null
    const player = (await api.listPlayers()).find((p) => p.id === voter.id)
    return { ...voter, player }
  }, [code])

  if (!code || me === null) {
    return (
      <main className="page">
        <PageHeader title={t('onboarding.me.title')} />
        {me === null && code && <p className="err">{t('onboarding.me.invalid')}</p>}
        <CodeForm onDone={(c, voter) => { setMyCode(c, voter.group); setCode(c) }} />
      </main>
    )
  }

  if (me === undefined) return <main className="page"><PageHeader title={t('onboarding.me.title')} /><p className="center muted">{t('common.loading')}</p></main>

  if (edit) {
    return (
      <main className="page">
        <PageHeader title={t('onboarding.me.profileTitle')} sub={t('onboarding.me.profileSub')} back="#/me" />
        {ready === false ? (
          <NeedsUpdate />
        ) : (
          <ProfileForm
            initial={{ emoji: '⚽', position: 'any', can_gk: false, nickname: '', ...me.player }}
            submitLabel={t('onboarding.me.saveProfile')}
            onSubmit={async (f) => {
              try {
                await api.updateMyProfile(code, f)
              } catch {
                throw new Error(t('onboarding.me.saveFailed'))
              }
              go('/me')
            }}
          />
        )}
      </main>
    )
  }

  return (
    <main className="page">
      <PageHeader
        title={t('onboarding.me.hi', { name: me.name })}
        sub={me.is_admin ? t('onboarding.me.adminSub', { group: me.group.name }) : me.group.name}
        action={<a className="btn small ghost" href="#/me/edit"><Icon name="camera" size={16} /> {t('common.edit')}</a>}
      />
      {ready && me.player && !hasPhoto(me.player) && (
        <a className="card cta-card" href="#/me/edit">
          <div>
            <strong>{t('onboarding.me.addPhoto')}</strong>
            <p className="muted">{t('onboarding.me.addPhotoHint')}</p>
          </div>
          <Icon name="forward" />
        </a>
      )}
      {ready && <InviteButton />}
      {ready && <CardBody id={me.id} />}
      {opts.rating === 'peers' && <a className="btn ghost" href={`#/v/${code}`}>🗳️ {me.ranking ? t('onboarding.me.updateRanking') : t('onboarding.me.rank')}</a>}
      {me.is_admin && <a className="btn ghost" href="#/admin"><Icon name="gear" size={18} /> {t('onboarding.me.manage')}</a>}
      <MyLink code={code} admin={me.is_admin} />
      <GroupSwitcher label={t('onboarding.me.myGroups')} className="on-light" />
      <SoundToggle />
      <LanguagePicker />
      <TextSizePicker />
      <button
        className="link-btn"
        onClick={() => {
          if (!confirm(t('onboarding.me.disconnectConfirm', { group: me.group.name }))) return
          forgetMyCode(code)
          window.location.hash = '#/'
          window.location.reload()
        }}
      >
        {t('onboarding.me.disconnect')}
      </button>
      <button
        className="link-btn danger"
        onClick={async () => {
          if (!confirm(t('onboarding.me.leaveConfirm', { group: me.group.name }))) return
          try {
            await api.leaveGroup(code)
          } catch (err) {
            return alert(err.message?.includes('last admin') ? t('onboarding.me.lastAdmin') : t('onboarding.me.leaveFailed'))
          }
          forgetMyCode(code)
          window.location.hash = '#/'
          window.location.reload()
        }}
      >
        {t('onboarding.me.leave')}
      </button>
    </main>
  )
}

export function CodeForm({ onDone }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const c = value.trim().toLowerCase()
    if (!c) return
    setBusy(true)
    setError('')
    try {
      const voter = await api.getVoter(c)
      if (voter) onDone(c, voter)
      else setError(t('onboarding.code.notFound'))
    } catch {
      setError(t('onboarding.code.offline'))
    }
    setBusy(false)
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <strong>{t('onboarding.code.title')}</strong>
      <p className="muted">{t('onboarding.code.hint')}</p>
      <input className="input code-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="3fa9c21b"
        autoCapitalize="off" autoCorrect="off" dir="ltr" aria-label={t('onboarding.code.label')} />
      {error && <p className="err">{error}</p>}
      <button className="btn big" disabled={busy}>{busy ? t('onboarding.code.checking') : t('common.continue')}</button>
    </form>
  )
}

// His personal link: the way back in from a new phone. For an admin, it is also the key to managing the group.

// Whistles, the crowd on a goal and the last-seconds beeps, on this phone.
function SoundToggle() {
  const [on, setOn] = useState(soundOn)
  const [goal, setGoal] = useState(goalSound)
  return (
    <div className="card stack">
      <label className="check">
        <input type="checkbox" checked={on} onChange={(e) => { setSoundOn(e.target.checked); setOn(e.target.checked) }} />
        {t('onboarding.me.sounds')}
      </label>
      {on && (
        <div className="field">
          {t('onboarding.me.goalSound')}
          <div className="chips">
            {GOAL_SOUNDS.map((g) => (
              <button type="button" key={g.id} className={goal === g.id ? 'on' : ''} aria-pressed={goal === g.id}
                onClick={() => { setGoalSound(g.id); setGoal(g.id); preview(g.id) }}>{g.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// The app's language on this phone: automatic (the group's / the phone's), or a fixed one.
// Picking one re-renders the whole app (App remounts on the locale).
// Bigger text for anyone who finds it hard to read (per phone).
function TextSizePicker() {
  const [size, setSize] = useState(textSize)
  return (
    <div className="card stack">
      <div className="field">
        {t('onboarding.me.textSize')}
        <div className="chips">
          {TEXT_SIZES.map((s) => (
            <button type="button" key={s} className={size === s ? 'on' : ''} aria-pressed={size === s}
              onClick={() => { setSize(s); setTextSize(s) }}>{t(`onboarding.me.textSizes.${s}`)}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function LanguagePicker() {
  const [picked, setPicked] = useState(pickedLocale)
  const options = [{ id: null, label: t('common.languageAuto') }, ...LOCALES]
  return (
    <div className="card stack">
      <div className="field">
        {t('common.language')}
        <div className="chips">
          {options.map((l) => (
            <button type="button" key={l.id ?? 'auto'} lang={l.id ?? undefined} className={picked === l.id ? 'on' : ''} aria-pressed={picked === l.id}
              onClick={() => { setPicked(l.id); setLocale(l.id) }}>{l.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
