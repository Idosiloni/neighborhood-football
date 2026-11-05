import { dayNames } from '../lib/dates'
import { minPlayers } from '../lib/teams'
import { sport } from '../sports'
import { t } from '../i18n'

// The group's settings, as form fields. value: { weekday, kickoff, venue, team_size, match_minutes, win_goals }.
// Used when opening a group and in admin → "Group".

export function WhenFields({ value, onChange }) {
  return (
    <>
      <div className="field">
        {t('admin.rules.day')}
        <div className="chips">
          {dayNames().map((name, i) => (
            <button type="button" key={i} className={value.weekday === i ? 'on' : ''} aria-pressed={value.weekday === i}
              onClick={() => onChange({ ...value, weekday: i })}>{name}</button>
          ))}
        </div>
      </div>
      <label className="field">
        {t('admin.rules.time')}
        {/* 24-hour value ('09:30'); the browser shows it the phone's way. Stored as 'H:MM'. */}
        <input
          className="input"
          type="time"
          dir="ltr"
          value={value.kickoff.padStart(5, '0')}
          onChange={(e) => e.target.value && onChange({ ...value, kickoff: e.target.value.replace(/^0(\d):/, '$1:') })}
        />
      </label>
      <label className="field">
        {t('admin.rules.venue')}
        <input className="input" value={value.venue ?? ''} maxLength={60} placeholder={t('admin.rules.venuePlaceholder')}
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
      <Choice label={t('admin.rules.teamSize')} options={SIZES} value={value.team_size} onChange={set('team_size')} />
      <Choice label={t('admin.rules.minutes')} options={MINUTES} value={value.match_minutes} onChange={set('match_minutes')} />
      <Choice label={t('admin.rules.winGoals')} options={GOALS} value={value.win_goals} onChange={set('win_goals')}
        text={(g) => (g ? t('admin.rules.goalsChip', { count: g }) : t('admin.rules.noGoalLimit'))} />
      <p className="muted small">{rulesSummary(value)}</p>
    </>
  )
}

// "6v6, 7 minutes or first to 3 goals. Tie: 2 minutes of overtime, then golden goal. …" in the current language.
export function rulesSummary({ team_size, match_minutes, win_goals }) {
  return t(win_goals ? 'admin.rules.summaryGoals' : 'admin.rules.summaryTime', {
    size: team_size,
    minutes: match_minutes,
    goals: win_goals,
    extra: sport.extraMinutes,
    goldenGoal: t('sport.goldenGoal'),
    min: minPlayers(team_size),
  })
}
