import { FIELD, isKeeperOnly, positionsOf } from './positions.js'

// Places a team on the pitch by the positions each player plays: keeper, defense, midfield, attack.
// A team without a goalkeeper-only player rotates in goal, so its keeper spot is "rotating".

const ROWS = ['def', 'mid', 'att']

// How many in each row for n outfield players: 5 → 2-2-1, 6 → 2-3-1, 4 → 2-1-1.
function targets(n) {
  const def = n <= 2 ? Math.min(n, 1) : Math.round(n * 0.4)
  const att = n >= 3 ? Math.max(1, Math.round(n * 0.2)) : n - def
  return { def, mid: n - def - att, att }
}

// Where an extra player of each position goes when his own row is full.
const FALLBACK = { def: ['mid', 'att'], mid: ['def', 'att'], att: ['mid', 'def'] }

export function formation(ids, byId) {
  const players = ids.map((id) => byId[id]).filter(Boolean)
  const keeper = players.find((p) => isKeeperOnly(positionsOf(p))) ?? null
  const outfield = players.filter((p) => p !== keeper)
  const want = targets(outfield.length)
  const rows = { def: [], mid: [], att: [] }
  const free = (row) => rows[row].length < want[row]

  const flexible = []
  // Players with one field position first, so those who play several fill the gaps.
  const prefsOf = (p) => positionsOf(p).filter((x) => FIELD.includes(x))
  const ordered = [...outfield].sort((x, y) => (prefsOf(x).length || 9) - (prefsOf(y).length || 9))
  for (const p of ordered) {
    const prefs = prefsOf(p)
    if (prefs.length === 0 || prefs.length === FIELD.length) flexible.push(p)
    else {
      const row = prefs.find(free) ?? FALLBACK[prefs[0]].find(free)
      if (row) rows[row].push(p)
      else flexible.push(p)
    }
  }
  for (const p of flexible) rows[ROWS.find(free) ?? 'mid'].push(p)

  const counts = ROWS.map((r) => rows[r].length).filter(Boolean)
  return {
    keeper,
    rotating: !keeper,
    rows,
    label: [keeper ? 1 : null, ...counts].filter((x) => x !== null).join('-'),
  }
}
