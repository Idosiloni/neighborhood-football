// Fun stats from finished matches and goals only. Never uses the peer ranking.
import { positionsOf } from './positions.js'
import { t, tl } from '../i18n/index.js'

const MIN_GAMES_RATE = 5

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
      { id: p.id, games: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, streak: 0, bestStreak: 0, keeperGames: 0, conceded: 0, mvp: 0 },
    ]),
  )
  const duos = new Map()
  const combos = new Map()

  for (const m of done) {
    const mg = goalsByMatch.get(m.id) ?? []
    for (const side of ['a', 'b']) {
      const team = m[`team_${side}`]
      const won = m.winner === side
      const drew = m.winner === 'draw'
      const against = mg.filter((g) => g.team !== side).length
      for (const id of team) {
        const s = per.get(id)
        if (!s) continue
        s.games++
        if (won) {
          s.wins++
          s.streak++
          s.bestStreak = Math.max(s.bestStreak, s.streak)
        } else if (drew) {
          s.draws++ // a draw is not a loss, but it ends a winning streak
          s.streak = 0
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
  const winRate = (s.wins + (s.draws ?? 0) / 2) / s.games // a draw counts as half a win
  const value =
    45 + winRate * 35 + Math.min(s.goals / s.games, 2) * 7 + Math.min(s.assists / s.games, 1.5) * 6 + (Math.min(s.games, 30) / 30) * 5
  return Math.min(99, Math.round(value))
}

// The six numbers on the card: real stats with plain labels (no made-up 0-99 scale).
// key: stable id (the label changes with the language).
export function cardAttributes(s) {
  const per = (n, d) => (d ? (n / d).toFixed(1) : '0')
  const attr = (key, value) => ({ key, label: t(`stats.attrs.${key}`), value })
  return [
    attr('games', s.games),
    attr('winRate', `${s.games ? Math.round((s.wins / s.games) * 100) : 0}%`),
    attr('mvp', s.mvp),
    attr('goals', s.goals),
    attr('assists', s.assists),
    s.keeperGames > 0 ? attr('conceded', per(s.conceded, s.keeperGames)) : attr('bestStreak', s.bestStreak),
  ]
}

const top = (items, value, { min = -Infinity, tie = () => 0 } = {}) =>
  items.filter((x) => value(x) > min).sort((x, y) => value(y) - value(x) || tie(x, y))[0]

// Each award: who holds it and the line shown under the name (texts read now, in the current language).
export function computeAwards(stats) {
  const p = stats.players.filter((s) => s.games > 0)
  const awards = []
  const title = (key) => t(`stats.awards.${key}.title`)
  const add = (key, emoji, holder, text) => holder && awards.push({ key, emoji, title: title(key), text: text(holder), ids: [holder.id] })

  add('mvp', '🌟', top(p, (s) => s.mvp, { min: 0, tie: (x, y) => x.games - y.games }), (h) => t('stats.awards.mvp.text', { count: h.mvp }))
  add('scorer', '👑', top(p, (s) => s.goals, { min: 0, tie: (x, y) => x.games - y.games }), (h) => t('sport.goals', { count: h.goals }))
  add('assists', '🎩', top(p, (s) => s.assists, { min: 0, tie: (x, y) => x.games - y.games }), (h) => t('sport.assists', { count: h.assists }))
  add('hot', '🔥', top(p, (s) => s.streak, { min: 1 }), (h) => t('stats.awards.hot.text', { count: h.streak }))
  const lucky = top(p.filter((s) => s.games >= MIN_GAMES_RATE), (s) => s.winRate, { tie: (x, y) => y.games - x.games })
  add('lucky', '🍀', lucky, (h) => t('stats.awards.lucky.text', { pct: Math.round(h.winRate * 100) }))
  add('machine', '🚂', top(p, (s) => s.bestStreak, { min: 2 }), (h) => t('stats.awards.machine.text', { count: h.bestStreak }))
  const duo = top(stats.duos.filter((d) => d.games >= MIN_DUO_GAMES), (d) => d.wins / d.games, { tie: (x, y) => y.games - x.games })
  if (duo) awards.push({ key: 'duo', emoji: '🤝', title: title('duo'), ids: duo.ids, text: t('stats.awards.duo.text', { count: duo.wins, games: duo.games }) })
  const combo = top(stats.combos, (c) => c.goals, { min: 1 })
  if (combo) awards.push({ key: 'combo', emoji: '🎯', title: title('combo'), ids: [combo.from, combo.to], text: t('stats.awards.combo.text', { count: combo.goals }) })
  const wall = top(p.filter((s) => s.keeperGames >= 3), (s) => -s.conceded / s.keeperGames)
  add('wall', '🧱', wall, (h) => t('stats.awards.wall.text', { n: (h.conceded / (h.keeperGames || 1)).toFixed(1) }))
  add('iron', '🏃', top(p, (s) => s.games, { min: 0 }), (h) => t('stats.games', { count: h.games }))
  add('unlucky', '😅', top(p, (s) => s.losses, { min: 2, tie: (x, y) => x.games - y.games }), (h) => t('stats.awards.unlucky.text', { count: h.losses }))

  return awards
}

// Fun badges for the player card, from position and match stats only.
export function funTraits(s, player) {
  const list = []
  const add = (cond, emoji, key) => cond && list.push({ key, emoji, label: t(`stats.traits.${key}`) })
  const gpg = s.games ? s.goals / s.games : 0
  add(s.games < 3, '🐣', 'fresh')
  add(player.position === 'gk', '🧤', 'gloves')
  add(s.games >= 3 && gpg >= 1, '🎯', 'sniper')
  add(s.assists >= 3 && s.assists > s.goals, '🎩', 'passes')
  const pos = positionsOf(player)
  add(pos.includes('def') && !pos.includes('att') && s.goals >= 3, '🚀', 'defScorer')
  add(pos.includes('att') && s.games >= 5 && s.goals === 0, '🙈', 'attStrike')
  add(s.bestStreak >= 3, '🚂', 'train')
  add(s.games >= 5 && s.wins / s.games >= 0.65, '🍀', 'charm')
  add(s.games >= 5 && s.wins / s.games < 0.35, '😅', 'optimist')
  add(s.games >= 20, '🏃', 'regular')
  add(player.can_gk && player.position !== 'gk', '🦸', 'saver')
  return list.slice(0, 3)
}

// One funny line per player, stable (same player always gets the same line, in every language).
export function tagline(player) {
  let list = tl(`stats.taglines.${player.position}`)
  if (!list.length) list = tl('stats.taglines.any')
  const hash = [...player.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return list[hash % list.length]
}
