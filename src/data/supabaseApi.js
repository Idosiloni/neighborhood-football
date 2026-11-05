import { createClient } from '@supabase/supabase-js'
import { currentGroup, getMyCode } from '../lib/identity'
import { GAME, pickSettings } from '../lib/dates'
import { cleanOptions } from '../lib/options'

// '*' so newer columns show up once the schema update has been run.
// Everything but the photo itself (see lib/photos.js): photo_v says which photo he has.
const PLAYER_FIELDS = 'id,group_id,name,emoji,position,can_gk,positions,active,nickname,is_admin,claimed_at,created_at,photo_v'

function check({ data, error }) {
  if (error) throw error
  return data
}

// Every request carries this phone's personal code for the open group. The database
// shows and changes only that group, and only an admin's code may manage it.
function fetchWithCode(input, init = {}) {
  const headers = new Headers(init.headers)
  const code = getMyCode()
  if (code) headers.set('x-player-code', code)
  return fetch(input, { ...init, headers })
}

const profileArgs = (f) => ({
  p_emoji: f.emoji, p_photo: f.photo ?? null, p_position: f.position, p_can_gk: f.can_gk, p_nickname: f.nickname || null,
  p_positions: f.positions ?? null,
})

export function createSupabaseApi(url, key) {
  const db = createClient(url, key, { global: { fetch: fetchWithCode }, auth: { persistSession: false } })

  // One live channel per group, shared by every screen that listens.
  const listeners = new Set()
  let channel = null

  return {
    mode: 'live',

    async schemaVersion() {
      const { data, error } = await db.rpc('schema_version')
      return error ? 1 : data
    },
    async isMember() {
      const { data, error } = await db.rpc('is_member')
      return !error && data === true
    },

    // ── groups ──
    async getGroup() {
      return check(await db.from('groups').select('*').maybeSingle())
    },
    async saveGroup({ name }) {
      check(await db.from('groups').update({ name: name.trim() }).eq('id', currentGroup()?.id))
    },
    // The whole options object (src/lib/options.js), admins only. Needs schema version 4.
    async saveOptions(options) {
      check(await db.from('groups').update({ options: cleanOptions(options) }).eq('id', currentGroup()?.id))
    },
    // settings: weekday, kickoff, team_size, match_minutes, win_goals, venue, options (any can be left out).
    async createGroup(groupName, f, settings = null) {
      return check(await db.rpc('create_group', { p_group: groupName, p_name: f.name, ...profileArgs(f), p_settings: settings }))
    },
    // Before joining: the group's name and the names nobody has claimed (null for a bad code).
    async groupPreview(joinCode) {
      return check(await db.rpc('group_preview', { p_join: joinCode }))
    },

    async listPlayers() {
      return check(await db.from('players').select(PLAYER_FIELDS).order('name'))
    },
    async getPhotos(ids) {
      return check(await db.from('players').select('id,photo,photo_v').in('id', ids))
    },

    // ── voting by personal code ──
    async getVoter(code) {
      const rows = check(await db.rpc('voter_by_code', { p_code: code }))
      if (!rows?.length) return null
      const { player_id, name, ranking, group_id, group_name, is_admin } = rows[0]
      return { id: player_id, name, ranking, group: { id: group_id, name: group_name }, is_admin }
    },
    async submitBallot(code, ranking) {
      check(await db.rpc('submit_ballot', { p_code: code, p_ranking: ranking }))
    },
    // Admins: who ranked and how many players each moved (never what they ranked).
    async ballotStatus() {
      return check(await db.rpc('admin_ballot_status'))
    },
    async leaveGroup(code) {
      check(await db.rpc('leave_group', { p_code: code }))
    },

    // ── a player edits his own profile / a new player joins with the group link ──
    async updateMyProfile(code, f) {
      // No photo in the form = he didn't touch it: keep the one he has.
      check(await db.rpc('update_my_profile', { p_code: code, ...profileArgs(f), p_keep_photo: f.photo === undefined }))
    },
    async claimPlayer(joinCode, playerId, f) {
      return check(await db.rpc('claim_player', { p_join: joinCode, p_player: playerId, ...profileArgs(f) }))
    },
    async joinTeam(joinCode, f) {
      return check(await db.rpc('join_team', { p_join: joinCode, p_name: f.name, ...profileArgs(f) }))
    },

    // ── game nights ── (the database fills in the group)
    async getNight(day) {
      return check(await db.from('nights').select('*').eq('day', day).maybeSingle())
    },
    async ensureNight(day) {
      check(await db.from('nights').upsert({ day }, { onConflict: 'group_id,day', ignoreDuplicates: true }))
      return check(await db.from('nights').select('*').eq('day', day).single())
    },
    async listAttendance(nightId) {
      return check(await db.from('attendance').select('*').eq('night_id', nightId).order('arrived_at'))
    },
    async setPresent(nightId, playerId, present) {
      if (present) {
        check(await db.from('attendance').upsert({ night_id: nightId, player_id: playerId }, { ignoreDuplicates: true }))
      } else {
        check(await db.from('attendance').delete().eq('night_id', nightId).eq('player_id', playerId))
      }
    },

    // ── matches ──
    async listMatches(nightId) {
      let q = db.from('matches').select('*').order('created_at')
      if (nightId) q = q.eq('night_id', nightId)
      return check(await q)
    },
    async getMatch(id) {
      return check(await db.from('matches').select('*').eq('id', id).maybeSingle())
    },
    async createMatch(fields) {
      return check(await db.from('matches').insert(fields).select().single())
    },
    // onlyLive: change it only if nobody finished it meanwhile (two phones pressing at once).
    async updateMatch(id, fields, { onlyLive = false } = {}) {
      let q = db.from('matches').update(fields).eq('id', id)
      if (onlyLive) q = q.eq('status', 'live')
      return check(await q.select()).at(0) ?? null
    },
    async deleteMatch(id) {
      check(await db.from('matches').delete().eq('id', id))
    },
    async listGoals(matchId) {
      let q = db.from('goals').select('*').order('created_at')
      if (matchId) q = q.eq('match_id', matchId)
      return check(await q)
    },
    async addGoal(fields) {
      return check(await db.from('goals').insert(fields).select().single())
    },
    async deleteGoal(id) {
      check(await db.from('goals').delete().eq('id', id))
    },
    async getHistory() {
      const [nights, matches, goals, mvp] = await Promise.all([
        db.from('nights').select('*').order('day'),
        db.from('matches').select('*').order('created_at'),
        db.from('goals').select('*').order('created_at'),
        db.rpc('mvp_tally'),
      ])
      return { nights: check(nights), matches: check(matches), goals: check(goals), mvp: mvp.error ? [] : mvp.data }
    },

    // ── the group's settings: when and where, and the game rules ──
    async getSchedule() {
      const g = await this.getGroup()
      // The rules columns, plus the options (format, halves, tie rule, colors…) for the forms and summaries.
      return g && { ...pickSettings({ ...GAME, ...g }), options: g.options ?? {} }
    },
    async saveSchedule(settings) {
      check(await db.from('groups').update(pickSettings(settings)).eq('id', currentGroup()?.id))
    },
    async setCancelled(day, cancelled) {
      const night = await this.ensureNight(day)
      check(await db.from('nights').update({ cancelled }).eq('id', night.id))
    },

    // ── player of the match ──
    async voteMvp(code, matchId, playerId) {
      check(await db.rpc('vote_mvp', { p_code: code, p_match: matchId, p_player: playerId }))
    },
    async mvpTally() {
      return check(await db.rpc('mvp_tally'))
    },
    async myMvpVotes(code) {
      return check(await db.rpc('my_mvp_votes', { p_code: code }))
    },

    // Team building runs inside the database, so nobody's phone ever sees the ratings.
    async makeTeams(nightId, bench) {
      return check(await db.rpc('make_teams', { p_night: nightId, p_bench: bench }))
    },
    async suggestRotation(matchId) {
      return check(await db.rpc('suggest_rotation', { p_match: matchId }))
    },

    // Calls onChange whenever anything in the open group changes on any phone. The database
    // sends only a "something changed" ping; the screens then reload what they may read.
    subscribe(onChange) {
      const groupId = currentGroup()?.id
      if (!groupId) return () => {}
      listeners.add(onChange)
      channel ??= db
        .channel(`g:${groupId}`)
        .on('broadcast', { event: 'change' }, () => listeners.forEach((fn) => fn()))
        .subscribe()
      return () => {
        listeners.delete(onChange)
        if (listeners.size === 0 && channel) {
          db.removeChannel(channel)
          channel = null
        }
      }
    },

    // ── admin (a player of the group with admin rights, by his personal code) ──
    async getAdmin() {
      const { data, error } = await db.rpc('is_admin')
      return !error && data === true
    },
    async savePlayer({ id, ...fields }) {
      if (id) return check(await db.from('players').update(fields).eq('id', id).select(PLAYER_FIELDS).single())
      return check(await db.from('players').insert(fields).select(PLAYER_FIELDS).single())
    },
    async deletePlayer(id) {
      check(await db.from('players').delete().eq('id', id))
    },
    async listCodes() {
      const rows = check(await db.from('player_codes').select('player_id, code'))
      return Object.fromEntries(rows.map((r) => [r.player_id, r.code]))
    },
    async newCode(playerId) {
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 8)
      check(await db.from('player_codes').update({ code }).eq('player_id', playerId))
      return code
    },
    async getRatings() {
      return check(await db.rpc('admin_ratings'))
    },
    // Every player of the group sees the join code, to invite friends.
    async getJoinCode() {
      return (await this.getGroup())?.join_code ?? null
    },
    async newJoinCode() {
      return check(await db.rpc('new_join_code'))
    },
  }
}
