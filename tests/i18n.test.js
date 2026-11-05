import { test } from 'node:test'
import assert from 'node:assert/strict'
import he from '../src/i18n/he/index.js'
import en from '../src/i18n/en/index.js'
import enGB from '../src/i18n/en-GB.js'
import { formatKickoff, getLocale, setLocale, shortDate, t } from '../src/i18n/index.js'
import { cleanOptions, matchRules, optionsOf, validOptions } from '../src/lib/options.js'

const PLURAL = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])
const isPlural = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every((k) => PLURAL.has(k))

// Every text as 'ns.key' → value (plural objects, lists and functions are leaves).
function leaves(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v) && !isPlural(v)) Object.assign(out, leaves(v, key))
    else out[key] = v
  }
  return out
}
const placeholders = (v) => {
  const texts = typeof v === 'string' ? [v] : isPlural(v) ? Object.values(v) : Array.isArray(v) ? v : []
  return [...new Set(texts.flatMap((s) => String(s).match(/\{\w+\}/g) ?? []))].filter((p) => p !== '{count}').sort()
}

const HE = leaves(he)
const EN = leaves(en)

test('i18n: Hebrew and English have the same texts', () => {
  assert.deepEqual(Object.keys(EN).filter((k) => !(k in HE)), [], 'only in English')
  assert.deepEqual(Object.keys(HE).filter((k) => !(k in EN)), [], 'only in Hebrew')
})

test('i18n: the same placeholders in both languages', () => {
  const differ = Object.keys(HE).filter((k) => typeof HE[k] !== 'function' && k in EN && placeholders(HE[k]).join() !== placeholders(EN[k]).join())
  assert.deepEqual(differ, [])
})

test('i18n: British texts only replace American ones that exist', () => {
  assert.deepEqual(Object.keys(enGB).filter((k) => !(k in EN) && !Object.keys(EN).some((e) => e.startsWith(`${k}.`))), [])
})

test('i18n: no Hebrew letters in the English texts', () => {
  const hebrew = (v) => /[א-ת]/.test(JSON.stringify(v ?? ''))
  // The language names are shown in their own language.
  const allowed = new Set(['admin.game.languages.he'])
  assert.deepEqual(Object.keys(EN).filter((k) => !allowed.has(k) && hebrew(EN[k])), [])
  assert.deepEqual(Object.keys(enGB).filter((k) => hebrew(enGB[k])), [])
})

test('i18n: plurals, times and dates per language', () => {
  assert.equal(getLocale(), 'he')
  assert.equal(t('sport.goals', { count: 1 }), 'גול אחד')
  assert.equal(t('sport.goals', { count: 2 }), 'שני גולים')
  assert.equal(t('sport.goals', { count: 7 }), '7 גולים')
  assert.equal(formatKickoff('21:05'), '21:05')
  assert.equal(shortDate(11, 7), '7.11')
  setLocale('en-US')
  try {
    assert.equal(t('sport.goals', { count: 1 }), '1 goal')
    assert.equal(t('sport.goals', { count: 2 }), '2 goals')
    assert.equal(formatKickoff('9:30'), '9:30 AM')
    assert.equal(formatKickoff('0:15'), '12:15 AM')
    assert.equal(formatKickoff('12:00'), '12:00 PM')
    assert.equal(formatKickoff('21:05'), '9:05 PM')
    assert.equal(shortDate(11, 7), '11/7')
    assert.equal(t('sport.name'), 'Soccer')
    setLocale('en-GB')
    assert.equal(t('sport.name'), 'Football')
    assert.equal(t('sport.positions.def.label'), 'Defence')
    assert.equal(t('sport.positions.mid.label'), 'Midfield') // not overridden: American text
    assert.equal(formatKickoff('21:05'), '21:05')
    assert.equal(shortDate(11, 7), '7/11')
  } finally {
    setLocale(null)
  }
  assert.equal(getLocale(), 'he')
})

test('options: known keys and values only; defaults filled in and left out when saving', () => {
  assert.ok(validOptions({}))
  assert.ok(validOptions({ lang: 'en', periods: 2, break_minutes: 10, tie: 'draw', team_a: 'red', team_b: 'white' }))
  for (const bad of [null, [], 'he', { lang: 'fr' }, { lang: 3 }, { color: 'red' }, { periods: 2.5 }, { periods: '2' },
    { periods: 5 }, { break_minutes: -1 }, { extra_minutes: 11 }, { tie: 'coin' }, { team_a: 'pink' },
    { team_a: 'orange' }, { team_a: 'red', team_b: 'red' }])
    assert.ok(!validOptions(bad), JSON.stringify(bad))
  const all = optionsOf(null)
  assert.equal(all.lang, null)
  assert.equal(all.periods, 1)
  assert.equal(all.tie, 'extra')
  assert.equal(all.team_a, 'blue')
  assert.deepEqual(optionsOf({ options: { lang: 'he', junk: 1, periods: 9 } }).periods, 1)
  assert.deepEqual(cleanOptions({ lang: null, junk: 1, periods: 1, tie: 'draw' }), { tie: 'draw' })
  assert.deepEqual(matchRules({ lang: 'he', periods: 2, tie: 'draw', team_a: 'red' }), { periods: 2, tie: 'draw' })
})

test('i18n: every text the code asks for exists in Hebrew and in English', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs')
  const { join } = await import('node:path')
  const files = []
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) { if (!p.endsWith('i18n')) walk(p) } else if (/\.jsx?$/.test(f)) files.push(p)
    }
  }
  walk(new URL('../src', import.meta.url).pathname)
  const keys = new Set()
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\bt[xl]?\(\s*'([a-z][\w]*\.[\w.]+)'/gi)) keys.add(m[1])
  const has = (dict, key) => {
    let v = dict
    for (const part of key.split('.')) v = v?.[part]
    return v !== undefined
  }
  const missing = [...keys].filter((k) => !has(he, k) || !has(en, k))
  assert.deepEqual(missing, [])
  assert.ok(keys.size > 300, `only ${keys.size} keys found`)
})
