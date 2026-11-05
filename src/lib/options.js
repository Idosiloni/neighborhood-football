// A group's options (groups.options in the database): one object, so new settings need no new column.
// Same rules as private.options_valid in supabase/schema.sql. To add an option: a line in OPTIONS
// here, a line in options_valid there, and a test in tests/sql.test.js.
//
// values: the allowed values, or { min, max } for a whole number. default: what an unset option means.

export const TEAM_COLORS = ['blue', 'orange', 'red', 'white', 'black', 'yellow', 'green', 'purple']

export const OPTIONS = {
  lang: { values: ['he', 'en'], default: null }, // the group's language: what a phone shows unless it picked one
  // How a game day goes: 'rounds' = short matches, the winner stays on; 'game' = one long game.
  format: { values: ['rounds', 'game'], default: 'rounds' },
  periods: { min: 1, max: 4, default: 1 }, // halves / quarters (match_minutes is the length of each)
  break_minutes: { min: 0, max: 30, default: 5 }, // half-time
  extra_minutes: { min: 0, max: 10, default: 2 }, // extra time after a tie (0 = straight to golden goal)
  tie: { values: ['extra', 'penalties', 'draw'], default: 'extra' }, // a tie when time runs out
  team_a: { values: TEAM_COLORS, default: 'blue' }, // bib colors
  team_b: { values: TEAM_COLORS, default: 'orange' },
  // How much the players do (see LEVELS): how teams are rated, MVP votes, recording assists,
  // and signing up from the group's link with one tap (no personal link needed).
  rating: { values: ['peers', 'admin', 'none'], default: 'peers' },
  mvp: { values: [true, false], default: true },
  assists: { values: [true, false], default: true },
  quick_signup: { values: [true, false], default: false },
}

// Ready-made sets of the switches above. "standard" is what every group had before.
// The level isn't stored: it is worked out from the switches (anything else = custom).
export const LEVELS = {
  simple: { rating: 'admin', mvp: false, assists: false, quick_signup: true },
  standard: { rating: 'peers', mvp: true, assists: true, quick_signup: false },
}
export const LEVEL_KEYS = Object.keys(LEVELS.standard)

export function levelOf(options) {
  const o = optionsOf({ options })
  return Object.keys(LEVELS).find((l) => LEVEL_KEYS.every((k) => o[k] === LEVELS[l][k])) ?? 'custom'
}

// A change to send to the database: defaults become null (= remove the key), the rest as is.
export function optionsPatch(fields) {
  return Object.fromEntries(
    Object.entries(fields ?? {}).filter(([k]) => OPTIONS[k]).map(([k, v]) => [k, v === OPTIONS[k].default || v == null ? null : v]),
  )
}

// The options frozen on each match when it starts (with match_minutes and win_goals).
export const MATCH_RULES = ['periods', 'break_minutes', 'extra_minutes', 'tie']

const allowed = (o, v) => (o.values ? o.values.includes(v) : Number.isInteger(v) && v >= o.min && v <= o.max)

// The group's options with every default filled in.
export function optionsOf(group) {
  const saved = group?.options && typeof group.options === 'object' ? group.options : {}
  return Object.fromEntries(Object.entries(OPTIONS).map(([k, o]) => [k, allowed(o, saved[k]) ? saved[k] : o.default]))
}

// What gets saved: only known keys with allowed values (defaults are left out).
export function cleanOptions(options) {
  return Object.fromEntries(
    Object.entries(options ?? {}).filter(([k, v]) => OPTIONS[k] && v !== OPTIONS[k].default && allowed(OPTIONS[k], v)),
  )
}

// Same check as the database: an object with known keys and allowed values only, and two different bib colors.
export function validOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) return false
  if (!Object.entries(options).every(([k, v]) => OPTIONS[k] && allowed(OPTIONS[k], v))) return false
  return (options.team_a ?? OPTIONS.team_a.default) !== (options.team_b ?? OPTIONS.team_b.default)
}

// The rules a new match keeps (what the database trigger copies): only those the group set.
export function matchRules(options) {
  const saved = options ?? {}
  return Object.fromEntries(MATCH_RULES.filter((k) => saved[k] !== undefined).map((k) => [k, saved[k]]))
}
