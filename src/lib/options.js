// A group's options (groups.options in the database): one object, so new settings need no new column.
// Same rules as private.options_valid in supabase/schema.sql. To add an option: a line in OPTIONS
// here, a line in options_valid there, and a test in tests/sql.test.js.
//
// value: the allowed values (null = not set: the app's default).

export const OPTIONS = {
  lang: { values: ['he', 'en'], default: null }, // the group's language: what a phone shows unless it picked one
}

// The group's options with every default filled in.
export function optionsOf(group) {
  const saved = group?.options && typeof group.options === 'object' ? group.options : {}
  return Object.fromEntries(Object.entries(OPTIONS).map(([k, o]) => [k, o.values.includes(saved[k]) ? saved[k] : o.default]))
}

// What gets saved: only known keys with allowed values (defaults are left out).
export function cleanOptions(options) {
  return Object.fromEntries(
    Object.entries(options ?? {}).filter(([k, v]) => OPTIONS[k] && v !== OPTIONS[k].default && OPTIONS[k].values.includes(v)),
  )
}

// Same check as the database: an object with known keys and allowed values only.
export function validOptions(options) {
  return (
    options !== null && typeof options === 'object' && !Array.isArray(options) &&
    Object.entries(options).every(([k, v]) => OPTIONS[k]?.values.includes(v))
  )
}
