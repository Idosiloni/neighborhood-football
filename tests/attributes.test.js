import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardValues, combine, overallOf, toDisplay } from '../src/lib/attributes.js'

const OLD = '2020-01-01T00:00:00Z'
const r = (voter_id, player_id, attr, score, updated_at = OLD) => ({ voter_id, player_id, attr, score, updated_at })
const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']

test('display: 1 → 45, 3 → 70, 5 → 95', () => {
  assert.deepEqual([1, 3, 5, 3.4].map(toDisplay), [45, 70, 95, 75])
})

test('combine: pulled toward the group mean (same numbers as the database test)', () => {
  const ratings = []
  for (const v of ['p2', 'p3', 'p4']) ratings.push(r(v, 'p1', 'spd', 5), r(v, 'p5', 'spd', 1))
  const out = combine(ratings, ids)
  assert.equal(out.find((x) => x.player_id === 'p1').value, 4)
  assert.equal(out.find((x) => x.player_id === 'p5').value, 2)
})

test('combine: 5+ raters drop the extremes; a flat rater is left out; self, today and inactive never count', () => {
  const ratings = []
  for (const [v, sc] of Object.entries({ p1: 1, p2: 3, p3: 3, p4: 3, p5: 5 })) ratings.push(r(v, 'p0', 'def', sc), r(v, 'p6', 'def', sc === 3 ? 2 : 4))
  for (const pl of ['p0', 'p6', 'p8']) ratings.push(r('p7', pl, 'def', 4))
  ratings.push(r('p0', 'p0', 'def', 5), r('p8', 'p0', 'def', 5, new Date().toISOString()), r('gone', 'p0', 'def', 5))
  const p0 = combine(ratings, ids).find((x) => x.player_id === 'p0')
  assert.equal(p0.raters, 5)
  assert.equal(p0.value, 2.95)
})

test('overall: position weights; several positions = the best; null until every category it needs is there', () => {
  const v = { spd: 90, sht: 95, pas: 60, tec: 80, def: 50, fit: 70 }
  assert.deepEqual(overallOf(v, ['att']), { pos: 'att', value: 83 })
  assert.equal(overallOf(v, ['def', 'att']).pos, 'att')
  assert.equal(overallOf({ ...v, sht: null }, ['att']), null)
  assert.equal(overallOf({ ...v, sht: null }, ['def']).pos, 'def') // defenders don't need shooting
  assert.equal(overallOf({ gk_ref: 90, gk_han: 80, gk_pos: 80, gk_dis: 60 }, ['gk']).value, 81) // 80.5
  assert.equal(overallOf(v).pos, 'any')
})

test('card values: only categories with 3+ raters, as displayed numbers', () => {
  const rows = [{ player_id: 'a', attr: 'spd', value: '4', raters: 3 }, { player_id: 'a', attr: 'sht', value: 5, raters: 2 }]
  assert.deepEqual(cardValues(rows, 'a'), { spd: 83 })
})
