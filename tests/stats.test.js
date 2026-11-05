import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStats, computeAwards, overall, funTraits, tagline, cardAttributes } from '../src/lib/stats.js'
import { setLocale, getLocale, t, tl } from '../src/i18n/index.js'
import heStats from '../src/i18n/he/stats.js'
import enStats from '../src/i18n/en/stats.js'

const players = ['a1', 'a2', 'b1', 'b2', 'k'].map((id) => ({ id, position: id === 'k' ? 'gk' : 'any' }))
const m = (n, winner, live = false) => ({
  id: `m${n}`, num: n, created_at: `2026-10-31T18:0${n}:00Z`, status: live ? 'live' : 'finished', winner: live ? null : winner,
  team_a: ['a1', 'a2', 'k'], team_b: ['b1', 'b2'],
})
const matches = [m(1, 'a'), m(2, 'a'), m(3, 'b'), m(4, 'a'), m(5, null, true)]
const goals = [
  { match_id: 'm1', team: 'a', scorer: 'a1', assist: 'a2' },
  { match_id: 'm1', team: 'b', scorer: 'b1', assist: null },
  { match_id: 'm2', team: 'a', scorer: 'a1', assist: 'a2' },
  { match_id: 'm4', team: 'a', scorer: null, assist: null },
  { match_id: 'm5', team: 'a', scorer: 'a1', assist: null }, // live match: ignored
]

test('counts only finished matches', () => {
  const s = computeStats(players, matches, goals)
  assert.equal(s.matchCount, 4)
  assert.equal(s.byId.a1.games, 4)
  assert.equal(s.byId.a1.wins, 3)
  assert.equal(s.byId.a1.goals, 2)
  assert.equal(s.byId.a2.assists, 2)
})

test('streaks: current and best', () => {
  const s = computeStats(players, matches, goals)
  assert.equal(s.byId.a1.streak, 1)
  assert.equal(s.byId.a1.bestStreak, 2)
  assert.equal(s.byId.b1.streak, 0)
})

test('draws: neither a win nor a loss for either side; they end a streak and count half in the rating', () => {
  const list = [m(1, 'a'), m(2, 'a'), m(3, 'draw')]
  const s = computeStats(players, list, [])
  assert.equal(s.matchCount, 3)
  for (const id of ['a1', 'b1']) assert.equal(s.byId[id].draws, 1)
  assert.equal(s.byId.a1.wins, 2)
  assert.equal(s.byId.a1.losses, 0)
  assert.equal(s.byId.b1.losses, 2)
  assert.equal(s.byId.a1.streak, 0)
  assert.equal(s.byId.a1.bestStreak, 2)
  assert.ok(s.byId.a1.overall > s.byId.b1.overall)
  // all draws: in between all wins and all losses
  const d = computeStats(players, [m(1, 'draw'), m(2, 'draw'), m(3, 'draw')], [])
  const w = computeStats(players, [m(1, 'a'), m(2, 'a'), m(3, 'a')], [])
  assert.ok(d.byId.a1.overall < w.byId.a1.overall && d.byId.a1.overall > w.byId.b1.overall)
})

test('keeper conceded counts goals against his team', () => {
  const s = computeStats(players, matches, goals)
  assert.equal(s.byId.k.keeperGames, 4)
  assert.equal(s.byId.k.conceded, 1)
})

test('awards pick the right holders', () => {
  const awards = Object.fromEntries(computeAwards(computeStats(players, matches, goals)).map((a) => [a.key, a]))
  assert.deepEqual(awards.scorer.ids, ['a1'])
  assert.deepEqual(awards.assists.ids, ['a2'])
  assert.deepEqual(awards.combo.ids, ['a2', 'a1'])
  assert.deepEqual(awards.wall.ids, ['k'])
  assert.ok(awards.duo.ids.every((id) => ['a1', 'a2', 'k'].includes(id)))
  assert.equal(awards.lucky, undefined) // nobody has 5 games yet
})

test('overall needs 3 games and stays within 1..99', () => {
  assert.equal(overall({ games: 2, wins: 2, goals: 9, assists: 9 }), null)
  assert.equal(overall({ games: 40, wins: 40, goals: 200, assists: 200 }), 99)
  const mid = overall({ games: 10, wins: 5, goals: 5, assists: 3 })
  assert.ok(mid > 60 && mid < 75)
})

test('MVP: most votes in a finished match wins; ties share it; live matches do not count', () => {
  const mvp = [
    { match_id: 'm1', player_id: 'a1', votes: 3 },
    { match_id: 'm1', player_id: 'b1', votes: 1 },
    { match_id: 'm2', player_id: 'a2', votes: 2 },
    { match_id: 'm2', player_id: 'k', votes: 2 },
    { match_id: 'm5', player_id: 'b2', votes: 9 }, // live
  ]
  const s = computeStats(players, matches, goals, mvp)
  assert.equal(s.byId.a1.mvp, 1)
  assert.equal(s.byId.b1.mvp, 0)
  assert.equal(s.byId.a2.mvp, 1)
  assert.equal(s.byId.k.mvp, 1)
  assert.equal(s.byId.b2.mvp, 0)
  const award = computeAwards(s).find((a) => a.key === 'mvp')
  assert.ok(['a1', 'a2', 'k'].includes(award.ids[0]))
})

