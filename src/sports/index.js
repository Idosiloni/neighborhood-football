import football from './football.js'

// Every sport the app knows. A group's sport is stored on it (groups.sport); for now all play football.
export const SPORTS = { football }

export const sportOf = (id) => SPORTS[id] ?? football

// The sport of the open group. One sport today, so this is football; when there are more,
// it comes from the group the phone is in.
export const sport = football
