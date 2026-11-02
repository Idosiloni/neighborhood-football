// Same math as admin_ratings() in supabase/schema.sql, used by the offline demo.
// Each ballot is trimmed to active players (never the voter), then each place
// becomes a score from 100 (first) to 0 (last) so short and long ballots weigh the same.
export function computeRatings(players, ballots) {
  const active = new Set(players.filter((p) => p.active).map((p) => p.id))
  const totals = new Map()

  for (const ballot of ballots) {
    if (!ballotCounts(ballot)) continue
    const list = ballot.ranking.filter((id) => active.has(id) && id !== ballot.voter_id)
    list.forEach((id, i) => {
      const s = list.length === 1 ? 0.5 : 1 - i / (list.length - 1)
      const t = totals.get(id) ?? { sum: 0, rankSum: 0, votes: 0 }
      t.sum += s
      t.rankSum += i + 1
      t.votes += 1
      totals.set(id, t)
    })
  }

  const voted = new Set(ballots.map((b) => b.voter_id))
  return players
    .filter((p) => p.active)
    .map((p) => {
      const t = totals.get(p.id)
      return {
        player_id: p.id,
        score: t ? Math.round((t.sum / t.votes) * 1000) / 10 : null,
        avg_rank: t ? Math.round((t.rankSum / t.votes) * 10) / 10 : null,
        votes: t ? t.votes : 0,
        has_voted: voted.has(p.id),
      }
    })
}

// How many players the voter moved from alphabetical order (the order a first ballot starts in):
// the count minus the longest run already in that order. Same as private.moved_count.
export function movedCount(ranking, playersById, compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {
  const ids = ranking.filter((id) => playersById[id])
  const byName = [...ids].sort((x, y) => compare(playersById[x].name, playersById[y].name) || compare(x, y))
  const pos = new Map(byName.map((id, i) => [id, i]))
  const tails = []
  for (const id of ids) {
    const x = pos.get(id)
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tails[mid] < x) lo = mid + 1
      else hi = mid
    }
    tails[lo] = x
  }
  return ids.length - tails.length
}

// A ballot saved without moving anybody (3+ players) doesn't count. Same as private.ballot_counts.
export const ballotCounts = (b) => b.moved == null || b.moved > 0 || b.ranking.length < 3
