// Offline demo: same interface as supabaseApi, stored only in this browser.
// Used automatically when no Supabase keys are configured. Like the real database,
// it shows only the group of this phone's open code, and only its admins manage it.
import { computeRatings, movedCount } from '../lib/rating'
import { minPlayers, splitTeams, suggestRotation } from '../lib/teams'
import { GAME, pickSettings } from '../lib/dates'
import { getMyCode, setMyCode } from '../lib/identity'
import { fromPositions, positionsOf } from '../lib/positions'
import { compareNames, language, t } from '../i18n'
import { matchRules, optionsOf, optionsPatch, validOptions } from '../lib/options'

const KEY = 'football-demo-v3'

// The demo's made-up players: [Hebrew name, English name, emoji, position, can play in goal].
const SAMPLE = [
  ['יוסי', 'Joe', '🧤', 'gk', true],
  ['אבי', 'Alex', '🦁', 'att', false],
  ['משה', 'Mike', '🚀', 'mid', false],
  ['דני', 'Danny', '🧱', 'def', true],
  ['רון', 'Ron', '⚡', 'att', false],
  ['איתי', 'Ethan', '🎯', 'mid', false],
  ['עומר', 'Omar', '🔥', 'att', false],
  ['גיל', 'Gil', '🦅', 'def', false],
  ['נועם', 'Noah', '🐯', 'mid', false],
  ['אלון', 'Allie', '👑', 'def', false],
  ['שי', 'Sam', '🦈', 'att', false],
  ['טל', 'Taylor', '🐺', 'mid', false],
  ['בני', 'Ben', '🧤', 'gk', true],
  ['אורי', 'Riley', '💪', 'any', false],
]

const newId = () => crypto.randomUUID()
const newCode = () => crypto.randomUUID().replaceAll('-', '').slice(0, 8)
const ABC = 'abcdefghjkmnpqrstuvwxyz23456789'
const newJoinCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), (n) => ABC[n % ABC.length]).join('')
const now = () => new Date().toISOString()

function fresh() {
  // The demo starts in the language the phone is in when it first opens.
  const english = language() === 'en'
  const group = { id: newId(), name: t('common.appName'), join_code: newJoinCode(), weekday: 6, kickoff: '9:30' }
  const players = SAMPLE.map(([heName, enName, emoji, position, can_gk], i) => ({
    name: english ? enName : heName,
    id: newId(), group_id: group.id, emoji, photo: null, ...fromPositions(positionsOf({ position, can_gk })), active: true,
    is_admin: i === 0, claimed_at: i < 10 ? now() : null,
  }))
  // Everyone ranks everyone in the sample order, so the demo has ratings to balance with.
  const ballots = players.map((p) => ({ voter_id: p.id, ranking: players.map((x) => x.id) }))
  return {
    groups: [group],
    players,
    codes: Object.fromEntries(players.map((p) => [p.id, newCode()])),
    ballots,
    nights: [],
    attendance: [],
    matches: [],
    goals: [],
    mvp: [],
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved?.groups) return saved
  } catch {
    // fall through to a fresh demo
  }
  return fresh()
}

const firstVisit = (() => {
  try {
    return localStorage.getItem(KEY) === null
  } catch {
    return true
  }
})()
let state = load()
const listeners = new Set()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // demo still works for this visit
  }
  listeners.forEach((fn) => fn())
}

// A brand-new demo opens as the sample group's admin, so every screen has something to show.
if (firstVisit && !getMyCode()) {
  const admin = state.players.find((p) => p.is_admin)
  const group = state.groups.find((g) => g.id === admin.group_id)
  setMyCode(state.codes[admin.id], { id: group.id, name: group.name })
  save()
}

// Other tabs of the demo stay in sync too.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  state = load()
  listeners.forEach((fn) => fn())
})

const copy = (x) => (x == null ? x : structuredClone(x))

