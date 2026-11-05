// Everything about the game itself that another sport would change: positions, default rules,
// the choices offered when opening a group, and the words. The rest of the app reads it from here.
// The words themselves are in the language files (src/i18n/*/sport.js). (Adding a sport: see docs/sports.md.)
import { t } from '../i18n/index.js'

// label / short are read when shown, in the language of that moment.
const position = (id, extra = {}) => ({
  id,
  ...extra,
  get label() {
    return t(`sport.positions.${id}.label`)
  },
  get short() {
    return t(`sport.positions.${id}.short`)
  },
})

export default {
  id: 'football',
  get name() {
    return t('sport.name')
  },
  emoji: '⚽',

  // In this order on the card and in forms. keeper: "only this" = stays in goal, one per team.
  positions: [position('gk', { keeper: true }), position('def'), position('mid'), position('att')],

  // A new group's rules (the database has the same defaults and limits).
  rules: { team_size: 6, match_minutes: 7, win_goals: 3 },
  extraMinutes: 2, // a tie at full time: extra time, then golden goal
  options: {
    team_size: [4, 5, 6, 7, 8, 11],
    match_minutes: [5, 7, 8, 10, 12, 15, 20],
    win_goals: [2, 3, 4, 5, 0], // 0 = only the clock ends a match
  },

  words: {
    get goal() {
      return t('sport.goal')
    },
    get goals() {
      return t('sport.goalsWord')
    },
    get cheer() {
      return t('sport.cheer')
    },
    get assist() {
      return t('sport.assist')
    },
  },

  emojis: ['⚽', '🦁', '🐯', '🦅', '🚀', '⚡', '🔥', '🧱', '🎯', '🧤', '👑', '🐐', '🦈', '🐺', '🌪️', '💪'],
}
