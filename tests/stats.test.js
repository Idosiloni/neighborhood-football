import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStats, computeAwards, overall } from '../src/lib/stats.js'

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