// Every trait at least once: a fresh keeper, and a busy player who wins, scores, assists and plays in goal.
const traitCases = [
  [{ games: 1, wins: 0, goals: 0, assists: 0, bestStreak: 0 }, { id: 'x1', position: 'gk' }],
  [{ games: 25, wins: 20, goals: 30, assists: 40, bestStreak: 5 }, { id: 'x2', position: 'def', positions: ['def'], can_gk: true }],
  [{ games: 6, wins: 1, goals: 0, assists: 0, bestStreak: 0 }, { id: 'x3', position: 'att', positions: ['att'] }],
  [{ games: 6, wins: 1, goals: 9, assists: 0, bestStreak: 0 }, { id: 'x4', position: 'def', positions: ['def'] }],
]
const POS = ['att', 'mid', 'def', 'gk', 'any']

function allTexts() {
  const s = computeStats(players, matches, goals, [{ match_id: 'm1', player_id: 'a1', votes: 2 }])
  const awards = computeAwards(s)
  const traits = traitCases.flatMap(([st, p]) => funTraits(st, p))
  return {
    awards,
    traits: [...traits.map((tr) => tr.label), ...Object.keys(heStats.traits).map((k) => t(`stats.traits.${k}`))],
    lines: POS.flatMap((pos) => tl(`stats.taglines.${pos}`)),
    attrs: [...cardAttributes(s.byId.a1), ...cardAttributes(s.byId.k)],
  }
}

test('taglines are stable per player and the same index in every language', () => {
  const p = { id: 'player-42', position: 'mid' }
  assert.equal(tagline(p), tagline({ ...p }))
  const he = tl('stats.taglines.mid').indexOf(tagline(p))
  assert.ok(he >= 0)
  assert.ok(tagline({ id: 'z', position: 'nowhere' })) // unknown position: the "any" lines
  for (const pos of POS) assert.equal(tl(`stats.taglines.${pos}`).length, 3)
})

test('Hebrew texts: awards, traits and taglines', () => {
  const { awards, traits, lines } = allTexts()
  for (const x of [...awards.flatMap((a) => [a.title, a.text]), ...traits, ...lines]) {
    assert.ok(x && /[\u05D0-\u05EA]/.test(x), `not Hebrew: ${x}`)
  }
})

test('funTraits: at most 3 badges, from the position and the numbers', () => {
  assert.deepEqual(funTraits(...traitCases[0]).map((x) => x.key), ['fresh', 'gloves'])
  assert.deepEqual(funTraits(...traitCases[2]).map((x) => x.key), ['attStrike', 'optimist'])
  for (const c of traitCases) assert.ok(funTraits(...c).length <= 3)
})

// Plural objects ({ one, two, other }) are leaves; English has no "two".
const isPlural = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'other' in v
function keysOf(o, prefix = '') {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) && !isPlural(v) ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}
test('stats texts: the same keys in Hebrew and English', () => {
  assert.deepEqual(keysOf(enStats).sort(), keysOf(heStats).sort())
})

// setLocale needs somewhere to keep the pick; plain Node has no localStorage.
function withLocale(id, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const store = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  })
  try {
    setLocale(id)
    assert.equal(getLocale(), id)
    fn()
  } finally {
    setLocale(null)
    if (had) Object.defineProperty(globalThis, 'localStorage', had)
    else delete globalThis.localStorage
  }
}

for (const id of ['en-US', 'en-GB']) {
  test(`${id} texts: awards, traits, taglines and card labels are English`, () => {
    withLocale(id, () => {
      const p = { id: 'player-42', position: 'gk' }
      const { awards, traits, lines, attrs } = allTexts()
      assert.ok(awards.length >= 5)
      assert.ok(traits.length >= 11)
      const texts = [...awards.flatMap((a) => [a.title, a.text]), ...traits, ...lines, ...attrs.map((a) => a.label), tagline(p)]
      for (const x of texts) {
        assert.ok(x && x.trim(), 'empty text')
        assert.ok(!/[\u05D0-\u05EA]/.test(x), `Hebrew left in English: ${x}`)
        assert.ok(!x.startsWith('stats.') && !x.startsWith('sport.'), `missing text: ${x}`)
      }
      for (const pos of POS) assert.equal(tl(`stats.taglines.${pos}`).length, 3)
    })
    assert.equal(getLocale(), 'he')
  })
}
