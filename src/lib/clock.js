// Match clock and end-of-match rules. Pure functions, shared by the live screen and tests.
//
// A match stores: status ('live' | 'finished'), phase ('regular' | 'extra' | 'golden'),
// clock_ms (time counted before the last start) and running_since (ISO time or null).
// Elapsed time is always computed from timestamps, so it keeps counting while the phone sleeps.
// The rules (minutes, goals to win) are the group's, saved on the match when it started;
// matches from before that have none and use the old 7 minutes, first to 3.

import { sport } from '../sports/index.js'

// The rules of matches saved before each match kept the group's own (7 minutes, first to 3).
export const REGULAR_MS = 7 * 60_000
export const WIN_GOALS = 3
export const EXTRA_MS = sport.extraMinutes * 60_000

export const regularMs = (match) => (match?.match_minutes ?? REGULAR_MS / 60_000) * 60_000
// 0 = no goal limit, only the clock ends the match.
export const winGoals = (match) => match?.win_goals ?? WIN_GOALS

export function limitFor(phase, match) {
  if (phase === 'regular') return regularMs(match)
  if (phase === 'extra') return regularMs(match) + EXTRA_MS
  return Infinity // golden goal: no time limit
}

// Where the clock stands when a phase begins.
export const phaseStart = (match) => ({ regular: 0, extra: regularMs(match), golden: regularMs(match) + EXTRA_MS })[match.phase]

export function rawElapsed(match, now = Date.now()) {
  const running = match.running_since ? now - Date.parse(match.running_since) : 0
  return match.clock_ms + Math.max(0, running)
}

// What the clock shows: never past the end of the current phase.
export function shownElapsed(match, now = Date.now()) {
  return Math.min(rawElapsed(match, now), limitFor(match.phase, match))
}

export function scoreOf(goals) {
  return {
    a: goals.filter((g) => g.team === 'a').length,
    b: goals.filter((g) => g.team === 'b').length,
  }
}

const leader = (s) => (s.a > s.b ? 'a' : 'b')

// Decides whether the match must change state right now. Returns null, or the fields to save.
export function nextState(match, goals, now = Date.now()) {
  if (match.status !== 'live') return null
  const s = scoreOf(goals)
  const limit = limitFor(match.phase, match)
  const atLimit = rawElapsed(match, now) >= limit

  const finish = (clock) => ({
    status: 'finished',
    winner: leader(s),
    clock_ms: clock,
    running_since: null,
    ended_at: new Date(now).toISOString(),
  })

  const goalsToWin = winGoals(match)
  if (goalsToWin > 0 && (s.a >= goalsToWin || s.b >= goalsToWin)) return finish(shownElapsed(match, now))
  if (match.phase === 'golden' && s.a !== s.b) return finish(shownElapsed(match, now))
  if (!atLimit) return null
  if (s.a !== s.b) return finish(limit)
  // Tied when time ran out: stop the clock and wait for the manager to start the next phase.
  return { phase: match.phase === 'regular' ? 'extra' : 'golden', clock_ms: limit, running_since: null }
}

export function formatClock(ms) {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Time left in the current phase (for the countdown), or null in golden goal.
export function remaining(match, now = Date.now()) {
  const limit = limitFor(match.phase, match)
  return limit === Infinity ? null : limit - shownElapsed(match, now)
}
