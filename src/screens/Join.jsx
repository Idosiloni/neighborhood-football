import { useEffect, useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { myGroups, openGroup, setMyCode } from '../lib/identity'
import { useSchemaReady } from '../lib/schema'
import { normalizeName } from '../lib/parseList'
import { go } from '../lib/router'
import { forgetSchedule } from '../lib/schedule'
import PageHeader from '../components/PageHeader'
import ProfileForm from '../components/ProfileForm'
import NeedsUpdate from '../components/NeedsUpdate'
import Avatar from '../components/Avatar'
import { t, setGroupLanguage } from '../i18n'
import Loading from '../components/Loading'

// The server's error keys and their texts (onboarding.errors.*).
const ERRORS = {
  'already claimed': 'alreadyClaimed',
  'name taken': 'nameTaken',
  'invalid join code': 'invalidJoinCode',
  'name required': 'nameRequired',
  'too many players': 'groupFull',
}
const friendly = (err) => {
  const key = Object.keys(ERRORS).find((k) => err.message?.includes(k))
  return new Error(key ? t(`onboarding.errors.${ERRORS[key]}`) : t('common.failed'))
}

// Opened from the group's join link. Regulars the admin already added pick their own name;
// anyone else signs up with a new name. Afterwards the phone remembers him and he ranks the players.
export default function Join({ joinCode = '' }) {
  if (!joinCode) return <JoinCodeForm />
  return <JoinWithCode joinCode={joinCode} />
}

// Typed in by hand: the group's join code (6 letters/digits; older groups have 4 digits),
// or a personal code (8), which opens that player's group on this phone too.
function JoinCodeForm() {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <main className="page">
      <PageHeader title={t('onboarding.join.title')} sub={t('onboarding.join.codeSub')} back="#/" />
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (value.length < 4) return
          if (value.length === 8) {
            setBusy(true)
            const voter = await api.getVoter(value).catch(() => null)
            setBusy(false)
            if (voter) return go(`/v/${value}`)
          }
          go(`/join/${value}`)
        }}
      >
        <input className="input code-input" value={value} onChange={(e) => setValue(e.target.value.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8))}
          autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="ab3k9m" dir="ltr" aria-label={t('onboarding.join.codeLabel')} autoFocus />
        <button className="btn big" disabled={value.length < 4 || busy}>{t('common.continue')}</button>
        <small className="muted">{t('onboarding.join.personalToo')}</small>
      </form>
    </main>
  )
}

function JoinWithCode({ joinCode }) {
  const ready = useSchemaReady()
  const { data, error } = useLoad(async () => ({ group: await api.groupPreview(joinCode) }), [joinCode])
  // Someone opening the group's link sees it in the group's language (unless this phone picked one).
  const lang = data?.group?.lang
  useEffect(() => {
    if (lang) setGroupLanguage(lang)
  }, [lang])
  const [picked, setPicked] = useState(undefined) // undefined: choosing, null: new name, player: claiming

  const done = (myCode) => {
    setMyCode(myCode, data.group)
    forgetSchedule() // the new group's day and rules, not whatever was loaded before
    go('/hello') // welcome, then rank the players
  }

  if (ready === false) {
    return (
      <main className="page">
        <PageHeader title={t('onboarding.join.short')} />
        <NeedsUpdate />
      </main>
    )
  }
  if (error && !data) return <main className="page"><PageHeader title={t('onboarding.join.short')} back="#/" /><p className="err center">{t('common.offline')}</p></main>
  if (!data) return <main className="page"><PageHeader title={t('onboarding.join.short')} /><Loading /></main>

  if (!data.group) {
    return (
      <main className="page">
        <PageHeader title={t('onboarding.join.short')} back="#/join" />
        <div className="card empty">
          <div className="empty-emoji">🤔</div>
          <strong>{t('onboarding.join.notFound')}</strong>
          <p className="muted">{t('onboarding.join.notFoundHint')}</p>
          <a className="btn" href="#/join">{t('onboarding.join.tryAnother')}</a>
        </div>
      </main>
    )
  }

  const already = myGroups().find((g) => g.id === data.group.id)
  if (already) {
    return (
      <main className="page">
        <PageHeader title={data.group.name} />
        <div className="card empty">
          <div className="empty-emoji">✅</div>
          <strong>{t('onboarding.join.alreadyIn')}</strong>
          <button className="btn" onClick={() => openGroup(already.code)}>{t('onboarding.join.toGroup')}</button>
        </div>
      </main>
    )
  }

  const open = data.group.open

  if (picked === undefined && open.length > 0) {
    return (
      <main className="page">
        <PageHeader title={t('onboarding.join.welcome', { group: data.group.name })} sub={t('onboarding.join.welcomeSub')} />
        <section className="stack">
          <h2 className="section-title">{t('onboarding.join.pickName')}</h2>
          <div className="name-grid">
            {open.map((p) => (
              <button key={p.id} className="name-pick" onClick={() => setPicked(p)}>
                <Avatar player={p} size={40} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </section>
        <button className="btn ghost big" onClick={() => setPicked(null)}>{t('onboarding.join.notOnList')}</button>
      </main>
    )
  }

  if (picked) {
    return (
      <main className="page">
        <PageHeader title={t('onboarding.join.hi', { name: picked.name })} sub={t('onboarding.join.hiSub')} />
        <ProfileForm
          initial={{ emoji: '⚽', photo: null, position: 'any', can_gk: false, nickname: '', ...picked }}
          submitLabel={t('onboarding.join.itsMe')}
          onSubmit={async (f) => {
            let myCode
            try {
              myCode = await api.claimPlayer(joinCode, picked.id, f)
            } catch (err) {
              throw friendly(err)
            }
            done(myCode)
          }}
        />
        <button className="link-btn" onClick={() => setPicked(undefined)}>{t('onboarding.join.notMe')}</button>
      </main>
    )
  }

  const openNames = new Map(open.map((p) => [normalizeName(p.name), p]))

  return (
    <main className="page">
      <PageHeader title={t('onboarding.join.newTitle')} sub={t('onboarding.join.newSub', { group: data.group.name })} />
      <ProfileForm
        withName
        initial={{ name: '', emoji: '⚽', photo: null, position: 'any', can_gk: false, nickname: '' }}
        submitLabel={t('onboarding.join.submit')}
        onSubmit={async (f) => {
          if (openNames.has(normalizeName(f.name))) {
            throw new Error(t('onboarding.errors.nameOnList'))
          }
          let myCode
          try {
            myCode = await api.joinTeam(joinCode, f)
          } catch (err) {
            throw friendly(err)
          }
          done(myCode)
        }}
      />
      {open.length > 0 && <button className="link-btn" onClick={() => setPicked(undefined)}>{t('onboarding.join.backToNames')}</button>}
    </main>
  )
}
