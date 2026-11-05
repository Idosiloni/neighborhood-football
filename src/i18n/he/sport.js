// Football words (src/sports/football.js has the rules; the words are here).
export default {
  name: 'כדורגל',
  positions: {
    gk: { label: 'שוער', short: 'שוער' },
    def: { label: 'הגנה', short: 'בלם' },
    mid: { label: 'קישור', short: 'קשר' },
    att: { label: 'התקפה', short: 'חלוץ' },
  },
  keeperOnly: 'שוער קבוע',
  keeperOnlyShort: 'שוער',
  anywhere: 'כל מקום',
  anywhereAndGoal: 'כל מקום, גם בשער',

  goal: 'גול',
  goals: { one: 'גול אחד', two: 'שני גולים', other: '{count} גולים' },
  goalsWord: 'גולים',
  cheer: 'גוווול!',
  assist: 'בישול',
  assists: { one: 'בישול אחד', two: 'שני בישולים', other: '{count} בישולים' },
  goldenGoal: 'גול זהב',
}
