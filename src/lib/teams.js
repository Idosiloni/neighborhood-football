// Team building rules. The demo runs these in the browser; the live app runs the same rules
// in the database (supabase/schema.sql: make_teams, suggest_rotation) so ratings stay private.
// Keep both in sync.

export const TEAM_SIZE = 6

// Fewest players present to split into two teams: 8 for 6 a side, 6 for small sides, 18 for 11 a side.
// Same as private.min_players in the database.
export const minPlayers = (teamSize = TEAM_SIZE) => Math.min(2 * teamSize, Math.max(6, 2 * teamSize - 4))

const isKeeper = (p) => p.position === 'gk' // "goalkeeper only" player
const sum = (ids, ratingOf) => ids.reduce((t, id) => t + ratingOf(id), 0)

function shuffle(list, random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Difference in strength between two teams. With unequal sizes, compare averages.
export function imbalance(a, b, ratingOf) {
  if (a.length === b.length) return Math.abs(sum(a, ratingOf) - sum(b, ratingOf))
  const avg = (ids) => (ids.length ? sum(ids, ratingOf) / ids.length : 0)
  return Math.abs(avg(a) - avg(b)) * Math.max(a.length, b.length)
}

// Splits players into two balanced teams. Goalkeepers-only are spread one per team.
// Picks randomly among near-best splits so "re-roll" gives a different answer.
export function splitTeams(players, ratingOf, { samples = 1500, noise = 4, random = Math.random } = {}) {
  const keepers = players.filter(isKeeper).map((p) => p.id)
  const rest = players.filter((p) => !isKeeper(p)).map((p) => p.id)
  const sizeA = Math.ceil(players.length / 2)
  let best = null

  for (let i = 0; i < samples; i++) {
    const a = []
    const b = []
    // Alternate keepers between teams first, then fill with everyone else.
    shuffle(keepers, random).forEach((id, k) => (k % 2 === 0 ? a : b).push(id))
    for (const id of shuffle(rest, random)) (a.length < sizeA ? a : b).push(id)
    if (a.length !== sizeA) continue // more keepers than fit on one side; skip this sample
    const cost = imbalance(a, b, ratingOf) + random() * noise
    if (!best || cost < best.cost) best = { cost, a, b }
  }
  return { a: best.a, b: best.b }
}

// Who sits out the first match: whoever sat out least (tonight, then ever),
// then whoever arrived last. Keepers-only sit last when there are 2 or fewer of them.
export function suggestBench(present, matches, count, random = Math.random) {
  if (count <= 0) return []
  const sits = (id, list) => list.filter((m) => m.bench.includes(id)).length
  const keeperCount = present.filter(isKeeper).length
  const tonight = matches.filter((m) => m.night_id === present[0]?.night_id)
  const jitter = new Map(present.map((p) => [p.id, random()]))

  return [...present]
    .sort(
      (x, y) =>
        (keeperCount <= 2 ? Number(isKeeper(x)) - Number(isKeeper(y)) : 0) ||
        sits(x.id, tonight) - sits(y.id, tonight) ||
        sits(x.id, matches) - sits(y.id, matches) ||
        String(y.arrived_at ?? '').localeCompare(String(x.arrived_at ?? '')) ||
        jitter.get(x.id) - jitter.get(y.id),
    )
    .slice(0, count)
    .map((p) => p.id)
}

// Consecutive matches tonight the player has played, counting back from the latest.
export function playStreak(id, tonightMatches) {
  let streak = 0
  for (const m of [...tonightMatches].sort((x, y) => y.num - x.num)) {
    if (!m.team_a.includes(id) && !m.team_b.includes(id)) break
    streak++
  }
  return streak
}

const playedCount = (id, tonightMatches) =>
  tonightMatches.filter((m) => m.team_a.includes(id) || m.team_b.includes(id)).length

function combinations(list, k) {
  if (k === 0) return [[]]
  if (list.length < k) return []
  const [first, ...rest] = list
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)]
}

