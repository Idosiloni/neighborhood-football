import { sport } from '../sports/index.js'

// Local calendar day as YYYY-MM-DD (a late game still belongs to the evening it started).
export function today() {
  const d = new Date(Date.now() - 4 * 3600_000) // games after midnight count for the previous evening
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export function dayLabel(day) {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `יום ${DAYS[date.getDay()]} ${d}.${m}`
}

// A group's settings before the server answers (and the defaults of a new group): Saturday 9:30
// (0 = Sunday), 6 per team, 7-minute matches, first to 3 goals. The admin changes them in admin → "קבוצה".
export const GAME = { weekday: 6, kickoff: '9:30', ...sport.rules, venue: null }
// Only the settings fields of a group (or a form), leaving out any that are missing.
export const pickSettings = (o) => Object.fromEntries(Object.keys(GAME).filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))

export const DAY_NAMES = DAYS

// Day of the next game: today until a few hours after kickoff, then next week's.
export function nextGameDay(now = new Date(), schedule = GAME) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let ahead = (schedule.weekday - date.getDay() + 7) % 7
  const [h, min] = schedule.kickoff.split(':').map(Number)
  if (ahead === 0 && now.getHours() * 60 + now.getMinutes() > (h + 4) * 60 + min) ahead = 7
  date.setDate(date.getDate() + ahead)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// "שבת 7.11, 9:30"
export function gameLabel(day, schedule = GAME) {
  const [y, m, d] = day.split('-').map(Number)
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${d}.${m}, ${schedule.kickoff}`
}
