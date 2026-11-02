import { DAY_NAMES } from '../lib/dates'
import { minPlayers } from '../lib/teams'
import { sport } from '../sports'

// The group's settings, as form fields. value: { weekday, kickoff, venue, team_size, match_minutes, win_goals }.
// Used when opening a group and in admin → "קבוצה".

export function WhenFields({ value, onChange }) {
  return (
    <>
      <div className="field">
        באיזה יום?
        <div className="chips">
          {DAY_NAMES.map((name, i) => (
            <button type="button" key={name} className={value.weekday === i ? 'on' : ''} aria-pressed={value.weekday === i}
              onClick={() => onChange({ ...value, weekday: i })}>{name}</button>
          ))}
        </div>
      </div>
      <label className="field">
        באיזו שעה?
        <input
          className="input"
          type="time"
          dir="ltr"
          value={value.kickoff.padStart(5, '0')}
          onChange={(e) => e.target.value && onChange({ ...value, kickoff: e.target.value.replace(/^0(\d):/, '$1:') })}
        />
      </label>
      <label className="field">
        איפה? (לא חובה)
        <input className="input" value={value.venue ?? ''} maxLength={60} placeholder="למשל: מגרש הספורטק"
          onChange={(e) => onChange({ ...value, venue: e.target.value })} />
      </label>
    </>
  )
}

const { team_size: SIZES, match_minutes: MINUTES, win_goals: GOALS } = sport.options

function Choice({ label, options, value, onChange, text = String }) {
  return (
    <div className="field">
      {label}
      <div className="chips">
        {options.map((o) => (
          <button type="button" key={o} className={value === o ? 'on' : ''} aria-pressed={value === o} onClick={() => onChange(o)}>{text(o)}</button>
        ))}
      </div>
    </div>
  )
}

export function RulesFields({ value, onChange }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v })
  return (
    <>
      <Choice label="כמה שחקנים בכל קבוצה במגרש?" options={SIZES} value={value.team_size} onChange={set('team_size')} />
      <Choice label="כמה דקות כל משחק?" options={MINUTES} value={value.match_minutes} onChange={set('match_minutes')} />
      <Choice label="מנצחת הראשונה שמגיעה ל..." options={GOALS} value={value.win_goals} onChange={set('win_goals')}
        text={(g) => (g ? `${g} ${sport.words.goals}` : 'בלי, רק זמן')} />
      <p className="muted small">{rulesSummary(value)}</p>
    </>
  )
}

// "6 נגד 6, 7 דקות או ראשונה ל-3. תיקו: 2 דקות הארכה, ואז גול זהב. מחלקים מ-8 שחקנים."
export function rulesSummary({ team_size, match_minutes, win_goals }) {
  const end = win_goals ? `${match_minutes} דקות או ראשונה ל-${win_goals}` : `${match_minutes} דקות`
  return `${team_size} נגד ${team_size}, ${end}. תיקו: ${sport.extraMinutes} דקות הארכה, ואז ${sport.words.goal} זהב. אפשר לחלק כשיש לפחות ${minPlayers(team_size)} שחקנים, והשאר מחכים בחוץ.`
}
