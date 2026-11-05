// Team of the Week: the best players of the last game day, as one team on the pitch.
// From that day's finished matches only, and only from what the group records
// (no MVP points when it doesn't vote, no assist points when it doesn't record them).
import { computeStats } from './stats.js'
import { isKeeperOnly, positionsOf } from './positions.js'

// Points for a game day: a win 3, a draw 1, a goal 2, an assist 1, a match MVP 2.
export function dayPoints(s, { mvp = true, assists = true } = {}) {
  return s.wins * 3 + s.draws + s.goals * 2 + (assists ? s.assists : 0) + (mvp ? s.mvp * 2 : 0)
}

// The last game day with finished matches: { night, team: [{ id, points, games, wins, goals, assists, mvp }],
// star: the id with the most points } or null. size: players in the team (the group's team size);
// one of them a goalkeeper when a goalkeeper played that day.
export function teamOfTheWeek(players, history, { size = 6, mvp = true, assists = true } = {}) {
  const done = history.matches.filter((m) => m.status === 'finished' && m.winner)
  const nights = new Map(history.nights.map((n) => [n.id, n]))
  const last = [...new Set(done.map((m) => m.night_id))]
    .map((id) => nights.get(id))
    .filter(Boolean)
    .sort((x, y) => y.day.localeCompare(x.day))[0]
  if (!last) return null

  const matches = done.filter((m) => m.night_id === last.id)
  const ids = new Set(matches.map((m) => m.id))
  const goals = history.goals.filter((g) => ids.has(g.match_id))
  const votes = (history.mvp ?? []).filter((v) => ids.has(v.match_id))
  const stats = computeStats(players, matches, goals, votes)
  const byId = Object.fromEntries(players.map((p) => [p.id, p]))

  const ranked = stats.players
    .filter((s) => s.games > 0 && byId[s.id])
    .map((s) => ({ id: s.id, points: dayPoints(s, { mvp, assists }), games: s.games, wins: s.wins, goals: s.goals, assists: s.assists, mvp: s.mvp }))
    .sort((x, y) => y.points - x.points || y.wins / y.games - x.wins / x.games || y.goals - x.goals || byId[x.id].name.localeCompare(byId[y.id].name))
  if (ranked.length < 2) return null

  const keeperOnly = (r) => isKeeperOnly(positionsOf(byId[r.id]))
  const keeper = ranked.find(keeperOnly)
  const outfield = ranked.filter((r) => !keeperOnly(r))
  const team = keeper ? [keeper, ...outfield.slice(0, size - 1)] : outfield.slice(0, size)
  team.sort((x, y) => y.points - x.points)
  return { night: last, team, star: ranked[0].id }
}

// Shown until the next game day; after a week without games it is old news.
export function isFresh(week, today) {
  if (!week) return false
  return (Date.parse(today) - Date.parse(week.night.day)) / 86400000 <= 7
}
