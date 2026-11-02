// New players this phone's owner hasn't put in his ranking yet (and didn't skip).
const KEY = 'placement-skipped'

export function skipped() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY)) ?? [])
  } catch {
    return new Set()
  }
}

export function skip(id) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...skipped(), id]))
  } catch {
    // fine: he'll just be asked again
  }
}

export function unplaced(players, me) {
  if (!me?.ranking) return []
  const ranked = new Set(me.ranking)
  const skip = skipped()
  return players.filter((p) => p.active && p.id !== me.id && !ranked.has(p.id) && !skip.has(p.id))
}
