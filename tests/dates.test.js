import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextGameDay } from '../src/lib/dates.js'

test('weekday → the coming Saturday', () => {
  assert.equal(nextGameDay(new Date(2026, 10, 3, 20, 0)), '2026-11-07') // Tuesday evening
})

test('Saturday morning → today; Saturday evening → next week', () => {
  assert.equal(nextGameDay(new Date(2026, 9, 31, 8, 0)), '2026-10-31')
  assert.equal(nextGameDay(new Date(2026, 9, 31, 12, 0)), '2026-10-31')
  assert.equal(nextGameDay(new Date(2026, 9, 31, 20, 0)), '2026-11-07')
})

test('Friday night → tomorrow', () => {
  assert.equal(nextGameDay(new Date(2026, 10, 6, 23, 30)), '2026-11-07')
})
