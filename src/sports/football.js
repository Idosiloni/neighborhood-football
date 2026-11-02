// Everything about the game itself that another sport would change: positions, default rules,
// the choices offered when opening a group, and the words. The rest of the app reads it from here.
// (Adding a sport: see docs/sports.md.)

export default {
  id: 'football',
  name: 'כדורגל',
  emoji: '⚽',

  // In this order on the card and in forms. keeper: "only this" = stays in goal, one per team.
  positions: [
    { id: 'gk', label: 'שוער', short: 'שוער', keeper: true },
    { id: 'def', label: 'הגנה', short: 'בלם' },
    { id: 'mid', label: 'קישור', short: 'קשר' },
    { id: 'att', label: 'התקפה', short: 'חלוץ' },
  ],

  // A new group's rules (the database has the same defaults and limits).
  rules: { team_size: 6, match_minutes: 7, win_goals: 3 },
  extraMinutes: 2, // a tie at full time: extra time, then golden goal
  options: {
    team_size: [4, 5, 6, 7, 8, 11],
    match_minutes: [5, 7, 8, 10, 12, 15, 20],
    win_goals: [2, 3, 4, 5, 0], // 0 = only the clock ends a match
  },

  words: {
    goal: 'גול',
    goals: 'גולים',
    cheer: 'גוווול!',
    assist: 'בישול',
  },

  emojis: ['⚽', '🦁', '🐯', '🦅', '🚀', '⚡', '🔥', '🧱', '🎯', '🧤', '👑', '🐐', '🦈', '🐺', '🌪️', '💪'],
}
