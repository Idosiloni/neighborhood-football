import { test } from 'node:test'
import assert from 'node:assert/strict'
import { breakLeft, nextState, remaining, resultOf, shownElapsed, startFields, REGULAR_MS, EXTRA_MS } from '../src/lib/clock.js'

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

// ── halves, breaks, ties (rules frozen on the match) ──

const MIN = 60_000
const game = (rules, fields = {}) => live({ match_minutes: 30, win_goals: 0, rules, ...fields })

test('no rules on the match (older matches): one period, 2 minutes of extra time', () => {
  const m = live({ match_minutes: 7, win_goals: 3 })
  assert.deepEqual(nextState(m, goals(0, 0), T0 + 7 * MIN), { phase: 'extra', clock_ms: 7 * MIN, running_since: null })
})

test('two halves: end of the first half starts half-time with its own timer, whatever the score', () => {
  const m = game({ periods: 2, break_minutes: 10 })
  const s = nextState(m, goals(2, 0), T0 + 31 * MIN)
  assert.deepEqual(s, { phase: 'break', clock_ms: 30 * MIN, running_since: null, break_since: new Date(T0 + 31 * MIN).toISOString() })
  const brk = { ...m, ...s }
  assert.equal(shownElapsed(brk, T0 + 50 * MIN), 30 * MIN) // the match clock stands still in the break
  assert.equal(nextState(brk, goals(2, 0), T0 + 90 * MIN), null) // the manager starts the second half
  assert.equal(breakLeft(brk, T0 + 35 * MIN), 6 * MIN)
  assert.ok(breakLeft(brk, T0 + 45 * MIN) < 0)
})

test('second half: starts at 30:00, the countdown is for this half, a leader at 60:00 wins', () => {
  const brk = game({ periods: 2 }, { phase: 'break', clock_ms: 30 * MIN, running_since: null, break_since: new Date(T0).toISOString() })
  const second = { ...brk, ...startFields(brk, T0 + 10 * MIN) }
  assert.equal(second.phase, 'regular')
  assert.equal(second.period, 2)
  assert.equal(second.break_since, null)
  assert.equal(shownElapsed(second, T0 + 20 * MIN), 40 * MIN)
  assert.equal(remaining(second, T0 + 20 * MIN), 20 * MIN)
  const end = nextState(second, goals(1, 2), T0 + 45 * MIN)
  assert.equal(end.winner, 'b')
  assert.equal(end.clock_ms, 60 * MIN)
})

test('tie rule "draw": a tie at full time is a draw', () => {
  const m = game({ periods: 1, tie: 'draw' })
  const s = nextState(m, goals(1, 1), T0 + 30 * MIN)
  assert.equal(s.status, 'finished')
  assert.equal(s.winner, 'draw')
})

test('tie rule "penalties": the clock stops and waits for the manager', () => {
  const m = game({ tie: 'penalties' })
  assert.deepEqual(nextState(m, goals(2, 2), T0 + 30 * MIN), { phase: 'penalties', clock_ms: 30 * MIN, running_since: null })
  const pens = { ...m, phase: 'penalties', clock_ms: 30 * MIN, running_since: null }
  assert.equal(nextState(pens, goals(2, 2), T0 + 99 * MIN), null)
})

test('extra time of 0 minutes: a tie goes straight to golden goal', () => {
  const m = live({ match_minutes: 8, win_goals: 3, rules: { extra_minutes: 0 } })
  assert.deepEqual(nextState(m, goals(1, 1), T0 + 8 * MIN), { phase: 'golden', clock_ms: 8 * MIN, running_since: null })
})

test('extra time follows the match rules (5 minutes), then golden goal', () => {
  const m = live({ match_minutes: 8, win_goals: 3, rules: { extra_minutes: 5 }, phase: 'extra', clock_ms: 8 * MIN })
  assert.equal(nextState(m, goals(1, 1), T0 + 4 * MIN), null)
  assert.deepEqual(nextState(m, goals(1, 1), T0 + 5 * MIN), { phase: 'golden', clock_ms: 13 * MIN, running_since: null })
})

test('goal limit still ends a two-half game early', () => {
  const m = game({ periods: 2 }, { win_goals: 5, period: 2, clock_ms: 30 * MIN })
  assert.equal(nextState(m, goals(5, 1), T0 + MIN).winner, 'a')
})

test('resultOf: leader or draw', () => {
  assert.equal(resultOf({ a: 2, b: 1 }), 'a')
  assert.equal(resultOf({ a: 0, b: 1 }), 'b')
  assert.equal(resultOf({ a: 3, b: 3 }), 'draw')
})
