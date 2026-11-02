import { myGroups, openGroup } from '../lib/identity'
import Icon from '../components/Icon'
import InstallHint from '../components/InstallHint'

// First screen on a phone that isn't in a group (yet): open a new group, or join one.
export default function Welcome({ invalid = false }) {
  const others = myGroups()

  return (
    <main className="page home">
      <header className="hero">
        <div className="hero-pitch" aria-hidden="true" />
        <h1>כדורגל<br />שכונה</h1>
        <p>קבוצות הוגנות, בלי ויכוחים</p>
      </header>

      {invalid && <p className="note">הקוד ששמור בטלפון כבר לא תקף (אולי מנהל הקבוצה החליף אותו). בקש ממנו קישור חדש, או הצטרף מחדש.</p>}

      {others.length > 0 && (
        <section className="stack">
          <h2 className="section-title">הקבוצות שלך</h2>
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
          <strong>📨 יש לי קוד הצטרפות</strong>
          <p className="muted">קיבלת קישור או קוד מהקבוצה? בוחרים את השם שלך ומצטרפים.</p>
        </div>
        <Icon name="forward" />
      </a>

      <a className="card cta-card" href="#/new">
        <div>
          <strong>🆕 פתיחת קבוצה חדשה</strong>
          <p className="muted">אתה מארגן את המשחק? פותחים קבוצה, מזמינים את החברים, והאפליקציה מחלקת לקבוצות שוות.</p>
        </div>
        <Icon name="forward" />
      </a>

      <section className="card stack how-it-works">
        <h2>איך זה עובד</h2>
        <ol className="steps">
          <li><b>נרשמים</b> עם שם ותמונה, בלי סיסמאות ובלי אימייל.</li>
          <li><b>מדרגים בסוד</b> מי הכי טוב במגרש. רק מנהלי הקבוצה רואים את התוצאה.</li>
          <li><b>במגרש</b> מסמנים מי הגיע, והאפליקציה מחלקת לשתי קבוצות שוות, עם שעון, גולים וסטטיסטיקה.</li>
        </ol>
      </section>

      <a className="admin-entry" href="#/vote">יש לי קוד אישי</a>
      <InstallHint />
    </main>
  )
}