const playerByCode = (code) => {
  const c = code?.trim().toLowerCase()
  const id = Object.keys(state.codes).find((pid) => state.codes[pid] === c)
  return state.players.find((p) => p.id === id && p.active) ?? null
}
// The caller: the player of this phone's open code, and his group.
const me = () => playerByCode(getMyCode())
const myGroupId = () => me()?.group_id ?? null
const isAdmin = () => Boolean(me()?.is_admin)
const inMyGroup = (row) => row && row.group_id === myGroupId()
// Demo groups saved before the rules existed get the defaults.
const settingsOf = (g) => pickSettings({ ...GAME, ...g })
const groupByJoin = (joinCode) => state.groups.find((g) => g.join_code === joinCode?.trim().toLowerCase()) ?? null

const requireMember = () => {
  if (!myGroupId()) throw new Error('not allowed')
}
const requireAdmin = () => {
  if (!isAdmin()) throw new Error('not allowed')
}

const groupPlayers = (groupId) => state.players.filter((p) => p.group_id === groupId)

const tally = () => {
  const mine = new Set(state.matches.filter(inMyGroup).map((m) => m.id))
  const counts = new Map()
  for (const v of state.mvp.filter((x) => mine.has(x.match_id))) {
    const key = `${v.match_id}|${v.player_id}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([key, votes]) => {
    const [match_id, player_id] = key.split('|')
    return { match_id, player_id, votes }
  })
}

const ratingsOf = (groupId) => {
  const players = groupPlayers(groupId)
  const ids = new Set(players.map((p) => p.id))
  return computeRatings(players, state.ballots.filter((b) => ids.has(b.voter_id)))
}

// Same as private.player_scores: by the group's rating mode (peers' ballots, admin stars, or none).
const ratingOf = (groupId) => {
  const mode = optionsOf(state.groups.find((g) => g.id === groupId)).rating
  if (mode === 'none') return () => 50
  if (mode === 'admin') return (id) => (state.stars?.[id] ? (state.stars[id] - 1) * 25 : 50)
  const map = new Map(ratingsOf(groupId).map((r) => [r.player_id, r.score ?? 50]))
  return (id) => map.get(id) ?? 50
}

// Like private.quick_group: the group of this join code if it allows one-tap sign-up, for its game day.
function quickGroup(joinCode, day) {
  const g = groupByJoin(joinCode)
  if (!g || !optionsOf(g).quick_signup) return null
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const days = (date - new Date(new Date().toDateString())) / 86400_000
  if (date.getDay() !== settingsOf(g).weekday || days < -1 || days > 8) throw new Error('invalid day')
  return g
}

const presentIds = (nightId) =>
  state.attendance
    .filter((a) => a.night_id === nightId && state.players.some((p) => p.id === a.player_id && p.active))
    .sort((x, y) => x.arrived_at.localeCompare(y.arrived_at) || x.player_id.localeCompare(y.player_id))
    .map((a) => a.player_id)

const profileFields = (f, p = {}) => ({
  emoji: f.emoji || p.emoji || '⚽', photo: f.photo === undefined ? p.photo ?? null : f.photo, nickname: f.nickname?.trim() || null,
  ...fromPositions(f.positions ?? positionsOf({ position: f.position || p.position || 'any', can_gk: f.can_gk })),
})

// A group always keeps at least one active admin.
const guardLastAdmin = (p, next) => {
  if (!p.is_admin || !p.active || (next && next.is_admin && next.active)) return
  if (!groupPlayers(p.group_id).some((x) => x.id !== p.id && x.is_admin && x.active)) throw new Error('last admin')
}

const nameTaken = (groupId, name) => groupPlayers(groupId).some((p) => p.active && p.name.trim().toLowerCase() === name.toLowerCase())

export function createMockApi() {
  return {
    mode: 'demo',

    async schemaVersion() {
      return 3
    },
    async isMember() {
      return Boolean(myGroupId())
    },

    // ── groups ──
    async getGroup() {
      const g = state.groups.find((x) => x.id === myGroupId())
      return g ? copy({ options: {}, ...g }) : null
    },
    async saveGroup({ name }) {
      requireAdmin()
      state.groups.find((g) => g.id === myGroupId()).name = name.trim()
      save()
    },
    // Like set_options: changes only the options given (null / default = removed), keeps the rest.
    async saveOptions(fields) {
      requireAdmin()
      const g = state.groups.find((x) => x.id === myGroupId())
      const next = { ...(g.options ?? {}) }
      for (const [k, v] of Object.entries(optionsPatch(fields))) {
        if (v === null) delete next[k]
        else next[k] = v
      }
      if (!validOptions(next)) throw new Error('invalid options')
      g.options = next
      save()
      return copy(next)
    },
    async adminStars() {
      requireAdmin()
      return groupPlayers(myGroupId()).filter((p) => p.active).map((p) => ({ player_id: p.id, stars: state.stars?.[p.id] ?? null }))
    },
    async setStars(playerId, stars) {
      requireAdmin()
      if (!inMyGroup(state.players.find((p) => p.id === playerId))) throw new Error('not allowed')
      state.stars ??= {}
      if (stars == null) delete state.stars[playerId]
      else if (stars >= 1 && stars <= 5) state.stars[playerId] = stars
      else throw new Error('invalid stars')
      save()
    },
    async quickRoster(joinCode, day) {
      const g = quickGroup(joinCode, day)
      if (!g) return null
      const night = state.nights.find((n) => n.group_id === g.id && n.day === day)
      const players = groupPlayers(g.id).filter((p) => p.active).sort((a, b) => compareNames(a.name, b.name))
      return copy({
        id: g.id, name: g.name, ...settingsOf(g), options: g.options ?? {}, cancelled: Boolean(night?.cancelled),
        players: players.map(({ id, name, emoji }) => ({ id, name, emoji })),
        coming: night ? presentIds(night.id) : [],
      })
    },
    async quickSignup(joinCode, playerId, day, coming) {
      const g = quickGroup(joinCode, day)
      if (!g || !groupPlayers(g.id).some((p) => p.id === playerId && p.active)) throw new Error('not allowed')
      let night = state.nights.find((n) => n.group_id === g.id && n.day === day)
      if (!night) {
        night = { id: newId(), group_id: g.id, day, cancelled: false, created_at: now() }
        state.nights.push(night)
      }
      if (night.cancelled) throw new Error('no game')
      const has = state.attendance.some((a) => a.night_id === night.id && a.player_id === playerId)
      if (coming && !has) state.attendance.push({ night_id: night.id, player_id: playerId, group_id: g.id, arrived_at: now() })
      if (!coming) state.attendance = state.attendance.filter((a) => !(a.night_id === night.id && a.player_id === playerId))
      save()
    },
    async createGroup(groupName, f, settings = null) {
      const name = f.name?.trim()
      if (!groupName?.trim()) throw new Error('group name required')
      if (!name) throw new Error('name required')
      if (settings?.options !== undefined && !validOptions(settings.options)) throw new Error('invalid settings')
      const group = { id: newId(), name: groupName.trim(), join_code: newJoinCode(), ...GAME, ...pickSettings(settings ?? {}), options: settings?.options ?? {} }
      const id = newId()
      state.groups.push(group)
      state.players.push({ id, group_id: group.id, name, ...profileFields(f), active: true, is_admin: true, claimed_at: now() })
      state.codes[id] = newCode()
      save()
      return state.codes[id]
    },
    async groupPreview(joinCode) {
      const g = groupByJoin(joinCode)
      if (!g) return null
      const open = groupPlayers(g.id).filter((p) => p.active && !p.claimed_at)
      const { weekday, kickoff, venue } = settingsOf(g)
      return copy({ id: g.id, name: g.name, weekday, kickoff, venue, lang: g.options?.lang ?? null, open: open.map(({ id, name, emoji, photo }) => ({ id, name, emoji, photo })) })
    },

    async listPlayers() {
      return copy(groupPlayers(myGroupId()).sort((a, b) => compareNames(a.name, b.name)))
    },

    async getVoter(code) {
      const p = playerByCode(code)
      if (!p) return null
      const g = state.groups.find((x) => x.id === p.group_id)
      return {
        id: p.id, name: p.name, ranking: copy(state.ballots.find((b) => b.voter_id === p.id)?.ranking ?? null),
        group: { id: g.id, name: g.name }, is_admin: Boolean(p.is_admin),
      }
    },
    async updateMyProfile(code, f) {
      const p = playerByCode(code)
      if (!p) throw new Error('invalid code')
      Object.assign(p, profileFields(f, p), { claimed_at: p.claimed_at ?? now() })
      save()
    },
    async claimPlayer(joinCode, playerId, f) {
      const g = groupByJoin(joinCode)
      if (!g) throw new Error('invalid join code')
      const p = state.players.find((x) => x.id === playerId && x.group_id === g.id && x.active && !x.claimed_at)
      if (!p) throw new Error('already claimed')
      Object.assign(p, profileFields(f, p), { claimed_at: now() })
      save()
      return state.codes[p.id]
    },
    async joinTeam(joinCode, f) {
      const g = groupByJoin(joinCode)
      if (!g) throw new Error('invalid join code')
      const name = f.name?.trim()
      if (!name) throw new Error('name required')
      if (nameTaken(g.id, name)) throw new Error('name taken')
      const id = newId()
      state.players.push({ id, group_id: g.id, name, ...profileFields(f), active: true, is_admin: false, claimed_at: now() })
      state.codes[id] = newCode()
      save()
      return state.codes[id]
    },
    async submitBallot(code, ranking) {
      const voter = playerByCode(code)
      if (!voter) throw new Error('invalid code')
      const ok = (pid) => pid !== voter.id && state.players.some((p) => p.id === pid && p.active && p.group_id === voter.group_id)
      const clean = [...new Set(ranking)].filter(ok)
      const byId = Object.fromEntries(state.players.map((p) => [p.id, p]))
      const moved = movedCount(clean, byId, compareNames)
      state.ballots = state.ballots.filter((b) => b.voter_id !== voter.id).concat({ voter_id: voter.id, ranking: clean, moved, updated_at: now() })
      voter.claimed_at ??= now()
      save()
    },

    // ── game nights ──
    async getNight(day) {
      return copy(state.nights.find((n) => inMyGroup(n) && n.day === day) ?? null)
    },
    async ensureNight(day) {
      requireMember()
      let night = state.nights.find((n) => inMyGroup(n) && n.day === day)
      if (!night) {
        night = { id: newId(), group_id: myGroupId(), day, cancelled: false, created_at: now() }
        state.nights.push(night)
        save()
      }
      return copy(night)
    },
    async listAttendance(nightId) {
      return copy(state.attendance.filter((a) => inMyGroup(a) && a.night_id === nightId).sort((x, y) => x.arrived_at.localeCompare(y.arrived_at)))
    },
    async setPresent(nightId, playerId, present) {
      requireMember()
      const night = state.nights.find((n) => n.id === nightId)
      if (!inMyGroup(night) || !inMyGroup(state.players.find((p) => p.id === playerId))) throw new Error('not allowed')
      state.attendance = state.attendance.filter((a) => !(a.night_id === nightId && a.player_id === playerId))
      if (present) {
        // strictly increasing, so a pasted list keeps its order even within the same millisecond
        const last = state.attendance.filter((x) => x.night_id === nightId).map((x) => x.arrived_at).sort().at(-1)
        let at = now()
        if (last && at <= last) at = new Date(Date.parse(last) + 1).toISOString()
        state.attendance.push({ night_id: nightId, player_id: playerId, group_id: night.group_id, arrived_at: at })
      }
      save()
    },

    // ── matches ──
    async listMatches(nightId) {
      return copy(state.matches.filter((m) => inMyGroup(m) && (!nightId || m.night_id === nightId)))
    },
    async getMatch(id) {
      return copy(state.matches.find((m) => inMyGroup(m) && m.id === id) ?? null)
    },
    async createMatch(fields) {
      requireMember()
      if (!inMyGroup(state.nights.find((n) => n.id === fields.night_id))) throw new Error('not allowed')
      if (state.matches.some((m) => m.night_id === fields.night_id && m.num === fields.num)) throw new Error('duplicate match')
      const m = {
        id: newId(), group_id: myGroupId(), bench: [], status: 'live', phase: 'regular', clock_ms: 0, running_since: null,
        winner: null, created_at: now(), ended_at: null, ...fields,
      }
      // Keeps the rules it started with, like the database does.
      const group = state.groups.find((g) => g.id === myGroupId())
      const { match_minutes, win_goals } = settingsOf(group)
      Object.assign(m, { match_minutes, win_goals, rules: matchRules(group.options), period: 1, break_since: null })
      state.matches.push(m)
      save()
      return copy(m)
    },
    async updateMatch(id, fields, { onlyLive = false } = {}) {
      const m = state.matches.find((x) => inMyGroup(x) && x.id === id)
      if (!m || (onlyLive && m.status !== 'live')) return null
      Object.assign(m, fields)
      save()
      return copy(m)
    },
    async deleteMatch(id) {
      requireMember()
      if (state.matches.find((m) => m.id === id)?.status === 'finished') requireAdmin()
      state.matches = state.matches.filter((m) => !(inMyGroup(m) && m.id === id))
      state.goals = state.goals.filter((g) => g.match_id !== id)
      save()
    },
    async listGoals(matchId) {
      return copy(state.goals.filter((g) => inMyGroup(g) && (!matchId || g.match_id === matchId)))
    },
    async addGoal(fields) {
      requireMember()
      if (!inMyGroup(state.matches.find((m) => m.id === fields.match_id))) throw new Error('not allowed')
      const g = { id: newId(), group_id: myGroupId(), scorer: null, assist: null, at_ms: 0, created_at: now(), ...fields }
      state.goals.push(g)
      save()
      return copy(g)
    },
    async deleteGoal(id) {
      state.goals = state.goals.filter((g) => !(inMyGroup(g) && g.id === id))
      save()
    },
    async getHistory() {
      return copy({
        nights: state.nights.filter(inMyGroup),
        matches: state.matches.filter(inMyGroup),
        goals: state.goals.filter(inMyGroup),
        mvp: tally(),
      })
    },

    async listSeasons() {
      return copy((state.seasons ?? []).filter(inMyGroup).sort((a, b) => a.starts_on.localeCompare(b.starts_on)))
    },
    async addSeason(name, startsOn) {
      requireAdmin()
      state.seasons ??= []
      if (!name?.trim() || name.trim().length > 30) throw new Error('invalid name')
      if (state.seasons.some((s) => inMyGroup(s) && s.starts_on === startsOn)) throw new Error('duplicate season')
      state.seasons.push({ id: newId(), group_id: myGroupId(), name: name.trim(), starts_on: startsOn })
      save()
    },
    async renameSeason(id, name) {
      requireAdmin()
      const s = (state.seasons ?? []).find((x) => inMyGroup(x) && x.id === id)
      if (s && name?.trim()) s.name = name.trim()
      save()
    },
    async deleteSeason(id) {
      requireAdmin()
      state.seasons = (state.seasons ?? []).filter((x) => !(inMyGroup(x) && x.id === id))
      save()
    },

    async getSchedule() {
      const g = state.groups.find((x) => x.id === myGroupId())
      return g ? { ...settingsOf(g), options: g.options ?? {} } : null
    },
    async saveSchedule(settings) {
      requireAdmin()
      Object.assign(state.groups.find((g) => g.id === myGroupId()), pickSettings(settings))
      save()
    },
    async setCancelled(day, cancelled) {
      requireAdmin()
      const night = await this.ensureNight(day)
      state.nights.find((n) => n.id === night.id).cancelled = cancelled
      save()
    },

    async voteMvp(code, matchId, playerId) {
      const voter = playerByCode(code)
      if (!voter) throw new Error('invalid code')
      const m = state.matches.find((x) => x.id === matchId && x.group_id === voter.group_id)
      if (!m || m.status !== 'finished') throw new Error('match not finished')
      const played = (id) => m.team_a.includes(id) || m.team_b.includes(id)
      if (!played(voter.id)) throw new Error('you did not play')
      if (playerId === voter.id || !played(playerId)) throw new Error('pick someone who played')
      state.mvp = state.mvp.filter((v) => !(v.match_id === matchId && v.voter_id === voter.id))
      state.mvp.push({ match_id: matchId, voter_id: voter.id, player_id: playerId })
      save()
    },
    async mvpTally() {
      return tally()
    },
    async myMvpVotes(code) {
      const voter = playerByCode(code)
      return state.mvp.filter((v) => v.voter_id === voter?.id).map(({ match_id, player_id }) => ({ match_id, player_id }))
    },

    async makeTeams(nightId, bench) {
      if (!inMyGroup(state.nights.find((n) => n.id === nightId))) throw new Error('not allowed')
      const ids = presentIds(nightId).filter((id) => !bench.includes(id))
      const min = minPlayers(settingsOf(state.groups.find((g) => g.id === myGroupId())).team_size)
      if (ids.length < min) throw new Error(`need at least ${min} players`)
      const players = ids.map((id) => state.players.find((p) => p.id === id))
      return splitTeams(players, ratingOf(myGroupId()))
    },
    async suggestRotation(matchId) {
      const match = state.matches.find((m) => inMyGroup(m) && m.id === matchId)
      if (!match || match.status !== 'finished' || !match.winner) throw new Error('match not finished')
      return suggestRotation({
        match,
        presentIds: presentIds(match.night_id),
        playersById: Object.fromEntries(state.players.map((p) => [p.id, p])),
        ratingOf: ratingOf(match.group_id),
        tonightMatches: state.matches.filter((m) => m.night_id === match.night_id && m.num <= match.num),
        teamSize: settingsOf(state.groups.find((g) => g.id === match.group_id)).team_size,
      })
    },

    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },

    // ── admin ──
    async getAdmin() {
      return isAdmin()
    },
    async savePlayer({ id, ...fields }) {
      requireAdmin()
      if (id) {
        const p = state.players.find((x) => x.id === id && inMyGroup(x))
        if (!p) throw new Error('not allowed')
        guardLastAdmin(p, { ...p, ...fields })
        Object.assign(p, fields, fields.positions ? fromPositions(fields.positions) : {})
      } else {
        id = newId()
        state.players.push({ id, group_id: myGroupId(), emoji: '⚽', photo: null, active: true, is_admin: false, claimed_at: null, ...fields, ...fromPositions(fields.positions ?? []) })
        state.codes[id] = newCode()
      }
      save()
      return copy(state.players.find((p) => p.id === id))
    },
    async deletePlayer(id) {
      requireAdmin()
      const p = state.players.find((x) => x.id === id && inMyGroup(x))
      if (!p) return
      guardLastAdmin(p, null)
      state.players = state.players.filter((x) => x.id !== id)
      state.ballots = state.ballots.filter((b) => b.voter_id !== id)
      delete state.codes[id]
      save()
    },
    async listCodes() {
      requireAdmin()
      const ids = new Set(groupPlayers(myGroupId()).map((p) => p.id))
      return Object.fromEntries(Object.entries(state.codes).filter(([pid]) => ids.has(pid)))
    },
    async newCode(playerId) {
      requireAdmin()
      if (!inMyGroup(state.players.find((p) => p.id === playerId))) throw new Error('not allowed')
      state.codes[playerId] = newCode()
      save()
      return state.codes[playerId]
    },
    async ballotStatus() {
      requireAdmin()
      return groupPlayers(myGroupId()).filter((p) => p.active).map((p) => {
        const b = state.ballots.find((x) => x.voter_id === p.id)
        return { player_id: p.id, ranked: b?.ranking.length ?? null, moved: b?.moved ?? null, updated_at: b?.updated_at ?? null }
      })
    },
    async leaveGroup(code) {
      const p = playerByCode(code)
      if (!p) throw new Error('invalid code')
      guardLastAdmin(p, { ...p, active: false })
      Object.assign(p, { active: false, is_admin: false })
      save()
    },
    async getRatings() {
      requireAdmin()
      return ratingsOf(myGroupId()).filter((r) => state.players.some((p) => p.id === r.player_id && p.active))
    },
    async getJoinCode() {
      return state.groups.find((g) => g.id === myGroupId())?.join_code ?? null
    },
    async newJoinCode() {
      requireAdmin()
      const g = state.groups.find((x) => x.id === myGroupId())
      g.join_code = newJoinCode()
      save()
      return g.join_code
    },
  }
}
