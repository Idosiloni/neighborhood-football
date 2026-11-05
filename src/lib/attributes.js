// Category ratings ("advanced"): players rate each other 1–5 per category, relative to the group,
// and each player's card is built from everyone's ratings. The database combines them
// (private.attr_scores in supabase/schema.sql); combine() here is the same, for the demo and tests.
// Labels: stats.attrs.<id> in the language files.

// Field players: speed, shooting, passing, technique (ball control and dribbling), defending, fitness and effort.
export const FIELD_ATTRS = ['spd', 'sht', 'pas', 'tec', 'def', 'fit']
// Goalkeepers (only rated for players who play in goal): reflexes, handling, positioning, distribution.
export const GK_ATTRS = ['gk_ref', 'gk_han', 'gk_pos', 'gk_dis']
export const ALL_ATTRS = [...FIELD_ATTRS, ...GK_ATTRS]
export const MIN_RATERS = 3

// 1–5 (3 = about the group's average) as shown on the card: 1 → 45, 3 → 70, 5 → 95.
export const toDisplay = (v) => Math.round(45 + (v - 1) * 12.5)

// How much each category counts in the overall, by position (each row adds up to 100).
// Pace and fitness count more than in the pro game: they win small-sided games.
const WEIGHTS = {
  att: { spd: 20, sht: 35, pas: 10, tec: 20, def: 5, fit: 10 },
  mid: { spd: 10, sht: 10, pas: 30, tec: 20, def: 15, fit: 15 },
  def: { spd: 15, sht: 0, pas: 15, tec: 5, def: 45, fit: 20 },
  any: { spd: 17, sht: 17, pas: 17, tec: 17, def: 16, fit: 16 },
  gk: { gk_ref: 35, gk_han: 25, gk_pos: 25, gk_dis: 15 },
}

// The card's overall from the displayed values ({ spd: 82, … }) for the player's positions
// (several: the best of them). Null unless every category it needs has a value.
export function overallOf(values, positions = []) {
  const list = positions.length ? positions : ['any']
  const scores = list
    .map((pos) => {
      const w = Object.entries(WEIGHTS[pos] ?? WEIGHTS.any).filter(([, x]) => x > 0) // a 0 weight needs no value
      if (!w.every(([k]) => values[k] != null)) return null
      return { pos, value: Math.round(w.reduce((t, [k, x]) => t + x * values[k], 0) / w.reduce((t, [, x]) => t + x, 0)) }
    })
    .filter(Boolean)
  if (!scores.length) return null
  return scores.reduce((best, s) => (s.value > best.value ? s : best))
}

// Same steps as private.attr_scores. ratings: [{ voter_id, player_id, attr, score, updated_at }].
// before: only ratings older than this ISO time count (published once a day).
// Returns [{ player_id, attr, value (1–5), raters }] for every category with a rating.
export function combine(ratings, activeIds, { before = startOfToday() } = {}) {
  const active = new Set(activeIds)
  const base = ratings.filter(
    (r) => active.has(r.voter_id) && active.has(r.player_id) && r.voter_id !== r.player_id && (!before || r.updated_at < before),
  )
  // A rater who gave the same score to everyone in everything (3+ players) is left out.
  const byVoter = new Map()
  for (const r of base) byVoter.set(r.voter_id, [...(byVoter.get(r.voter_id) ?? []), r])
  const flat = new Set(
    [...byVoter].filter(([, rs]) => new Set(rs.map((r) => r.player_id)).size >= 3 && new Set(rs.map((r) => r.score)).size === 1).map(([v]) => v),
  )
  const kept = base.filter((r) => !flat.has(r.voter_id))
  const prior = new Map()
  for (const r of kept) prior.set(r.attr, [...(prior.get(r.attr) ?? []), r.score])
  const groups = new Map()
  for (const r of kept) {
    const key = `${r.player_id}|${r.attr}`
    groups.set(key, [...(groups.get(key) ?? []), r.score])
  }
  return [...groups].map(([key, scores]) => {
    const [player_id, attr] = key.split('|')
    const n = scores.length
    // 5+ raters: drop the highest and the lowest.
    const used = n >= 5 ? [...scores].sort((a, b) => a - b).slice(1, -1) : scores
    const mean = used.reduce((t, x) => t + x, 0) / used.length
    const c = prior.get(attr).reduce((t, x) => t + x, 0) / prior.get(attr).length
    // Pulled toward the group's mean as if 3 more average ratings were there.
    const value = Math.round(((mean * used.length + 3 * c) / (used.length + 3)) * 1000) / 1000
    return { player_id, attr, value, raters: n }
  })
}

function startOfToday() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()
}

// A player's card values from the published rows: { spd: 82, … } (only categories with enough raters).
export function cardValues(rows, playerId) {
  return Object.fromEntries(rows.filter((r) => r.player_id === playerId && r.raters >= MIN_RATERS).map((r) => [r.attr, toDisplay(Number(r.value))]))
}
