import { dayNames } from '../lib/dates'
import { minPlayers } from '../lib/teams'
import { sport } from '../sports'
import { t } from '../i18n'
import { LEVELS, levelOf, optionsOf, TEAM_COLORS } from '../lib/options'
import { PALETTE } from '../lib/teamColors'

// The group's settings, as form fields. value: { weekday, kickoff, venue, team_size, match_minutes, win_goals, options }.
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
// A long game: its whole length, how it splits up, half-time and extra time.
const TOTALS = [30, 40, 45, 60, 75, 80, 90, 100, 120]
const PARTS = [1, 2, 4]
const BREAKS = [0, 5, 10, 15]
const EXTRAS = [1, 2, 3, 5]
// What the form shows as the tie rule: extra time of 0 minutes is "straight to golden goal".
const TIE_CHOICES = ['extra', 'golden', 'penalties', 'draw']
const tieChoice = (o) => (o.tie === 'extra' && o.extra_minutes === 0 ? 'golden' : o.tie)

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

// value: the group's rules ({ team_size, match_minutes, win_goals }) plus options (all of optionsOf()).
export function RulesFields({ value, onChange }) {
  const o = optionsOf(value)
  const set = (key) => (v) => onChange({ ...value, [key]: v })
  const setOptions = (fields, rest = {}) => onChange({ ...value, ...rest, options: { ...o, ...fields } })
  const game = o.format === 'game'
  const total = value.match_minutes * o.periods

  // Switching how they play starts from sensible rules for it.
  const setFormat = (format) => {
    if (format === o.format) return
    if (format === 'game') setOptions({ format, periods: 2, break_minutes: 5, tie: 'draw' }, { match_minutes: 30, win_goals: 0 })
    else setOptions({ format, periods: 1, tie: 'extra', extra_minutes: 2 }, { match_minutes: 7, win_goals: 3 })
  }
  // The whole length stays (as close as it can) when the parts change.
  const setParts = (periods) => {
    const fits = TOTALS.filter((x) => x % periods === 0)
    const best = fits.reduce((b, x) => (Math.abs(x - total) < Math.abs(b - total) ? x : b), fits[0])
    setOptions({ periods }, { match_minutes: best / periods })
  }
  const setTie = (choice) => {
    if (choice === 'golden') setOptions({ tie: 'extra', extra_minutes: 0 })
    else setOptions({ tie: choice, extra_minutes: choice === 'extra' && o.extra_minutes === 0 ? 2 : o.extra_minutes })
  }

  return (
    <>
      <Choice label={t('admin.rules.format')} options={['rounds', 'game']} value={o.format} onChange={setFormat}
        text={(f) => t(`admin.rules.formats.${f}`)} />
      <Choice label={t('admin.rules.teamSize')} options={SIZES} value={value.team_size} onChange={set('team_size')} />
      {game ? (
        <>
          <Choice label={t('admin.rules.total')} options={TOTALS.filter((x) => x % o.periods === 0)} value={total}
            onChange={(x) => onChange({ ...value, match_minutes: x / o.periods })} text={(x) => t('admin.rules.totalChip', { count: x })} />
          <Choice label={t('admin.rules.parts')} options={PARTS} value={o.periods} onChange={setParts}
            text={(p) => t(`admin.rules.partsChips.${p}`)} />
          {o.periods > 1 && (
            <Choice label={t('admin.rules.breakLength')} options={BREAKS} value={o.break_minutes}
              onChange={(b) => setOptions({ break_minutes: b })} text={(b) => t('admin.rules.breakChip', { count: b })} />
          )}
        </>
      ) : (
        <>
          <Choice label={t('admin.rules.minutes')} options={MINUTES} value={value.match_minutes} onChange={set('match_minutes')} />
          <Choice label={t('admin.rules.winGoals')} options={GOALS} value={value.win_goals} onChange={set('win_goals')}
            text={(g) => (g ? t('admin.rules.goalsChip', { count: g }) : t('admin.rules.noGoalLimit'))} />
        </>
      )}
      <Choice label={t('admin.rules.tie')} options={TIE_CHOICES} value={tieChoice(o)} onChange={setTie}
        text={(c) => t(`admin.rules.ties.${c}`)} />
      {o.tie === 'extra' && o.extra_minutes > 0 && (
        <Choice label={t('admin.rules.extraLength')} options={EXTRAS} value={o.extra_minutes}
          onChange={(x) => setOptions({ extra_minutes: x })} text={(x) => t('admin.rules.extraChip', { count: x })} />
      )}
      <ColorFields value={o} onChange={(fields) => setOptions(fields)} />
      <p className="muted small">{rulesSummary(value)}</p>
    </>
  )
}

