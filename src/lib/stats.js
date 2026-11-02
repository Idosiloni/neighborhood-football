// Fun stats from finished matches and goals only. Never uses the peer ranking.
import { positionsOf } from './positions.js'

const MIN_GAMES_RATE = 5

// Hebrew count: "גול אחד" / "3 גולים"
export const count = (n, one, many) => (n === 1 ? one : `${n} ${many}`)
const MIN_DUO_GAMES = 3

// mvp: vote totals per match ({ match_id, player_id, votes }); the most-voted player(s) of a match are its MVP.
export function computeStats(players, matches, goals, mvp = []) {
  const done = matches.filter((m) => m.status === 'finished' && m.winner).sort((x, y) => x.created_at.localeCompare(y.created_at))
  const isKeeper = new Set(players.filter((p) => p.position === 'gk').map((p) => p.id))
  const goalsByMatch = new Map()
  for (const g of goals) goalsByMatch.set(g.match_id, [...(goalsByMatch.get(g.match_id) ?? []), g])

  const per = new Map(
    players.map((p) => [
      p.id,
      { id: p.id, games: 0, wins: 0, losses: 0, goals: 0, assists: 0, streak: 0, bestStreak: 0, keeperGames: 0, conceded: 0, mvp: 0 },
    ]),
  )
  const duos = new Map()
  const combos = new Map()

  for (const m of done) {
    const mg = goalsByMatch.get(m.id) ?? []
    for (const side of ['a', 'b']) {
      const team = m[`team_${side}`]
      const won = m.winner === side
      const against = mg.filter((g) => g.team !== side).length
      for (const id of team) {
        const s = per.get(id)
        if (!s) continue
        s.games++
        if (won) {
          s.wins++
          s.streak++
          s.bestStreak = Math.max(s.bestStreak, s.streak)
        } else {
          s.losses++
          s.streak = 0
        }
        if (isKeeper.has(id)) {
          s.keeperGames++
          s.conceded += against
        }
      }
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const key = [team[i], team[j]].sort().join('|')
          const d = duos.get(key) ?? { ids: key.split('|'), games: 0, wins: 0 }
          d.games++
          if (won) d.wins++
          duos.set(key, d)
        }
      }
    }
    for (const g of mg) {
      if (g.scorer && per.has(g.scorer)) per.get(g.scorer).goals++
      if (g.assist && per.has(g.assist)) per.get(g.assist).assists++
      if (g.scorer && g.assist) {
        const key = `${g.assist}>${g.scorer}`
        combos.set(key, { from: g.assist, to: g.scorer, goals: (combos.get(key)?.goals ?? 0) + 1 })
      }
    }
  }

  const finishedIds = new Set(done.map((m) => m.id))
  const byMatch = new Map()
  for (const v of mvp) {
    if (!finishedIds.has(v.match_id)) continue
    byMatch.set(v.match_id, [...(byMatch.get(v.match_id) ?? []), v])
  }
  for (const votes of byMatch.values()) {
    const top = Math.max(...votes.map((v) => v.votes))
    for (const v of votes) if (v.votes === top && per.has(v.player_id)) per.get(v.player_id).mvp++
  }

  const list = [...per.values()].map((s) => ({
    ...s,
    winRate: s.games ? s.wins / s.games : 0,
    goalsPerGame: s.games ? s.goals / s.games : 0,
    assistsPerGame: s.games ? s.assists / s.games : 0,
    overall: overall(s),
  }))

  return { players: list, byId: Object.fromEntries(list.map((s) => [s.id, s])), duos: [...duos.values()], combos: [...combos.values()], matchCount: done.length }
}

// Card rating from match results only (wins, goals, assists, games). Null until 3 games.
export function overall(s) {
  if (s.games < 3) return null
  const winRate = s.wins / s.games
  const value =
    45 + winRate * 35 + Math.min(s.goals / s.games, 2) * 7 + Math.min(s.assists / s.games, 1.5) * 6 + (Math.min(s.games, 30) / 30) * 5
  return Math.min(99, Math.round(value))
}

// The six numbers on the card: real stats with plain labels (no made-up 0-99 scale).
export function cardAttributes(s) {
  const per = (n, d) => (d ? (n / d).toFixed(1) : '0')
  return [
    { label: 'משחקים', value: s.games },
    { label: 'ניצחונות', value: `${s.games ? Math.round((s.wins / s.games) * 100) : 0}%` },
    { label: 'MVP', value: s.mvp },
    { label: 'שערים', value: s.goals },
    { label: 'בישולים', value: s.assists },
    s.keeperGames > 0
      ? { label: 'ספיגות למשחק', value: per(s.conceded, s.keeperGames) }
      : { label: 'שיא רצף', value: s.bestStreak },
  ]
}

const top = (items, value, { min = -Infinity, tie = () => 0 } = {}) =>
  items.filter((x) => value(x) > min).sort((x, y) => value(y) - value(x) || tie(x, y))[0]