// After a match: the winner stays, everyone waiting comes in, and the same number leave the losing team.
// Who leaves: longest streak of games in a row first, then most games tonight; strength breaks ties.
// A goalkeeper-only player on the losing team stays, unless a goalkeeper-only player is waiting to come in.
export function suggestRotation({ match, presentIds, playersById, ratingOf, tonightMatches, teamSize = TEAM_SIZE, random = Math.random }) {
  const present = new Set(presentIds)
  const winSide = match.winner
  const loseSide = winSide === 'a' ? 'b' : 'a'
  const keeper = (id) => isKeeper(playersById[id] ?? {})
  const priority = (id) => playStreak(id, tonightMatches) * 10 + playedCount(id, tonightMatches)
  const size = Math.min(teamSize, Math.floor(presentIds.length / 2))

  let W = match[`team_${winSide}`].filter((id) => present.has(id))
  const L = match[`team_${loseSide}`].filter((id) => present.has(id))
  if (W.length > size) {
    // People went home and teams got smaller: the winners' most tired players move over.
    const jitter = new Map(W.map((id) => [id, random()]))
    const extra = W.filter((id) => !keeper(id))
      .sort((x, y) => priority(y) - priority(x) || jitter.get(x) - jitter.get(y))
      .slice(0, W.length - size)
    W = W.filter((id) => !extra.includes(id))
  }
  const waiting = presentIds.filter((id) => !W.includes(id) && !L.includes(id))
  const slots = 2 * size - W.length
  const fillW = Math.max(0, size - W.length)

  let entering
  let leaving
  if (waiting.length >= slots) {
    // More people waiting than places: the whole losing team rests (except its keeper,
    // unless a keeper is waiting to replace him), and those who played least tonight come in.
    const waitingKeeper = waiting.find(keeper)
    const keep = waitingKeeper ? [] : L.filter(keeper).slice(0, slots)
    leaving = L.filter((id) => !keep.includes(id))
    const jitter = new Map(waiting.map((id) => [id, random()]))
    const rest = waiting
      .filter((id) => id !== waitingKeeper)
      .sort((x, y) => playedCount(x, tonightMatches) - playedCount(y, tonightMatches) || jitter.get(x) - jitter.get(y))
    entering = (waitingKeeper ? [waitingKeeper, ...rest] : rest).slice(0, slots - keep.length)
  } else {
    entering = waiting
    const k = L.length + waiting.length - slots
    const forced = waiting.some(keeper) ? L.filter(keeper).slice(0, k) : []
    let candidates = L.filter((id) => !keeper(id))
    if (candidates.length < k - forced.length) candidates = L.filter((id) => !forced.includes(id))
    leaving = forced
    if (k - forced.length > 0) {
      let best = null
      const jitter = new Map(L.map((id) => [id, random()]))
      for (const combo of combinations(candidates, k - forced.length)) {
        const out = [...forced, ...combo]
        const pool = [...L.filter((id) => !out.includes(id)), ...entering]
        const { cost } = bestFill(W, pool, fillW, ratingOf, keeper)
        const score =
          -combo.reduce((t, id) => t + priority(id), 0) + 0.3 * cost + combo.reduce((t, id) => t + jitter.get(id), 0) * 0.01
        if (!best || score < best.score) best = { score, out }
      }
      leaving = best.out
    }
  }

  const pool = [...L.filter((id) => !leaving.includes(id)), ...entering]
  const { fill } = bestFill(W, pool, fillW, ratingOf, keeper)
  const winnerTeam = [...W, ...fill]
  const newTeam = pool.filter((id) => !fill.includes(id))
  const bench = presentIds.filter((id) => !winnerTeam.includes(id) && !newTeam.includes(id))

  return {
    team_a: winSide === 'a' ? winnerTeam : newTeam,
    team_b: winSide === 'b' ? winnerTeam : newTeam,
    bench,
    leaving,
    entering,
  }
}

// If the winning team is short (someone went home), pick who joins it to keep teams even.
// A goalkeeper-only player stays with his team when there are enough others to move.
function bestFill(W, pool, fillW, ratingOf, keeper) {
  if (fillW === 0) return { fill: [], cost: imbalance(W, pool, ratingOf) }
  const field = pool.filter((id) => !keeper(id))
  const candidates = field.length >= fillW ? field : pool
  let best = null
  for (const fill of combinations(candidates, Math.min(fillW, candidates.length))) {
    const cost = imbalance([...W, ...fill], pool.filter((id) => !fill.includes(id)), ratingOf)
    if (!best || cost < best.cost) best = { fill, cost }
  }
  return best
}
