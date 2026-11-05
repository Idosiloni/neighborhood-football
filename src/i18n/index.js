// The app's languages. Every text the user sees comes from here: t('ns.key', vars).
//
// - Texts live in src/i18n/he/*.js and src/i18n/en/*.js, one file per area (same keys in both).
//   en is American English; en-GB.js only lists the words that differ in British English.
// - {name} in a text is replaced by vars.name.
// - A text can depend on a count: { one: '…', two: '…', other: '{count} …' }, picked with
//   Intl.PluralRules (Hebrew has one/two/other, English one/other). vars.count picks the form.
// - tx() is t() for texts with React elements inside ({name} can be <b>…</b>); it returns an array.
// - Hebrew texts are written gender-neutral: no "אתה/את", "נסה/נסי" or "שלו/שלה" (see docs/i18n.md).
//
// Which language: what this phone picked (in "אני"), else the open group's language,
// else the phone's own language (Hebrew in Israel, English elsewhere).

import { Fragment, createElement, useSyncExternalStore } from 'react'
import he from './he/index.js'
import en from './en/index.js'
import enGB from './en-GB.js'

export const LOCALES = [
  { id: 'he', label: 'עברית' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
]

const PICKED = 'lang' // what this phone picked, if anything
const GROUP = 'group-lang' // the open group's language, remembered for the next start

// Kept in memory too, so a pick works for this visit without storage (private mode, tests).
const memory = new Map()
const read = (key) => {
  try {
    const v = globalThis.localStorage?.getItem(key)
    if (v !== undefined) return v ?? null
  } catch {
    // private mode
  }
  return memory.get(key) ?? null
}
const write = (key, value) => {
  if (value == null) memory.delete(key)
  else memory.set(key, value)
  try {
    if (value == null) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, value)
  } catch {
    // private mode: works for this visit only
  }
}

const valid = (id) => LOCALES.some((l) => l.id === id)

// A group's language ('he' / 'en') as a full locale. English groups follow the phone's English (US/UK).
function fromGroup(lang) {
  if (lang === 'he') return 'he'
  if (lang === 'en') return phoneLocale().startsWith('en') ? phoneLocale() : 'en-US'
  return null
}

const BRITISH = /^en-(GB|IE|AU|NZ|ZA|IN)/i
export function phoneLocale() {
  if (!globalThis.document) return 'he' // not a browser (the tests): Hebrew, the app's first language
  const langs = globalThis.navigator?.languages ?? (globalThis.navigator?.language ? [globalThis.navigator.language] : [])
  for (const l of langs) {
    if (/^(he|iw)\b/i.test(l)) return 'he'
    if (BRITISH.test(l)) return 'en-GB'
    if (/^en\b/i.test(l)) return 'en-US'
  }
  let zone = ''
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    // no time zone
  }
  // No Hebrew or English on the phone: Hebrew in Israel, else English.
  return zone === 'Asia/Jerusalem' ? 'he' : 'en-US'
}

function decide() {
  const picked = read(PICKED)
  if (valid(picked)) return picked
  return fromGroup(read(GROUP)) ?? phoneLocale()
}

let locale = decide()
const listeners = new Set()

export const getLocale = () => locale
export const isRTL = () => locale === 'he'
// 'he' or 'en': the language without the country.
export const language = () => locale.split('-')[0]

function apply() {
  const doc = globalThis.document?.documentElement
  if (doc) {
    doc.lang = locale
    doc.dir = isRTL() ? 'rtl' : 'ltr'
  }
  if (globalThis.document) globalThis.document.title = t('common.appName')
}

function change(next) {
  if (next === locale) return
  locale = next
  plurals.clear()
  apply()
  listeners.forEach((f) => f())
}

// The phone's own pick (null = follow the group / the phone again).
export function setLocale(id) {
  write(PICKED, valid(id) ? id : null)
  change(decide())
}
export const pickedLocale = () => (valid(read(PICKED)) ? read(PICKED) : null)

// The open group's language ('he' / 'en' / null). Used when the phone hasn't picked one.
export function setGroupLanguage(lang) {
  write(GROUP, lang === 'he' || lang === 'en' ? lang : null)
  change(decide())
}

// Re-renders when the language changes.
export function useLocale() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => locale,
    () => locale,
  )
}

// ── looking texts up ──

const DICTS = { he, en }

function lookup(dict, key) {
  let v = dict
  for (const part of key.split('.')) {
    if (v == null) return undefined
    v = v[part]
  }
  return v
}

function raw(key) {
  if (locale === 'en-GB' && enGB[key] !== undefined) return enGB[key]
  const v = lookup(DICTS[language()] ?? he, key)
  if (v !== undefined) return v
  return lookup(he, key) // a text missing in English shows in Hebrew rather than not at all
}

const plurals = new Map()
function pluralForm(n) {
  if (!plurals.has(locale)) plurals.set(locale, new Intl.PluralRules(locale))
  return plurals.get(locale).select(n)
}

function pick(v, vars) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const n = vars?.count ?? 0
    if (n === 0 && v.zero !== undefined) return v.zero
    return v[pluralForm(n)] ?? v.other
  }
  return v
}

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m)) : s)

export function t(key, vars) {
  const v = pick(raw(key), vars)
  if (typeof v === 'function') return v(vars ?? {})
  if (typeof v !== 'string') {
    if (globalThis.process?.env?.NODE_ENV !== 'production') console.warn(`i18n: missing text "${key}"`)
    return key
  }
  return fill(v, vars)
}

// A list of texts (e.g. day names, taglines).
export function tl(key) {
  const v = raw(key)
  return Array.isArray(v) ? v : []
}

// Like t(), but {name} may be a React element. Returns an array to put inside JSX.
export function tx(key, vars = {}) {
  const s = t(key, Object.fromEntries(Object.entries(vars).filter(([, v]) => typeof v !== 'object')))
  return s.split(/(\{\w+\})/g).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/)
    return m && vars[m[1]] !== undefined ? createElement(Fragment, { key: i }, vars[m[1]]) : part
  })
}

// ── numbers, names, days and times ──

// Sorting names in the language's own order.
export const compareNames = (a, b) => String(a).localeCompare(String(b), language())

// "שבת" / "Saturday" (0 = Sunday).
export const dayName = (i) => tl('common.days')[i]

// The group's kickoff ('H:MM', 24 hours) as people read it: 9:30 / 9:30 AM / 21:00 / 9:00 PM.
export function formatKickoff(kickoff) {
  const [h, m] = String(kickoff).split(':').map(Number)
  if (locale !== 'en-US') return `${h}:${String(m).padStart(2, '0')}`
  const suffix = h < 12 ? 'AM' : 'PM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

// A short date: 7.11 in Hebrew, 11/7 in the US, 7/11 in the UK.
export function shortDate(month, day) {
  if (locale === 'en-US') return `${month}/${day}`
  if (locale === 'en-GB') return `${day}/${month}`
  return `${day}.${month}`
}

// "יוסי, דני ומשה" / "Yossi, Danny and Moshe"
export function listOf(items) {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items)
  } catch {
    return items.join(', ')
  }
}

// The page's language, direction and title from the start (after the texts above are set up).
apply()
