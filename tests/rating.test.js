import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ballotCounts, computeRatings, movedCount } from '../src/lib/rating.js'

const players = ['Avi', 'Ben', 'Dan', 'Eli', 'Gil'].map((name) => ({ id: name.toLowerCase(), name, active: true }))
const byId = Object.fromEntries(players.map((p) => [p.id, p]))

test('movedCount: 0 when saved in ABC order, else how many were moved (same as the database)', () => {
  assert.equal(movedCount(['ben', 'dan', 'eli', 'gil'], byId), 0)
  assert.equal(movedCount(['gil', 'avi', 'dan', 'eli'], byId), 1)
  assert.equal(movedCount(['gil', 'eli', 'ben', 'avi'], byId), 3)
})

test('an untouched ballot of 3+ players does not count; short or old ballots do', () => {
  assert.equal(ballotCounts({ ranking: ['a', 'b', 'c'], moved: 0 }), false)
  assert.equal(ballotCounts({ ranking: ['a', 'b'], moved: 0 }), true)
  assert.equal(ballotCounts({ ranking: ['a', 'b', 'c'], moved: null }), true)
  const r = computeRatings(players, [
    { voter_id: 'avi', ranking: ['ben', 'dan', 'eli', 'gil'], moved: 0 },
    { voter_id: 'ben', ranking: ['gil', 'avi', 'dan', 'eli'], moved: 1 },
  ])
  assert.equal(r.find((x) => x.player_id === 'gil').score, 100)
})
