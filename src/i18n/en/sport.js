// Soccer words, American English (src/sports/football.js has the rules; the words are here).
export default {
  name: 'Soccer',
  positions: {
    gk: { label: 'Goalkeeper', short: 'GK' },
    def: { label: 'Defense', short: 'DEF' },
    mid: { label: 'Midfield', short: 'MID' },
    att: { label: 'Attack', short: 'FWD' },
  },
  keeperOnly: 'Goalkeeper only',
  keeperOnlyShort: 'GK',
  anywhere: 'Anywhere',
  anywhereAndGoal: 'Anywhere, in goal too',

  goal: 'goal',
  goals: { one: '1 goal', other: '{count} goals' },
  goalsWord: 'goals',
  cheer: 'GOOOAL!',
  assist: 'assist',
  assists: { one: '1 assist', other: '{count} assists' },
  goldenGoal: 'golden goal',
}