// Each award: who holds it and the line shown under the name.
export function computeAwards(stats) {
  const p = stats.players.filter((s) => s.games > 0)
  const awards = []
  const add = (key, emoji, title, holder, text, extra = {}) => holder && awards.push({ key, emoji, title, text, ...extra, ids: extra.ids ?? [holder.id] })

  const star = top(p, (s) => s.mvp, { min: 0, tie: (x, y) => x.games - y.games })
  add('mvp', '🌟', 'כוכב המשחקים', star, count(star?.mvp, 'MVP פעם אחת', 'פעמים MVP'))
  const scorer = top(p, (s) => s.goals, { min: 0, tie: (x, y) => x.games - y.games })
  add('scorer', '👑', 'מלך השערים', scorer, count(scorer?.goals, 'גול אחד', 'גולים'))
  const maker = top(p, (s) => s.assists, { min: 0, tie: (x, y) => x.games - y.games })
  add('assists', '🎩', 'המבשל', maker, count(maker?.assists, 'בישול אחד', 'בישולים'))
  const hot = top(p, (s) => s.streak, { min: 1 })
  add('hot', '🔥', 'בוער', hot, `${hot?.streak} ניצחונות ברצף עכשיו`)
  const lucky = top(p.filter((s) => s.games >= MIN_GAMES_RATE), (s) => s.winRate, { tie: (x, y) => y.games - x.games })
  add('lucky', '🍀', 'הקמע', lucky, `${Math.round((lucky?.winRate ?? 0) * 100)}% ניצחונות`)
  const machine = top(p, (s) => s.bestStreak, { min: 2 })
  add('machine', '🚂', 'מכונת ניצחונות', machine, `שיא: ${machine?.bestStreak} ברצף`)
  const duo = top(stats.duos.filter((d) => d.games >= MIN_DUO_GAMES), (d) => d.wins / d.games, { tie: (x, y) => y.games - x.games })
  if (duo) awards.push({ key: 'duo', emoji: '🤝', title: 'הצמד הזהב', ids: duo.ids, text: `${duo.wins} מתוך ${duo.games} ניצחונות יחד` })
  const combo = top(stats.combos, (c) => c.goals, { min: 1 })
  if (combo) awards.push({ key: 'combo', emoji: '🎯', title: 'הקומבו', ids: [combo.from, combo.to], text: `${combo.goals} גולים ביחד` })
  const wall = top(p.filter((s) => s.keeperGames >= 3), (s) => -s.conceded / s.keeperGames)
  add('wall', '🧱', 'הקיר', wall, `${((wall?.conceded ?? 0) / (wall?.keeperGames || 1)).toFixed(1)} ספיגות למשחק`)
  const iron = top(p, (s) => s.games, { min: 0 })
  add('iron', '🏃', 'איש הברזל', iron, count(iron?.games, 'משחק אחד', 'משחקים'))
  const unlucky = top(p, (s) => s.losses, { min: 2, tie: (x, y) => x.games - y.games })
  add('unlucky', '😅', 'חסר מזל', unlucky, `${unlucky?.losses} הפסדים (יבוא היום שלו)`)

  return awards
}

// Fun badges for the player card, from position and match stats only.
export function funTraits(s, player) {
  const t = []
  const add = (cond, emoji, label) => cond && t.push({ emoji, label })
  const gpg = s.games ? s.goals / s.games : 0
  add(s.games < 3, '🐣', 'טרי בשכונה')
  add(player.position === 'gk', '🧤', 'ידיים של דבק')
  add(s.games >= 3 && gpg >= 1, '🎯', 'צלף')
  add(s.assists >= 3 && s.assists > s.goals, '🎩', 'קוסם המסירות')
  const pos = positionsOf(player)
  add(pos.includes('def') && !pos.includes('att') && s.goals >= 3, '🚀', 'בלם שמתגעגע להתקפה')
  add(pos.includes('att') && s.games >= 5 && s.goals === 0, '🙈', 'חלוץ בשביתה')
  add(s.bestStreak >= 3, '🚂', 'רכבת ניצחונות')
  add(s.games >= 5 && s.wins / s.games >= 0.65, '🍀', 'קמע')
  add(s.games >= 5 && s.wins / s.games < 0.35, '😅', 'אופטימי נצחי')
  add(s.games >= 20, '🏃', 'לא מפספס ערב')
  add(player.can_gk && player.position !== 'gk', '🦸', 'מציל בשער')
  return t.slice(0, 3)
}

const TAGLINES = {
  att: ['רואה שער ובועט. לפעמים גם פוגע.', 'מסירה? לא שמע על זה.', 'גר ברחבה, משלם שכירות בגולים.'],
  mid: ['המוח של הקבוצה. לפחות ככה הוא אומר.', 'רץ יותר מכולם, מתלונן יותר מכולם.', 'מחלק כדורים כמו חלה בשישי.'],
  def: ['עובר רק דרכו. לא תמיד בחוקיות.', 'הכדור עובר, השחקן לא.', 'מהגב שלו מתחיל כל ניצחון.'],
  gk: ['הקורה היא החברה הכי טובה שלו.', 'אוהב לשכב על הדשא. במקצועיות.', 'צועק על ההגנה, וגם צודק.'],
  any: ['משחק בכל מקום. בעיקר במקום של אחרים.', 'תשים אותו איפה שצריך, הוא יסתדר.', 'שחקן של כל העמדות ושל אף ויכוח.'],
}

// One funny line per player, stable (same player always gets the same line).
export function tagline(player) {
  const list = TAGLINES[player.position] ?? TAGLINES.any
  const hash = [...player.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return list[hash % list.length]
}
