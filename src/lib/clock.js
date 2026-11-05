// Match clock and end-of-match rules. Pure functions, shared by the live screen and tests.
//
// A match stores: status ('live' | 'finished'), phase, period (1, 2, …), clock_ms (match time
// counted before the last start), running_since (ISO time the clock started, or null) and
// break_since (ISO time a half-time break started, or null).
// Elapsed time is always computed from timestamps, so it keeps counting while the phone sleeps.
//
// Phases:
//   'regular'   playing a period (a whole short match is one period)
//   'break'     half-time between periods; the match clock stands still, the break has its own timer
//   'extra'     extra time after a tie
//   'golden'    golden goal: the next goal wins, no time limit
//   'penalties' tied: penalties are taken on the field and the manager says who won
//
// The rules are the group's, frozen on the match when it started:
//   match_minutes, win_goals (columns) and rules = { periods, break_minutes, extra_minutes, tie }.
// Matches from before rules existed have none and behave as they always did: one period,
// 2 minutes of extra time, then golden goal (and 7 minutes, first to 3, for the oldest ones).

// The rules of matches saved before each match kept the group's own (7 minutes, first to 3).
export const REGULAR_MS = 7 * 60_000
export const WIN_GOALS = 3
export const EXTRA_MS = 2 * 60_000

// Tie rules: 'extra' = extra time (extra_minutes, may be 0) then golden goal; 'penalties'; 'draw'.
export const TIES = ['extra', 'penalties', 'draw']
export const RULE_DEFAULTS = { periods: 1, break_minutes: 5, extra_minutes: 2, tie: 'extra' }

export function rulesOf(match) {
  const r = { ...RULE_DEFAULTS, ...(match?.rules ?? {}) }
  return {
    periods: Math.max(1, r.periods),
    breakMs: r.break_minutes * 60_000,
    extraMs: r.extra_minutes * 60_000,
    tie: TIES.includes(r.tie) ? r.tie : 'extra',
  }
}

// One period's length.
export const periodMs = (match) => (match?.match_minutes ?? REGULAR_MS / 60_000) * 60_000
// All periods together: the regular time of the whole match.
export const regularMs = (match) => periodMs(match) * rulesOf(match).periods
// 0 = no goal limit, only the clock ends the match.
export const winGoals = (match) => match?.win_goals ?? WIN_GOALS
export const periodOf = (match) => match?.period ?? 1
export const extraMs = (match) => rulesOf(match).extraMs

// Where the clock must stop in the current phase.
export function limitFor(phase, match) {
  if (phase === 'regular') return periodMs(match) * periodOf(match)
  if (phase === 'extra') return regularMs(match) + extraMs(match)
  if (phase === 'break' || phase === 'penalties') return match.clock_ms // the clock stands still
  return Infinity // golden goal: no time limit
}

// Where the clock stands when the current phase begins.
export function phaseStart(match) {
  if (match.phase === 'regular') return periodMs(match) * (periodOf(match) - 1)
  if (match.phase === 'extra') return regularMs(match)
  if (match.phase === 'golden') return regularMs(match) + extraMs(match)
  return match.clock_ms
}

export function rawElapsed(match, now = Date.now()) {
  if (match.phase === 'break' || match.phase === 'penalties') return match.clock_ms
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

// 'a', 'b' or 'draw'.
export const resultOf = (s) => (s.a > s.b ? 'a' : s.b > s.a ? 'b' : 'draw')

// Decides whether the match must change state right now. Returns null, or the fields to save.
export function nextState(match, goals, now = Date.now()) {
  if (match.status !== 'live' || match.phase === 'break' || match.phase === 'penalties') return null
  const s = scoreOf(goals)
  const limit = limitFor(match.phase, match)
  const atLimit = rawElapsed(match, now) >= limit
  const nowIso = new Date(now).toISOString()

  const finish = (clock, winner = resultOf(s)) => ({
    status: 'finished',
    winner,
    clock_ms: clock,
    running_since: null,
    ended_at: nowIso,
  })
  // Stop the clock and wait for the manager to start what comes next.
  const wait = (phase) => ({ phase, clock_ms: limit, running_since: null })

  const goalsToWin = winGoals(match)
  if (goalsToWin > 0 && (s.a >= goalsToWin || s.b >= goalsToWin)) return finish(shownElapsed(match, now))
  if (match.phase === 'golden' && s.a !== s.b) return finish(shownElapsed(match, now))
  if (!atLimit) return null

  const { periods, tie } = rulesOf(match)
  if (match.phase === 'regular' && periodOf(match) < periods) {
    // End of a period: half-time (its own timer); the manager starts the next period.
    return { phase: 'break', clock_ms: limit, running_since: null, break_since: nowIso }
  }
  if (s.a !== s.b) return finish(limit)
  // Tied when time ran out.
  if (match.phase === 'regular') {
    if (tie === 'draw') return finish(limit, 'draw')
    if (tie === 'penalties') return wait('penalties')
    return wait(extraMs(match) > 0 ? 'extra' : 'golden')
  }
  return wait('golden') // tied after extra time
}

// The fields that start the clock: the next period after a break, or simply play on.
export function startFields(match, now = Date.now()) {
  const iso = new Date(now).toISOString()
  if (match.phase === 'break') return { phase: 'regular', period: periodOf(match) + 1, break_since: null, running_since: iso }
  return { running_since: iso }
}

// Half-time left (may be negative once the break is over), or null outside a break.
export function breakLeft(match, now = Date.now()) {
  if (match.phase !== 'break' || !match.break_since) return null
  return rulesOf(match).breakMs - (now - Date.parse(match.break_since))
}

export function formatClock(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Time left in the current phase (for the countdown), or null in golden goal.
export function remaining(match, now = Date.now()) {
  const limit = limitFor(match.phase, match)
  return limit === Infinity ? null : limit - shownElapsed(match, now)
}
