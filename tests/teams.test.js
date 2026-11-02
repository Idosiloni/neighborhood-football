import { test } from 'node:test'
import assert from 'node:assert/strict'
import { minPlayers, splitTeams, suggestRotation, suggestBench, imbalance, playStreak } from '../src/lib/teams.js'

// Small seeded random so tests are repeatable.
function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
}

const mk = (n, keepers = []) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, position: keepers.includes(i) ? 'gk' : 'any' }))
const ratings = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, 100 - i * 8]))

function bestPossible(ids, ratingOf) {
  let best = Infinity
  const n = ids.length
  for (let mask = 0; mask < 1 << n; mask++) {
    let bits = 0
    for (let i = 0; i < n; i++) if (mask & (1 << i)) bits++
    if (bits !== Math.ceil(n / 2)) continue
    const a = ids.filter((_, i) => mask & (1 << i))
    const b = ids.filter((_, i) => !(mask & (1 << i)))
    best = Math.min(best, imbalance(a, b, ratingOf))
  }
  return best
}

test('split: 12 players → two teams of 6, close to the best possible', () => {
  const players = mk(12)
  const r = ratings(12)
  const ratingOf = (id) => r[id]
  const best = bestPossible(players.map((p) => p.id), ratingOf)
  for (let s = 1; s <= 20; s++) {
    const { a, b } = splitTeams(players, ratingOf, { random: seeded(s) })
    assert.equal(a.length, 6)
    assert.equal(b.length, 6)
    assert.equal(new Set([...a, ...b]).size, 12)
    assert.ok(imbalance(a, b, ratingOf) <= best + 4, `seed ${s}: ${imbalance(a, b, ratingOf)} vs best ${best}`)
  }
})

test('split: re-roll gives different teams', () => {
  const players = mk(12)
  const ratingOf = () => 50
  const seen = new Set()
  for (let s = 1; s <= 10; s++) seen.add(splitTeams(players, ratingOf, { random: seeded(s) }).a.sort().join())
  assert.ok(seen.size > 5)
})

test('split: two keepers-only end up on different teams', () => {
  const players = mk(12, [0, 1])
  for (let s = 1; s <= 20; s++) {
    const { a, b } = splitTeams(players, () => 50, { random: seeded(s) })
    assert.ok(a.includes('p0') !== a.includes('p1'), `seed ${s}`)
    assert.ok(b.includes('p0') !== b.includes('p1'))
  }
})

test('split: odd number → 6 v 5', () => {
  const { a, b } = splitTeams(mk(11), () => 50, { random: seeded(3) })
  assert.equal(a.length, 6)
  assert.equal(b.length, 5)
})

// Tonight: match 1 had p0..p5 (A) v p6..p11 (B), p12 p13 waiting.
const night = (extra = {}) => ({
  num: 1, night_id: 'n', team_a: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'], team_b: ['p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
  bench: ['p12', 'p13'], winner: 'a', ...extra,
})

test('rotation: winner stays, all waiting come in, same number leave the loser', () => {
  const m = night()
  const players = mk(14)
  const res = suggestRotation({
    match: m, presentIds: players.map((p) => p.id), playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    ratingOf: () => 50, tonightMatches: [m], random: seeded(1),
  })
  assert.deepEqual(res.team_a, m.team_a)
  assert.equal(res.team_b.length, 6)
  assert.ok(res.team_b.includes('p12') && res.team_b.includes('p13'))
  assert.equal(res.leaving.length, 2)
  assert.ok(res.leaving.every((id) => m.team_b.includes(id)))
  assert.deepEqual([...res.bench].sort(), [...res.leaving].sort())
})

test('rotation: longest streak leaves first', () => {
  // p6 and p7 also played the match before (streak 2), the rest of B just came in.
  const m0 = { num: 0, night_id: 'n', team_a: ['p6', 'p7', 'p0', 'p1', 'p2', 'p3'], team_b: ['p4', 'p5', 'p12', 'p13'], bench: ['p8', 'p9', 'p10', 'p11'], winner: 'b' }
  const m = night()
  const players = mk(14)
  const res = suggestRotation({
    match: m, presentIds: players.map((p) => p.id), playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    ratingOf: () => 50, tonightMatches: [m0, m], random: seeded(2),
  })
  assert.deepEqual([...res.leaving].sort(), ['p6', 'p7'])
})

test('rotation: losing team keeps its goalkeeper-only player', () => {
  const players = mk(14, [6])
  const m = night()
  for (let s = 1; s <= 10; s++) {
    const res = suggestRotation({
      match: m, presentIds: players.map((p) => p.id), playersById: Object.fromEntries(players.map((p) => [p.id, p])),
      ratingOf: () => 50, tonightMatches: [m], random: seeded(s),
    })
    assert.ok(res.team_b.includes('p6'))
  }
})

