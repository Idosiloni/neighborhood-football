// The card color this phone last showed for each player, so a move up (bronze → silver → gold)
// can be revealed once. The first time a card is seen nothing is revealed, only remembered.
import { TIER_ORDER } from './stats.js'

const KEY = 'card-seen' // { [player id]: tier }

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export function seenTier(id) {
  return read()[id] ?? null
}

export function rememberTier(id, tier) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: tier }))
  } catch {
    // private mode: nothing remembered, nothing revealed
  }
}

// True when the card went up since this phone last showed it (never on the first look).
export function wentUp(id, tier) {
  const before = seenTier(id)
  return before != null && TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(before)
}
