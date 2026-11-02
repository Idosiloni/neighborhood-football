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

export default function Me({ edit = false }) {
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
        <PageHeader title="אני" />
        {me === null && code && <p className="err">הקוד ששמור בטלפון כבר לא תקף. בקש ממנהל הקבוצה קישור חדש.</p>}
        <CodeForm onDone={(c, voter) => { setMyCode(c, voter.group); setCode(c) }} />
      </main>
    )
  }

  if (me === undefined) return <main className="page"><PageHeader title="אני" /><p className="center muted">טוען…</p></main>

  if (edit) {
    return (
      <main className="page">
        <PageHeader title="הפרופיל שלי" sub="מה שיופיע בכרטיס שלך" back="#/me" />
        {ready === false ? (
          <NeedsUpdate />
        ) : (
          <ProfileForm
            initial={{ emoji: '⚽', position: 'any', can_gk: false, nickname: '', ...me.player }}
            submitLabel="שמור פרופיל"
            onSubmit={async (f) => {
              try {
                await api.updateMyProfile(code, f)
              } catch {
                throw new Error('השמירה נכשלה. אולי התמונה גדולה מדי?')
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
        title={`היי ${me.name} 👋`}
        sub={`${me.group.name}${me.is_admin ? ' · מנהל 👑' : ''}`}
        action={<a className="btn small ghost" href="#/me/edit"><Icon name="camera" size={16} /> ערוך</a>}
      />
      {ready && me.player && !hasPhoto(me.player) && (
        <a className="card cta-card" href="#/me/edit">
          <div>
            <strong>📸 שים תמונה לכרטיס שלך</strong>
            <p className="muted">סלפי או מהגלריה, ועוד כינוי ועמדה.</p>
          </div>
          <Icon name="forward" />
        </a>
      )}
      {ready && <InviteButton />}
      {ready && <CardBody id={me.id} />}
      <a className="btn ghost" href={`#/v/${code}`}>🗳️ {me.ranking ? 'עדכן את הדירוג שלי' : 'דרג את השחקנים'}</a>
      {me.is_admin && <a className="btn ghost" href="#/admin"><Icon name="gear" size={18} /> ניהול הקבוצה</a>}
      <MyLink code={code} admin={me.is_admin} />
      <GroupSwitcher label="הקבוצות שלי" className="on-light" />
      <SoundToggle />
      <button
        className="link-btn"
        onClick={() => {
          if (!confirm(`לנתק את הטלפון הזה מ${me.group.name}? אפשר לחזור עם הקישור האישי שלך.`)) return
          forgetMyCode(code)
          window.location.hash = '#/'
          window.location.reload()
        }}
      >
        זה לא אני (נתק את הטלפון מהקבוצה)
      </button>
      <button
        className="link-btn danger"
        onClick={async () => {
          if (!confirm(`לעזוב את ${me.group.name}? לא תופיע יותר ברשימות ובדירוג, והקישור האישי שלך יפסיק לעבוד. המשחקים והגולים שלך נשארים בסטטיסטיקה, ומנהל יכול להחזיר אותך.`)) return
          try {
            await api.leaveGroup(code)
          } catch (err) {
            return alert(err.message?.includes('last admin') ? 'אתה המנהל היחיד. קודם הפוך שחקן אחר למנהל (ניהול → שחקנים).' : 'לא הצלחתי לעזוב. נסה שוב.')
          }
          forgetMyCode(code)
          window.location.hash = '#/'
          window.location.reload()
        }}
      >
        עזוב את הקבוצה
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
      else setError('הקוד לא נמצא.')
    } catch {
      setError('אין חיבור כרגע.')
    }
    setBusy(false)
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <strong>הקוד האישי שלך</strong>
      <p className="muted">
        את הקוד (או קישור אישי) מקבלים ממנהל הקבוצה. אם יש לך קישור, פשוט פתח אותו והטלפון יזכור אותך.
      </p>
      <input className="input code-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="3fa9c21b"
        autoCapitalize="off" autoCorrect="off" dir="ltr" aria-label="קוד אישי" />
      {error && <p className="err">{error}</p>}
      <button className="btn big" disabled={busy}>{busy ? 'בודק…' : 'המשך'}</button>
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
        🔊 צלילים (שריקות, קהל בגול)
      </label>
      {on && (
        <div className="field">
          צליל של גול (לחץ כדי לשמוע ולבחור)
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
