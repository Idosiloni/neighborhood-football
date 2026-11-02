import { useState } from 'react'
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

const ERRORS = {
  'already claimed': 'מישהו כבר נרשם בשם הזה. אם זה אתה, בקש ממנהל הקבוצה את הקישור האישי שלך.',
  'name taken': 'יש כבר שחקן בשם הזה. אם זה אתה, חזור לרשימה ובחר אותו. אם לא, הוסף משהו לשם (למשל אות של שם משפחה).',
  'invalid join code': 'קישור ההצטרפות הזה כבר לא תקף. בקש ממנהל הקבוצה קישור חדש.',
  'name required': 'צריך שם.',
  'too many players': 'הקבוצה מלאה.',
}
const friendly = (err) => {
  const key = Object.keys(ERRORS).find((k) => err.message?.includes(k))
  return new Error(key ? ERRORS[key] : 'משהו השתבש. נסה שוב.')
}

// Opened from the group's join link. Regulars the admin already added pick their own name;
// anyone else signs up with a new name. Afterwards the phone remembers him and he ranks the players.
export default function Join({ joinCode = '' }) {
  if (!joinCode) return <JoinCodeForm />
  return <JoinWithCode joinCode={joinCode} />
}

// Typed in by hand: the group's join code (6 letters/digits; older groups have 4 digits).
function JoinCodeForm() {
  const [value, setValue] = useState('')
  return (
    <main className="page">
      <PageHeader title="הצטרפות לקבוצה" sub="את הקוד מקבלים ממנהל הקבוצה או מחבר בקבוצה" back="#/" />
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.length >= 4) go(`/join/${value}`)
        }}
      >
        <input className="input code-input" value={value} onChange={(e) => setValue(e.target.value.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8))}
          autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="ab3k9m" dir="ltr" aria-label="קוד הצטרפות" autoFocus />
        <button className="btn big" disabled={value.length < 4}>המשך</button>
      </form>
    </main>
  )
}

function JoinWithCode({ joinCode }) {
  const ready = useSchemaReady()
  const { data, error } = useLoad(async () => ({ group: await api.groupPreview(joinCode) }), [joinCode])
  const [picked, setPicked] = useState(undefined) // undefined: choosing, null: new name, player: claiming

  const done = (myCode) => {
    setMyCode(myCode, data.group)
    forgetSchedule() // the new group's day and rules, not whatever was loaded before
    go('/hello') // welcome, then rank the players
  }

  if (ready === false) {
    return (
      <main className="page">
        <PageHeader title="הצטרפות" />
        <NeedsUpdate />
      </main>
    )
  }
  if (error && !data) return <main className="page"><PageHeader title="הצטרפות" back="#/" /><p className="err center">אין חיבור כרגע. נסה שוב עוד רגע.</p></main>
  if (!data) return <main className="page"><PageHeader title="הצטרפות" /><p className="center muted">טוען…</p></main>

  if (!data.group) {
    return (
      <main className="page">
        <PageHeader title="הצטרפות" back="#/join" />
        <div className="card empty">
          <div className="empty-emoji">🤔</div>
          <strong>לא מצאתי קבוצה עם הקוד הזה</strong>
          <p className="muted">אולי הוקלד לא נכון, או שמנהל הקבוצה החליף את הקישור. בקש ממנו קישור חדש.</p>
          <a className="btn" href="#/join">לנסות קוד אחר</a>
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
          <strong>הטלפון הזה כבר בקבוצה</strong>
          <button className="btn" onClick={() => openGroup(already.code)}>לקבוצה</button>
        </div>
      </main>
    )
  }

  const open = data.group.open

  if (picked === undefined && open.length > 0) {
    return (
      <main className="page">
        <PageHeader title={`ברוך הבא ל${data.group.name}`} sub="פעם אחת נרשמים, ואז הטלפון זוכר אותך" />
        <section className="stack">
          <h2 className="section-title">אתה ברשימה? בחר את השם שלך</h2>
          <div className="name-grid">
            {open.map((p) => (
              <button key={p.id} className="name-pick" onClick={() => setPicked(p)}>
                <Avatar player={p} size={40} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </section>
        <button className="btn ghost big" onClick={() => setPicked(null)}>אני לא ברשימה, הרשמה חדשה</button>
      </main>
    )
  }

  if (picked) {
    return (
      <main className="page">
        <PageHeader title={`היי ${picked.name}!`} sub="עוד רגע: תמונה, עמדה וכינוי" />
        <ProfileForm
          initial={{ emoji: '⚽', photo: null, position: 'any', can_gk: false, nickname: '', ...picked }}
          submitLabel="זה אני, המשך ⚽"
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
        <button className="link-btn" onClick={() => setPicked(undefined)}>זה לא אני, חזרה לרשימה</button>
      </main>
    )
  }

  const openNames = new Map(open.map((p) => [normalizeName(p.name), p]))

  return (
    <main className="page">
      <PageHeader title="הרשמה חדשה" sub={`מצטרפים ל${data.group.name}. ממלאים פעם אחת, ואז הטלפון זוכר אותך`} />
      <ProfileForm
        withName
        initial={{ name: '', emoji: '⚽', photo: null, position: 'any', can_gk: false, nickname: '' }}
        submitLabel="הצטרף ⚽"
        onSubmit={async (f) => {
          if (openNames.has(normalizeName(f.name))) {
            throw new Error('השם הזה כבר ברשימה. חזור לרשימה ובחר אותו שם.')
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
      {open.length > 0 && <button className="link-btn" onClick={() => setPicked(undefined)}>חזרה לרשימת השמות</button>}
    </main>
  )
}
