// The two teams' bib colors (the group's options team_a / team_b). The app paints everything
// team-colored through CSS variables (--team-a, --team-a-deep, --team-a-ink, same for b) on the page,
// and the team names follow the color ("האדומים", "Reds"). Set when the open group loads.
import { TEAM_COLORS } from './options.js'

// bg: the bib color; deep: its shadow; ink: text drawn on it (dark on white and yellow).
export const PALETTE = {
  blue: { bg: '#2563eb', deep: '#1a46ad', ink: '#ffffff' },
  orange: { bg: '#f2701c', deep: '#b8500d', ink: '#ffffff' },
  red: { bg: '#dc2626', deep: '#991b1b', ink: '#ffffff' },
  white: { bg: '#f4f6f8', deep: '#9aa7b4', ink: '#11241a' },
  black: { bg: '#1f2937', deep: '#030712', ink: '#ffffff' },
  yellow: { bg: '#facc15', deep: '#b58f05', ink: '#11241a' },
  green: { bg: '#15803d', deep: '#0b4d24', ink: '#ffffff' },
  purple: { bg: '#7c3aed', deep: '#5221a8', ink: '#ffffff' },
}

const KEY = 'team-colors' // remembered for the next start, so the colors don't flash
const DEFAULT = { a: 'blue', b: 'orange' }

function remembered() {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null')
    if (v && TEAM_COLORS.includes(v.a) && TEAM_COLORS.includes(v.b) && v.a !== v.b) return v
  } catch {
    // nothing saved
  }
  return DEFAULT
}

let colors = remembered()

export const teamColor = (side) => colors[side]

function paint() {
  const root = globalThis.document?.documentElement
  if (!root) return
  for (const side of ['a', 'b']) {
    const c = PALETTE[colors[side]]
    root.style.setProperty(`--team-${side}`, c.bg)
    root.style.setProperty(`--team-${side}-deep`, c.deep)
    root.style.setProperty(`--team-${side}-ink`, c.ink)
  }
}
paint()

// options: the group's options (team_a / team_b), or nothing for the usual blue and orange.
export function applyTeamColors(options) {
  const a = TEAM_COLORS.includes(options?.team_a) ? options.team_a : DEFAULT.a
  const b = TEAM_COLORS.includes(options?.team_b) ? options.team_b : DEFAULT.b
  colors = a === b ? DEFAULT : { a, b }
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(colors))
  } catch {
    // private mode
  }
  paint()
}
