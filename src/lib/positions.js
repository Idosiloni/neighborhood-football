import { sport } from '../sports/index.js'
import { t } from '../i18n/index.js'

// A player picks every position they play. Only goalkeeper = goalkeeper only (stays in goal,
// one per team). Nothing picked = plays anywhere (not in goal). Same rules as the database.
// The positions themselves come from the sport (src/sports/).
export const POSITIONS = sport.positions
const ORDER = POSITIONS.map((p) => p.id)
export const FIELD = POSITIONS.filter((p) => !p.keeper).map((p) => p.id)

// A player's positions, also for players saved before the list existed (one position + "can play in goal").
export function positionsOf(player) {
  if (Array.isArray(player?.positions) && (player.positions.length || (player.position === 'any' && !player.can_gk))) {
    return ORDER.filter((id) => player.positions.includes(id))
  }
  const { position = 'any', can_gk = false } = player ?? {}
  if (position === 'gk') return ['gk']
  if (FIELD.includes(position)) return can_gk ? ['gk', position] : [position]
  return can_gk ? [...ORDER] : []
}

export const isKeeperOnly = (positions) => positions.length === 1 && positions[0] === 'gk'

// The single position and "can play in goal" the team building still works with.
export function fromPositions(positions) {
  const list = ORDER.filter((id) => positions.includes(id))
  const field = list.filter((id) => id !== 'gk')
  return {
    positions: list,
    position: isKeeperOnly(list) ? 'gk' : field.length === 1 ? field[0] : 'any',
    can_gk: list.includes('gk'),
  }
}

// "הגנה · קישור", "שוער קבוע", "כל מקום" (or in English). short: for the card ("בלם/קשר", "DEF/MID").
export function positionsText(player, { short = false } = {}) {
  const list = positionsOf(player)
  if (isKeeperOnly(list)) return t(short ? 'sport.keeperOnlyShort' : 'sport.keeperOnly')
  const field = list.filter((id) => id !== 'gk')
  if (field.length === 0 || field.length === FIELD.length) {
    return t(list.includes('gk') && !short ? 'sport.anywhereAndGoal' : 'sport.anywhere')
  }
  const labels = list.map((id) => POSITIONS.find((p) => p.id === id)[short ? 'short' : 'label'])
  return labels.join(short ? '/' : ' · ')
}

export const EMOJIS = sport.emojis