// The bib colors of the two teams. Picking the other team's color swaps them.
function ColorFields({ value, onChange }) {
  const pick = (side, color) => {
    const other = side === 'team_a' ? 'team_b' : 'team_a'
    onChange(value[other] === color ? { [side]: color, [other]: value[side] } : { [side]: color })
  }
  return (
    <div className="field">
      {t('admin.rules.colors')}
      {['team_a', 'team_b'].map((side) => (
        <div key={side} className="color-row">
          <span className="muted small">{t(side === 'team_a' ? 'admin.rules.colorFirst' : 'admin.rules.colorSecond')}</span>
          <div className="chips">
            {TEAM_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch-chip${value[side] === c ? ' on' : ''}`} aria-pressed={value[side] === c}
                onClick={() => pick(side, c)}>
                <span className="swatch" style={{ background: PALETTE[c].bg }} aria-hidden="true" />
                {t(`common.colors.${c}.short`)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// "6 נגד 6, 7 דקות או ראשונה ל-3. תיקו: 2 דקות הארכה, ואז גול זהב. …" in the current language.
// value: the rules columns, plus options when there are any (older callers: the defaults).
export function rulesSummary(value) {
  const { team_size, match_minutes, win_goals } = value
  const o = optionsOf(value)
  const game = o.format === 'game'
  let length
  if (!game) length = t(win_goals ? 'admin.rules.lengthGoals' : 'admin.rules.lengthTime', { minutes: match_minutes, goals: win_goals })
  else {
    const total = match_minutes * o.periods
    length = t(o.periods === 1 ? 'admin.rules.lengthGame' : o.periods === 2 ? 'admin.rules.lengthHalves' : 'admin.rules.lengthQuarters',
      { total, minutes: match_minutes })
    if (o.periods > 1) length = t('admin.rules.withBreak', { length, count: o.break_minutes })
  }
  const tie = {
    extra: () => t('admin.rules.tieExtra', { extra: o.extra_minutes, goldenGoal: t('sport.goldenGoal') }),
    golden: () => t('admin.rules.tieGolden', { goldenGoal: t('sport.goldenGoal') }),
    penalties: () => t('admin.rules.tiePenalties'),
    draw: () => t(game ? 'admin.rules.tieDrawGame' : 'admin.rules.tieDrawRounds'),
  }[tieChoice(o)]()
  return t('admin.rules.summary', {
    size: t('admin.rules.sizePart', { n: team_size }),
    length,
    tie,
    min: t('admin.rules.minPart', { min: minPlayers(team_size) }),
  })
}

// How much the players do: a ready-made level (simple / standard), and each switch on its own.
// value: the group's options (all of optionsOf()); onChange(fields): the changed ones.
export function LevelFields({ value, onChange, disabled = false }) {
  const level = levelOf(value)
  const toggle = (key, label, hint) => (
    <label className="check">
      <input type="checkbox" checked={value[key]} disabled={disabled} onChange={(e) => onChange({ [key]: e.target.checked })} />
      <span>
        {label}
        {hint && <small className="muted">{hint}</small>}
      </span>
    </label>
  )
  return (
    <>
      <div className="field">
        {t('admin.level.title')}
        <div className="chips">
          {Object.keys(LEVELS).map((l) => (
            <button type="button" key={l} className={level === l ? 'on' : ''} aria-pressed={level === l} disabled={disabled}
              onClick={() => onChange(LEVELS[l])}>{t(`admin.level.levels.${l}`)}</button>
          ))}
          {level === 'custom' && <button type="button" className="on" aria-pressed disabled>{t('admin.level.levels.custom')}</button>}
        </div>
        <small className="muted">{t(`admin.level.hints.${level}`)}</small>
      </div>
      <Choice label={t('admin.level.rating')} options={['peers', 'attrs', 'admin', 'none']} value={value.rating}
        onChange={(r) => !disabled && onChange({ rating: r })} text={(r) => t(`admin.level.ratings.${r}`)} />
      <small className="muted">{t(`admin.level.ratingHints.${value.rating}`)}</small>
      {toggle('mvp', t('admin.level.mvp'))}
      {toggle('assists', t('admin.level.assists'))}
      {toggle('quick_signup', t('admin.level.quick'), t('admin.level.quickHint'))}
    </>
  )
}
