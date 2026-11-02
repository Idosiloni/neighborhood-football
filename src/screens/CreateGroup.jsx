import { useState } from 'react'
import { api } from '../data'
import { DAY_NAMES, GAME } from '../lib/dates'
import { openGroup, setMyCode } from '../lib/identity'
import PageHeader from '../components/PageHeader'
import ProfileForm from '../components/ProfileForm'
import InviteCard from '../components/InviteCard'
import MyLink from '../components/MyLink'
import { RulesFields, rulesSummary, WhenFields } from '../components/GameSettings'

const ERRORS = {
  'group name required': 'צריך שם לקבוצה (עד 40 תווים).',
  'name required': 'צריך את השם שלך (עד 30 תווים).',
  'invalid settings': 'משהו בהגדרות לא תקין. חזור אחורה ובדוק את היום, השעה והחוקים.',
}

const STEPS = ['שם', 'מתי', 'חוקים', 'אתה']

// Opening a new group, one step at a time: its name, when and where they play, the game rules,
// and the organizer's own profile. He becomes its first player and admin. Every step but the
// name comes filled in, so "המשך" all the way works too.
export default function CreateGroup() {
  const [step, setStep] = useState(0)
  const [groupName, setGroupName] = useState('')
  const [settings, setSettings] = useState({ ...GAME, venue: '' })
  const [created, setCreated] = useState(null) // { code, group }

  if (created) return <Ready {...created} settings={settings} />

  const back = step === 0 ? '#/' : null
  const next = (e) => {
    e?.preventDefault()
    setStep(step + 1)
    window.scrollTo(0, 0)
  }

  return (
    <main className="page">
      <PageHeader title="פתיחת קבוצה חדשה" sub={step === 0 ? 'אתה תהיה המנהל: מזמין שחקנים, רואה את הדירוג וקובע מתי משחקים' : groupName} back={back} />
      <ol className="wizard" aria-label="שלבים">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'now' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span>{i < step ? '✓' : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <form className="stack" onSubmit={next}>
          <label className="field">
            איך קוראים לקבוצה?
            <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)}
              placeholder="למשל: כדורגל שישי בפארק" maxLength={40} autoFocus />
          </label>
          <button className="btn big" disabled={!groupName.trim()}>המשך</button>
        </form>
      )}

      {step === 1 && (
        <form className="stack" onSubmit={next}>
          <h2 className="section-title">מתי ואיפה משחקים?</h2>
          <WhenFields value={settings} onChange={setSettings} />
          <p className="muted small">כל שבוע ביום הזה נפתחת רשימת הרשמה, וביום המשחק היא הופכת לרשימת הנוכחים.</p>
          <StepButtons onBack={() => setStep(0)} />
        </form>
      )}

      {step === 2 && (
        <form className="stack" onSubmit={next}>
          <h2 className="section-title">איך משחקים?</h2>
          <RulesFields value={settings} onChange={setSettings} />
          <StepButtons onBack={() => setStep(1)} />
        </form>
      )}

      {step === 3 && (
        <>
          <h2 className="section-title">ועכשיו אתה</h2>
          <ProfileForm
            withName
            initial={{ name: '', emoji: '⚽', photo: null, positions: [], nickname: '' }}
            submitLabel="פתח את הקבוצה ⚽"
            onSubmit={async (f) => {
              let code
              try {
                code = await api.createGroup(groupName, f, { ...settings, venue: settings.venue.trim() || null })
              } catch (err) {
                const key = Object.keys(ERRORS).find((k) => err.message?.includes(k))
                throw new Error(key ? ERRORS[key] : 'משהו השתבש. נסה שוב.')
              }
              // Saved at once: the group exists now, and this code is the only way to manage it.
              setMyCode(code)
              const me = await api.getVoter(code).catch(() => null)
              if (me) setMyCode(code, me.group)
              setCreated({ code, group: me?.group ?? { name: groupName.trim() } })
              window.scrollTo(0, 0)
            }}
          />
          <button className="link-btn" onClick={() => setStep(2)}>חזרה</button>
        </>
      )}
    </main>
  )
}

function StepButtons({ onBack }) {
  return (
    <div className="row">
      <button type="button" className="btn ghost big" onClick={onBack}>חזרה</button>
      <button className="btn big">המשך</button>
    </div>
  )
}

// Right after opening: invite the players, and keep the admin link safe.
function Ready({ code, group, settings }) {
  const when = `כל יום ${DAY_NAMES[settings.weekday]} ב-${settings.kickoff}${settings.venue.trim() ? `, ${settings.venue.trim()}` : ''}`
  return (
    <main className="page">
      <div className="card empty ready-card">
        <div className="empty-emoji">🎉</div>
        <h1>{group.name} מוכנה!</h1>
        <p>{when}</p>
        <p className="muted small">{rulesSummary(settings)}</p>
      </div>

      <h2 className="section-title">1. מזמינים את החברים</h2>
      <InviteCard />

      <h2 className="section-title">2. שומרים את הקישור שלך</h2>
      <MyLink code={code} admin />

      <button className="btn big" onClick={() => openGroup(code)}>לקבוצה ⚽</button>
      <p className="muted small center">אפשר לשנות הכל אחר כך: ניהול → קבוצה.</p>
    </main>
  )
}
