import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { gameLabel, nextGameDay } from '../lib/dates'
import { useSchedule } from '../lib/schedule'
import { go } from '../lib/router'
import Avatar from '../components/Avatar'
import InstallHint from '../components/InstallHint'
import { rulesSummary } from '../components/GameSettings'

// Right after joining a group: what this group is, when it plays, and what to do first.
export default function Hello() {
  const code = getMyCode()
  const schedule = useSchedule()
  const { data } = useLoad(async () => {
    const [me, players] = await Promise.all([api.getVoter(code), api.listPlayers()])
    return { me, players }
  }, [code])

  if (!data?.me) return <main className="page"><p className="center muted">טוען…</p></main>

  const { me, players } = data
  const meFull = players.find((p) => p.id === me.id) ?? me
  const others = players.filter((p) => p.active && p.id !== me.id).length
  const when = gameLabel(nextGameDay(new Date(), schedule), schedule)

  return (
    <main className="page home">
      <header className="hero hello">
        <div className="hero-pitch" aria-hidden="true" />
        <Avatar player={meFull} size={84} />
        <h1 className="long">ברוך הבא, {me.name}!</h1>
        <p>אתה עכשיו ב{me.group.name}</p>
      </header>

      <section className="card stack">
        <span className="muted small">המשחק הבא</span>
        <p className="big-day">{when}</p>
        {schedule.venue && <p>📍 {schedule.venue}</p>}
        <p className="muted small">{rulesSummary(schedule)}</p>
      </section>

      <h2 className="section-title">מה עושים עכשיו?</h2>
      <ol className="card steps hello-steps">
        <li>
          <b>מדרגים את השחקנים.</b> בסוד: אף אחד לא רואה את הדירוג שלך, ורק מנהלי הקבוצה רואים את התוצאה הכללית. ככה הקבוצות יוצאות שוות.
        </li>
        <li>
          <b>נרשמים למשחק</b> בעמוד הבית ("אני בא"). ביום המשחק זו רשימת מי שהגיע.
        </li>
        <li>
          <b>במגרש</b> האפליקציה מחלקת לשתי קבוצות שוות, סופרת זמן וגולים, ובסוף בוחרים את שחקן המשחק.
        </li>
      </ol>

      {others > 0 ? (
        <button className="btn big" onClick={() => go(`/v/${code}`)}>בוא נדרג ⭐</button>
      ) : (
        <p className="muted center">עוד אין את מי לדרג. כשיצטרפו עוד שחקנים, תראה אותם בעמוד הבית.</p>
      )}
      <button className={`btn big${others > 0 ? ' ghost' : ''}`} onClick={() => go('/')}>{others > 0 ? 'אחר כך, לעמוד הבית' : 'לעמוד הבית'}</button>
      <InstallHint />
    </main>
  )
}
