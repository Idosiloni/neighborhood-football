// Texts of the home area: home screen, sign-up card, bottom bar, "updating" notice.
// American English; en-GB/home.js has the British differences. Same keys in he/ and en/.
export default {
  heroTitle: ['Neighborhood', 'Football'],
  hello: 'Hey {name}, ready to play?',
  tagline: 'Fair teams, no arguments',
  myGroups: 'My groups',

  ready: {
    title: '🎉 Your group is ready! Now invite your friends',
    text: 'Share the link in your WhatsApp group. Everyone signs up with a name and a photo, then ranks the others. You can also add a list of names yourself on the admin screen.',
    addMyself: '➕ Add players myself',
  },

  moreTodo: { one: '1 more thing waiting', other: '{count} more things waiting' },
  liveNow: 'Game {num} is live',
  mvpAsk: '👑 Who was the MVP of game {num}?',
  mvpText: 'You played in it, so you get a vote. Takes a second.',
  newPlayers: { one: '🆕 New player: {name}', other: '🆕 {count} new players joined' },
  newPlayersText: { one: 'Where does {name} go in your ranking? One tap.', other: 'Where do they go in your ranking? Quick to do.' },
  rankTitle: "🗳️ You haven't ranked the players yet",
  rankText: "Takes a minute, and you only do it once. That's how the teams come out even.",

  tonight: 'Game day',
  // "8 here, 2 games"
  tonightNow: '{arrived}, {games}',
  arrived: { one: '1 here', other: '{count} here' },
  games: { one: '1 game', other: '{count} games' },
  tonightEmpty: "Who's coming? Pick teams",
  stats: 'Stats',
  statsText: 'Awards and cards',
  ranking: 'Player ranking',
  rankingUpdate: 'Update your ranking',
  rankingSecret: 'Secret, only admins see it',
  lastGame: 'Last game',
  ourPlayers: 'Our players',
  registered: '{count} of {total} signed up',
  podium: 'On the podium',
  manage: 'Manage the group',

  calendar: {
    add: 'Add to calendar (weekly)',
    title: '⚽ {group}',
    details: 'The weekly game. Sign up in the app:',
    directions: 'Directions to {place}',
  },
  signup: {
    ask: 'Send "Who\'s coming?" on WhatsApp',
    askHeader: "⚽ Who's coming? {when}",
    askSoFar: { one: '1 signed up so far', other: '{count} signed up so far' },
    askQuick: 'Tap your name: {link}',
    askApp: 'Sign up in the app: {link}',
    today: 'Today',
    thisWeek: 'This week',
    // "No game on Saturday 11/7"
    noGame: 'No game on {day} {date} 😴',
    seeYou: 'See you next week.',
    nextToday: "Today's game",
    next: 'Next game',
    empty: "Nobody's signed up yet. Who's first?",
    missing: { one: '1 more needed', other: '{count} more needed' },
    waiting: 'Waiting list',
    in: "I'm in ✋",
    out: "Can't make it",
    joinFirst: 'Join the app to sign up for the game',
    copy: 'Copy the list for WhatsApp',
    copied: '✓ List copied',
    // first line of the list copied to WhatsApp: "Saturday 11/7, 9:30 AM"
    listHeader: '{day} {date}, {time}',
    countdown: 'Time until kickoff',
    units: { days: 'days', hours: 'hrs', minutes: 'min', seconds: 'sec' },
  },

  nav: {
    label: 'Main navigation',
    home: 'Home',
    tonight: 'Game day',
    stats: 'Stats',
    me: 'Me',
  },

  needsUpdate: {
    title: 'One moment…',
    text: 'The app is being updated. Try again in a few minutes.',
  },

  // Notifications on the phone.
  push: {
    title: 'Notifications',
    text: 'A reminder the day before the game (how many are in and how many are missing), and a note when someone new joins, to rate them. Turn off any time.',
    toggle: 'Notifications from this group',
    install: 'On iPhone, notifications only work from the app on the home screen: Share → "Add to Home Screen", then turn them on here.',
    blocked: "Notifications are blocked in the phone's settings. You can allow them there, in the site's or app's settings.",
    askTitle: 'A reminder the day before the game?',
    askText: 'A short note on your phone: how many are in and how many are missing. No spam.',
    turnOn: 'Turn on',
    requests: { one: '🙋 1 join request waiting', other: '🙋 {count} join requests waiting' },
  },
}
