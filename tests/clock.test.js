import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextState, shownElapsed, REGULAR_MS, EXTRA_MS } from '../src/lib/clock.js'

const T0 = Date.parse('2026-10-31T18:00:00Z')
const live = (fields = {}) => ({ status: 'live', phase: 'regular', clock_ms: 0, running_since: new Date(T0).toISOString(), ...fields })
const goals = (a, b) => [...Array(a).fill({ team: 'a' }), ...Array(b).fill({ team: 'b' })]

test('nothing happens mid-match', () => {
  assert.equal(nextState(live(), goals(1, 2), T0 + 60_000), null)
})

test('third goal ends the match', () => {
  const s = nextState(live(), goals(1, 3), T0 + 120_000)
  assert.equal(s.status, 'finished')
  assert.equal(s.winner, 'b')
  assert.equal(s.clock_ms, 120_000)
})

test('time up with a leader ends the match at exactly 7:00', () => {
  const s = nextState(live(), goals(2, 1), T0 + REGULAR_MS + 5000)
  assert.equal(s.winner, 'a')
  assert.equal(s.clock_ms, REGULAR_MS)
})

test('tie at 7:00 goes to extra time with the clock stopped', () => {
  const s = nextState(live(), goals(1, 1), T0 + REGULAR_MS)
  assert.deepEqual(s, { phase: 'extra', clock_ms: REGULAR_MS, running_since: null })
})

test('phone asleep long past 7:00 still stops the clock at 7:00', () => {
  const m = live()
  assert.equal(shownElapsed(m, T0 + 20 * 60_000), REGULAR_MS)
  assert.equal(nextState(m, goals(0, 0), T0 + 20 * 60_000).clock_ms, REGULAR_MS)
})

test('3 goals ends the match during extra time', () => {
  const m = live({ phase: 'extra', clock_ms: REGULAR_MS })
  assert.equal(nextState(m, goals(3, 2), T0 + 30_000).winner, 'a')
})

test('tie at 9:00 goes to golden goal', () => {
  const m = live({ phase: 'extra', clock_ms: REGULAR_MS })
  assert.deepEqual(nextState(m, goals(2, 2), T0 + EXTRA_MS), { phase: 'golden', clock_ms: REGULAR_MS + EXTRA_MS, running_since: null })
})

test('extra time with a leader at 9:00 ends the match', () => {
  const m = live({ phase: 'extra', clock_ms: REGULAR_MS })
  assert.equal(nextState(m, goals(2, 1), T0 + EXTRA_MS).winner, 'a')
})

test('golden goal: next goal wins, no time limit', () => {
  const m = live({ phase: 'golden', clock_ms: REGULAR_MS + EXTRA_MS })
  assert.equal(nextState(m, goals(2, 2), T0 + 60 * 60_000), null)
  assert.equal(nextState(m, goals(2, 3), T0 + 60_000).winner, 'b')
})

test('paused clock does not run', () => {
  const m = live({ clock_ms: 90_000, running_since: null })
  assert.equal(shownElapsed(m, T0 + 10 * 60_000), 90_000)
  assert.equal(nextState(m, goals(0, 0), T0 + 10 * 60_000), null)
})

test('finished match never changes', () => {
  assert.equal(nextState(live({ status: 'finished' }), goals(5, 0), T0), null)
})

test('group rules saved on the match: 10 minutes, first to 5', () => {
  const m = live({ match_minutes: 10, win_goals: 5 })
  assert.equal(nextState(m, goals(1, 3), T0 + 60_000), null) // 3 goals is not enough
  assert.equal(nextState(m, goals(5, 1), T0 + 60_000).winner, 'a')
  assert.equal(nextState(m, goals(2, 1), T0 + REGULAR_MS + 5000), null) // 7 minutes is not the end
  assert.equal(nextState(m, goals(2, 1), T0 + 10 * 60_000).clock_ms, 10 * 60_000)
  assert.deepEqual(nextState(m, goals(1, 1), T0 + 10 * 60_000), { phase: 'extra', clock_ms: 10 * 60_000, running_since: null })
})

test('win_goals 0: only the clock ends the match', () => {
  const m = live({ win_goals: 0 })
  assert.equal(nextState(m, goals(9, 0), T0 + 60_000), null)
  assert.equal(nextState(m, goals(9, 0), T0 + REGULAR_MS).winner, 'a')
})
