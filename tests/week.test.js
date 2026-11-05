import { test } from 'node:test'
import assert from 'node:assert/strict'
import { teamOfTheWeek, isFresh, dayPoints } from '../src/lib/week.js'
import { cardAttributes, nextTier, tierOf } from '../src/lib/stats.js'

const P = (id, positions = []) => ({ id, name: id, position: positions[0] ?? 'any', positions, active: true })
const players = [P('k', ['gk']), P('a'), P('b'), P('c'), P('d'), P('e'), P('f'), P('g')]
const night = (id, day) => ({ id, day })
const match = (id, night_id, a, b, winner, at) => ({ id, night_id, team_a: a, team_b: b, status: 'finished', winner, created_at: at })

test('team of the week: the last game day only, with one goalkeeper and the team size', () => {
  const history = {
    nights: [night('n1', '2026-10-29'), night('n2', '2026-11-05')],
    matches: [
      match('old', 'n1', ['g', 'f'], ['a', 'b'], 'a', '2026-10-29T19:00:00Z'), // an older day: doesn't count
      match('m1', 'n2', ['k', 'a', 'b'], ['c', 'd', 'e'], 'a', '2026-11-05T19:00:00Z'),
      match('m2', 'n2', ['k', 'a', 'c'], ['b', 'd', 'f'], 'a', '2026-11-05T19:20:00Z'),
    ],
    goals: [
      { match_id: 'm1', team: 'a', scorer: 'a', assist: 'b' },
      { match_id: 'm2', team: 'a', scorer: 'a', assist: null },
      { match_id: 'old', team: 'a', scorer: 'g', assist: null },
    ],
    mvp: [{ match_id: 'm1', player_id: 'b', votes: 3 }],
  }
  const w = teamOfTheWeek(players, history, { size: 4 })
  assert.equal(w.night.id, 'n2')
  assert.equal(w.team.length, 4)
  assert.equal(w.team.filter((r) => r.id === 'k').length, 1) // the keeper is in
  assert.ok(!w.team.some((r) => r.id === 'g')) // didn't play that day
  assert.equal(w.star, 'a') // 2 wins + 2 goals = 10
  // Without MVP votes and assists, those points don't count.
  const plain = teamOfTheWeek(players, history, { size: 4, mvp: false, assists: false })
  assert.equal(plain.team.find((r) => r.id === 'b').points, 3)
  assert.equal(dayPoints({ wins: 1, draws: 1, goals: 1, assists: 1, mvp: 1 }), 3 + 1 + 2 + 1 + 2)
})

test('team of the week: none before a finished game, old news after a week', () => {
  assert.equal(teamOfTheWeek(players, { nights: [], matches: [], goals: [], mvp: [] }), null)
  const w = { night: { day: '2026-11-05' } }
  assert.ok(isFresh(w, '2026-11-12'))
  assert.ok(!isFresh(w, '2026-11-13'))
})

test('card colors and the next one', () => {
  assert.equal(tierOf(null), 'new')
  assert.equal(tierOf(64), 'bronze')
  assert.equal(tierOf(65), 'silver')
  assert.equal(tierOf(80), 'gold')
  assert.deepEqual(nextTier(60), { tier: 'silver', need: 5 })
  assert.deepEqual(nextTier(70), { tier: 'gold', need: 5 })
  assert.equal(nextTier(90), null)
})

test('card numbers: only what the group records, always six', () => {
  const s = { games: 6, wins: 3, goals: 4, assists: 2, mvp: 1, keeperGames: 0, bestStreak: 2, attendance: 0.5 }
  const keys = (o) => cardAttributes(s, o).map((a) => a.key)
  assert.deepEqual(keys(), ['games', 'winRate', 'mvp', 'goals', 'assists', 'bestStreak'])
  assert.deepEqual(keys({ mvp: false, assists: false }), ['games', 'winRate', 'goals', 'bestStreak', 'attendance', 'wins'])
})