test('rotation: a waiting keeper-only replaces the losing keeper-only', () => {
  const players = mk(14, [6, 12])
  const m = night()
  const res = suggestRotation({
    match: m, presentIds: players.map((p) => p.id), playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    ratingOf: () => 50, tonightMatches: [m], random: seeded(1),
  })
  assert.ok(res.leaving.includes('p6'))
  assert.ok(res.team_b.includes('p12'))
  assert.equal(res.leaving.length, 2)
})

test('rotation: strength breaks ties between equally tired players', () => {
  const players = mk(13)
  const m = { ...night(), bench: ['p12'] }
  const r = { ...Object.fromEntries(players.map((p) => [p.id, 50])), p12: 90, p6: 90 }
  const res = suggestRotation({
    match: m, presentIds: players.map((p) => p.id), playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    ratingOf: (id) => r[id], tonightMatches: [m], random: seeded(4),
  })
  // A strong player comes in, so the strong p6 should be the one to rest.
  assert.deepEqual(res.leaving, ['p6'])
})

test('rotation: newcomer who arrived mid-match is waiting; someone who went home is dropped', () => {
  const players = mk(15)
  const m = night()
  const present = players.map((p) => p.id).filter((id) => id !== 'p3') // p3 went home, p14 arrived
  const res = suggestRotation({
    match: m, presentIds: present, playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    ratingOf: () => 50, tonightMatches: [m], random: seeded(1),
  })
  assert.equal(res.team_a.length, 6) // winner refilled to 6
  assert.ok(!res.team_a.includes('p3'))
  assert.equal(res.team_b.length, 6)
  assert.equal(res.team_a.length + res.team_b.length + res.bench.length, 14)
})

test('rotation: no one waiting → same teams', () => {
  const players = mk(12)
  const m = { ...night(), bench: [] }
  const res = suggestRotation({
    match: m, presentIds: players.map((p) => p.id), playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    ratingOf: () => 50, tonightMatches: [m], random: seeded(1),
  })
  assert.deepEqual(res.leaving, [])
  assert.deepEqual([...res.team_b].sort(), [...m.team_b].sort())
})

test('bench: least sat-out sit first, keepers-only protected', () => {
  const present = mk(14, [0]).map((p, i) => ({ ...p, night_id: 'n', arrived_at: `2026-10-31T18:${String(i).padStart(2, '0')}:00Z` }))
  const history = [{ night_id: 'old', team_a: [], team_b: [], bench: ['p13', 'p12'] }]
  const bench = suggestBench(present, history, 2, seeded(1))
  assert.equal(bench.length, 2)
  assert.ok(!bench.includes('p13') && !bench.includes('p12') && !bench.includes('p0'))
  assert.deepEqual(bench, ['p11', 'p10']) // latest arrivals among those who never sat
})

test('streak counts back from the latest match', () => {
  const ms = [{ num: 1, team_a: ['x'], team_b: [] }, { num: 2, team_a: [], team_b: [] }, { num: 3, team_a: ['x'], team_b: [] }, { num: 4, team_a: [], team_b: ['x'] }]
  assert.equal(playStreak('x', ms), 2)
})

const rotateWith = ({ n, keepers = [], match, present, ratings = {} }) => {
  const players = mk(n, keepers)
  return suggestRotation({
    match, presentIds: present ?? players.map((p) => p.id), playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    ratingOf: (id) => ratings[id] ?? 50, tonightMatches: [match], random: seeded(5),
  })
}

test('rotation: people went home → winner gives players so teams are even (5 v 5)', () => {
  // 10 left: winners p0..p5 all still here, losers only p6..p9.
  const m = { ...night(), bench: [] }
  const present = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']
  const res = rotateWith({ n: 14, match: m, present })
  assert.equal(res.team_a.length, 5)
  assert.equal(res.team_b.length, 5)
  assert.deepEqual(res.bench, [])
})

test('rotation: more waiting than places → a waiting keeper-only replaces the losing one', () => {
  const m = night()
  const res = rotateWith({ n: 18, keepers: [6, 13], match: m })
  assert.ok(res.leaving.includes('p6'))
  assert.ok(res.team_b.includes('p13'))
  assert.equal(res.team_b.length, 6)
})

test('rotation: refilling a short winning team never takes the losers\' keeper-only', () => {
  // p5 went home; p6 is the losers' only goalkeeper, listed first.
  const m = { ...night(), bench: [] }
  const present = ['p0', 'p1', 'p2', 'p3', 'p4', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']
  const res = rotateWith({ n: 13, keepers: [6], match: m, present })
  assert.ok(!res.team_a.includes('p6'))
  assert.ok(res.team_b.includes('p6'))
  assert.equal(res.team_a.length, 6)
})

test('minPlayers: 8 for 6 a side, 6 for small sides, 18 for 11 a side (same as the database)', () => {
  assert.deepEqual([3, 4, 5, 6, 7, 11].map(minPlayers), [6, 6, 6, 8, 10, 18])
})
