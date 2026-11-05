// Database tests: runs supabase/schema.sql in PGlite (real Postgres in WASM) with a small
// stand-in for what Supabase provides (roles, auth.uid(), default grants), then checks
// who may read/write what and that make_teams / suggest_rotation follow src/lib/teams.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { suggestRotation, imbalance, stayingSide } from '../src/lib/teams.js'

const SCHEMA = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const SCHEMA_V1 = readFileSync(new URL('./fixtures/schema_v1.sql', import.meta.url), 'utf8')
const SCHEMA_V2 = readFileSync(new URL('./fixtures/schema_v2.sql', import.meta.url), 'utf8')
const ADMIN = '00000000-0000-0000-0000-00000000000a'
const OTHER = '00000000-0000-0000-0000-00000000000b'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// What Supabase does: roles, auth schema, and grants on everything new in public
// (so only RLS and explicit revokes protect anything).
const SUPABASE_STUB = `
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema auth; grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  insert into auth.users values ('${ADMIN}', 'ido@x'), ('${OTHER}', 'other@x');
`

async function newDb({ realtime = false } = {}) {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  if (realtime) await db.exec('create publication supabase_realtime')
  return db
}

// The admin player of each test database's main group (set by newGroup).
const ADMIN_CODE = new Map()

// A group made directly by the database owner, with one admin player. Returns { id, joinCode, adminId, adminCode }.
async function newGroup(db, name = 'G', { adminName = 'boss', main = true } = {}) {
  const g = (await db.query(`insert into public.groups (name, join_code) values ($1, private.new_join_code()) returning id, join_code`, [name])).rows[0]
  const adminId = (await db.query(`insert into public.players (group_id, name, is_admin, claimed_at) values ($1, $2, true, now()) returning id`, [g.id, adminName])).rows[0].id
  const adminCode = (await db.query('select code from public.player_codes where player_id = $1', [adminId])).rows[0].code
  if (main) ADMIN_CODE.set(db, adminCode)
  return { id: g.id, joinCode: g.join_code, adminId, adminCode }
}

// Run one statement as somebody. who: 'anon' | 'admin' (the main group's admin player, by code)
// | 'other' (signed in to Supabase Auth, no code) | { code } (anon with x-player-code header)
// | { headers } (raw request.headers value). With rollback, nothing the statement did is kept.
async function as(db, who, sql, params = [], { rollback = false } = {}) {
  if (who === 'admin') who = { code: ADMIN_CODE.get(db) }
  const sub = who === 'other' ? OTHER : ''
  const headers =
    typeof who === 'object' ? (who.headers ?? JSON.stringify({ 'x-player-code': who.code })) : '{}'
  const role = who === 'other' ? 'authenticated' : 'anon'
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.headers', $2, false)`, [sub, headers])
  if (rollback) await db.exec('begin')
  await db.exec(`set role ${role}`)
  try {
    return { rows: (await db.query(sql, params)).rows }
  } catch (e) {
    return { error: e.message }
  } finally {
    if (rollback) await db.exec('rollback')
    await db.exec('reset role')
  }
}

const one = async (db, sql, params) => (await db.query(sql, params)).rows[0]
const count = async (db, sql, params) => (await one(db, sql, params)).n
const range = (from, to) => Array.from({ length: to - from }, (_, i) => `p${from + i}`)
const sorted = (list) => [...list].sort()

// ═════════════ Main database: schema loaded twice on an empty database ═════════════

const db = await newDb({ realtime: true })
await db.exec(SCHEMA)
await db.exec(SCHEMA) // running it twice must be safe
const G = await newGroup(db)

test('schema: can be run again (third time) without errors', async () => {
  await db.exec(SCHEMA)
})

test('schema: schema_version() = 5 for anyone', async () => {
  assert.equal((await as(db, 'anon', 'select public.schema_version() as v')).rows[0].v, 5)
  assert.equal((await as(db, 'other', 'select public.schema_version() as v')).rows[0].v, 5)
})

test('schema: no table sends its rows over realtime (only content-free pings)', async () => {
  const rows = (await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)).rows
  assert.deepEqual(rows, [])
})

// ───────────── v1: players, codes, voting, ratings (own database, schema loaded twice) ─────────────

const db1 = await newDb()
await db1.exec(SCHEMA)
await db1.exec(SCHEMA)
await newGroup(db1)

const names = ['יוסי', 'אבי', 'משה', 'דני', 'רון', 'איתי']
const ids = {}
const codes = {}

test('v1: admin adds players and each gets an 8-char code', async () => {
  for (const n of names) {
    const r = await as(db1, 'admin', `insert into public.players (name) values ($1) returning id`, [n])
    assert.ok(!r.error, r.error)
    ids[n] = r.rows[0].id
  }
  for (const r of (await db1.query('select p.name, c.code from public.player_codes c join public.players p on p.id = c.player_id where not p.is_admin')).rows)
    codes[r.name] = r.code
  assert.equal(Object.keys(codes).length, 6)
  assert.ok(Object.values(codes).every((c) => /^[0-9a-f]{8}$/.test(c)))
})

test('v1: admin and players see the group (admin + 6); anon and signed-in strangers see nobody', async () => {
  assert.equal((await as(db1, 'admin', 'select * from public.players')).rows.length, 7)
  assert.equal((await as(db1, { code: codes['רון'] }, 'select * from public.players')).rows.length, 7)
  assert.equal((await as(db1, 'anon', 'select * from public.players')).rows.length, 0)
  assert.equal((await as(db1, 'other', 'select * from public.players')).rows.length, 0)
})

test('v1: anon and signed-in non-admin cannot read codes or ballots', async () => {
  for (const who of ['anon', 'other']) {
    for (const t of ['player_codes', 'ballots']) {
      const r = await as(db1, who, `select * from public.${t}`)
      assert.ok(r.error || r.rows.length === 0, `${who} reads ${t}`)
    }
  }
})

test('v1: only admin can call admin_ratings', async () => {
  assert.ok((await as(db1, 'anon', 'select * from public.admin_ratings()')).error)
  assert.ok((await as(db1, 'other', 'select * from public.admin_ratings()')).error)
  assert.ok((await as(db1, { code: codes['רון'] }, 'select * from public.admin_ratings()')).error)
})

test('v1: anon, non-admin and plain players cannot add, edit or delete players', async () => {
  for (const who of ['anon', 'other', { code: codes['רון'] }])
    assert.ok((await as(db1, who, `insert into public.players (name) values ('hacker')`)).error)
  for (const who of ['anon', 'other', { code: codes['רון'] }]) {
    await as(db1, who, `update public.players set name = 'hacked'`)
    await as(db1, who, `delete from public.players`)
  }
  assert.equal(await count(db1, `select count(*)::int as n from public.players where name <> 'hacked'`), 7)
})

test('v1: nobody can make himself admin', async () => {
  const before = await count(db1, 'select count(*)::int as n from public.admins')
  await as(db1, 'other', `insert into public.admins values ('${OTHER}')`)
  await as(db1, 'anon', `insert into public.admins values ('${OTHER}')`)
  await as(db1, { code: codes['רון'] }, `update public.players set is_admin = true`)
  assert.equal(await count(db1, 'select count(*)::int as n from public.admins'), before)
  assert.equal(await count(db1, 'select count(*)::int as n from public.players where is_admin'), 1)
})

test('v1: cannot write ballots or change codes directly', async () => {
  for (const who of ['anon', 'other', { code: codes['משה'] }]) {
    await as(db1, who, `insert into public.ballots values ($1, array[$2]::uuid[])`, [ids['משה'], ids['רון']])
    await as(db1, who, `update public.player_codes set code = 'hacked00'`)
  }
  assert.equal(await count(db1, 'select count(*)::int as n from public.ballots'), 0)
  assert.equal(await count(db1, `select count(*)::int as n from public.player_codes where code = 'hacked00'`), 0)
})

test('v1: voter_by_code finds the voter (case/space-insensitive), wrong code finds nobody', async () => {
  const v = await as(db1, 'anon', 'select * from public.voter_by_code($1)', [codes['אבי'].toUpperCase() + ' '])
  assert.equal(v.rows[0].name, 'אבי')
  assert.equal(v.rows[0].ranking, null)
  assert.equal((await as(db1, 'anon', 'select * from public.voter_by_code($1)', ['nope'])).rows.length, 0)
  assert.ok((await as(db1, 'anon', 'select public.submit_ballot($1, $2)', ['nope', [ids['משה']]])).error)
})

const ballot = (...n) => n.map((x) => ids[x] ?? x)

test('v1: ballots are cleaned (no self, duplicate or fake id; order kept), one per voter', async () => {
  const r = await as(db1, 'anon', 'select public.submit_ballot($1, $2)', [
    codes['אבי'],
    ballot('משה', 'אבי', 'איתי', 'משה', 'דני', '11111111-1111-1111-1111-111111111111', 'רון', 'יוסי'),
  ])
  assert.ok(!r.error, r.error)
  const saved = (await one(db1, 'select ranking from public.ballots where voter_id = $1', [ids['אבי']])).ranking
  assert.deepEqual(saved, ballot('משה', 'איתי', 'דני', 'רון', 'יוסי'))
  await as(db1, 'anon', 'select public.submit_ballot($1, $2)', [codes['משה'], ballot('משה', 'איתי', 'דני', 'אבי', 'רון', 'יוסי')])
  await as(db1, 'anon', 'select public.submit_ballot($1, $2)', [codes['יוסי'], ballot('דני')])
  await as(db1, 'anon', 'select public.submit_ballot($1, $2)', [codes['יוסי'], ballot('איתי', 'משה')])
  assert.equal(await count(db1, 'select count(*)::int as n from public.ballots'), 3)
})

test('v1: admin_ratings scores (same scenario as the demo)', async () => {
  const rat = await as(db1, 'admin', 'select * from public.admin_ratings()')
  assert.ok(!rat.error, rat.error)
  const byName = Object.fromEntries(rat.rows.map((x) => [names.find((n) => ids[n] === x.player_id), x]))
  const expect = { 'איתי': 91.7, 'דני': 62.5, 'אבי': 50, 'משה': 50, 'רון': 25, 'יוסי': 0 }
  for (const [n, s] of Object.entries(expect)) assert.equal(Number(byName[n].score), s, n)
  assert.equal(byName['איתי'].votes, 3)
  assert.ok(byName['אבי'].has_voted && !byName['רון'].has_voted)
})

test('v1: inactive player is dropped from the ranking and cannot vote', async () => {
  await as(db1, 'admin', `update public.players set active = false where id = $1`, [ids['יוסי']])
  const rat = (await as(db1, 'admin', 'select * from public.admin_ratings()')).rows
  assert.equal(rat.length, 6) // 5 players + the admin
  assert.equal(Number(rat.find((x) => x.player_id === ids['רון']).score), 0)
  assert.equal((await as(db1, 'anon', 'select * from public.voter_by_code($1)', [codes['יוסי']])).rows.length, 0)
})

test('v1: old code stops working after admin replaces it', async () => {
  await as(db1, 'admin', `update public.player_codes set code = 'newcode1' where player_id = $1`, [ids['אבי']])
  assert.equal((await as(db1, 'anon', 'select * from public.voter_by_code($1)', [codes['אבי']])).rows.length, 0)
  codes['אבי'] = 'newcode1'
})

// ───────────── v2 fixtures (inserted directly, as the database owner) ─────────────

const P = {} // name → id
const C = {} // name → code
async function addPlayer(name, extra = {}) {
  const r = await one(db, `insert into public.players (group_id, name, active) values ($1, $2, $3) returning id`, [extra.group ?? G.id, name, extra.active ?? true])
  P[name] = r.id
  C[name] = (await one(db, 'select code from public.player_codes where player_id = $1', [r.id])).code
  P[r.id] = name
}
for (let i = 0; i < 18; i++) await addPlayer(`p${i}`) // rotation players (no votes → rating 50)
for (let i = 0; i < 12; i++) await addPlayer(`t${i}`) // team-split players (distinct ratings)
for (let i = 0; i < 9; i++) await addPlayer(`f${i}`) // fillers on the ballot, never attend
await addPlayer('voter')
await addPlayer('gone', { active: false })

// One 21-long ballot → scores 100, 95, …, 0 (exact after rounding): t0 = 100 … t11 = 45.
await db.query('insert into public.ballots (voter_id, ranking) values ($1, $2)', [
  P.voter,
  [...Array.from({ length: 12 }, (_, i) => P[`t${i}`]), ...Array.from({ length: 9 }, (_, i) => P[`f${i}`])],
])

const MEMBER = { code: C.p0 }
const INACTIVE = { code: C.gone }
const NON_MEMBERS = [
  ['anon without header', 'anon'],
  ['request.headers empty string', { headers: '' }],
  ['header without code', { headers: '{"x-other":"1"}' }],
  ['wrong code', { code: 'nope1234' }],
  ["inactive player's code", INACTIVE],
  ['signed-in non-admin', 'other'],
]

let dayN = 0
async function addNight(presentNames, matches = [], group = G.id) {
  dayN++
  const night = (await one(db, `insert into public.nights (group_id, day) values ($1, date '2027-01-01' + $2::int) returning id`, [group, dayN])).id
  for (const [i, n] of presentNames.entries())
    await db.query(`insert into public.attendance (night_id, player_id, arrived_at) values ($1, $2, timestamptz '2027-01-01 18:00Z' + make_interval(mins => $3))`, [night, P[n], i])
  const matchIds = []
  for (const m of matches) {
    const r = await one(
      db,
      `insert into public.matches (night_id, num, team_a, team_b, bench, status, winner) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [night, m.num, m.team_a.map((n) => P[n]), m.team_b.map((n) => P[n]), (m.bench ?? []).map((n) => P[n]), m.status ?? 'finished', m.winner === undefined ? 'a' : m.winner],
    )
    matchIds.push(r.id)
  }
  return { night, matchIds }
}

// ───────────── v2: who may read and write nights / attendance / matches / goals ─────────────

const fx = await addNight(['p0', 'p1'], [{ num: 1, team_a: ['p0'], team_b: ['p1'], status: 'live', winner: null }])
const fxMatch = fx.matchIds[0]
await db.query(`insert into public.goals (match_id, team, scorer) values ($1, 'a', $2)`, [fxMatch, P.p0])

// Every kind of write on every table; each runs in a rolled-back transaction.
const WRITES = [
  ['insert night', `insert into public.nights (day) values ('2031-05-05') returning id`],
  ['update night', `update public.nights set day = day where id = '${fx.night}' returning id`],
  ['delete night', `delete from public.nights where id = '${fx.night}' returning id`],
  ['insert attendance', `insert into public.attendance (night_id, player_id) values ('${fx.night}', '${P.p2}') returning player_id`],
  ['update attendance', `update public.attendance set arrived_at = now() where night_id = '${fx.night}' returning player_id`],
  ['delete attendance', `delete from public.attendance where night_id = '${fx.night}' returning player_id`],
  ['insert match', `insert into public.matches (night_id, num, team_a, team_b) values ('${fx.night}', 2, '{}', '{}') returning id`],
  ['update match', `update public.matches set clock_ms = 1000 where id = '${fxMatch}' returning id`],
  ['delete match', `delete from public.matches where id = '${fxMatch}' returning id`],
  ['insert goal', `insert into public.goals (match_id, team) values ('${fxMatch}', 'b') returning id`],
  ['update goal', `update public.goals set at_ms = 5 where match_id = '${fxMatch}' returning id`],
  ['delete goal', `delete from public.goals where match_id = '${fxMatch}' returning id`],
]
const wrote = (r) => !r.error && r.rows.length > 0

for (const [label, who] of NON_MEMBERS) {
  test(`v2 RLS: ${label} cannot insert/update/delete nights, attendance, matches, goals`, async () => {
    for (const [what, sql] of WRITES) assert.ok(!wrote(await as(db, who, sql, [], { rollback: true })), `${label}: ${what}`)
    assert.equal(await count(db, `select count(*)::int as n from public.goals where match_id = $1 and at_ms = 0`, [fxMatch]), 1)
  })
}

test('v2 RLS: a member (active player code, any case/spaces) can insert/update/delete all four', async () => {
  for (const who of [MEMBER, { code: ` ${C.p1.toUpperCase()} ` }])
    for (const [what, sql] of WRITES) {
      const r = await as(db, who, sql, [], { rollback: true })
      assert.ok(wrote(r), `${what}: ${r.error}`)
    }
})

test('v2 RLS: the admin (by his code) can insert/update/delete all four', async () => {
  for (const [what, sql] of WRITES) {
    const r = await as(db, 'admin', sql, [], { rollback: true })
    assert.ok(wrote(r), `${what}: ${r.error}`)
  }
})

test('v2 RLS: rolled-back writes left the fixtures as they were', async () => {
  assert.equal(await count(db, `select count(*)::int as n from public.nights where id = $1`, [fx.night]), 1)
  assert.equal(await count(db, `select count(*)::int as n from public.attendance where night_id = $1`, [fx.night]), 2)
  assert.equal(await count(db, `select count(*)::int as n from public.matches where id = $1 and clock_ms = 0`, [fxMatch]), 1)
})

test('v2 RLS: members and the admin read nights, attendance, matches, goals; nobody else does', async () => {
  for (const [label, who] of [['member', MEMBER], ['admin', 'admin']])
    for (const t of ['nights', 'attendance', 'matches', 'goals']) {
      const r = await as(db, who, `select * from public.${t}`)
      assert.ok(!r.error && r.rows.length > 0, `${label} reads ${t}: ${r.error}`)
    }
  for (const [label, who] of NON_MEMBERS)
    for (const t of ['groups', 'players', 'nights', 'attendance', 'matches', 'goals']) {
      const r = await as(db, who, `select * from public.${t}`)
      assert.ok(r.error || r.rows.length === 0, `${label} reads ${t}`)
    }
})

test('v2 RLS: is_member() is true only for active codes and admin', async () => {
  const isMember = async (who) => (await as(db, who, 'select public.is_member() as m')).rows[0].m
  for (const [label, who] of NON_MEMBERS) assert.equal(await isMember(who), false, label)
  assert.equal(await isMember(MEMBER), true)
  assert.equal(await isMember('admin'), true)
})

test('v2: a member still cannot read ballots or codes', async () => {
  for (const t of ['player_codes', 'ballots']) {
    const r = await as(db, MEMBER, `select * from public.${t}`)
    assert.ok(r.error || r.rows.length === 0, t)
  }
})

test('v2: a member cannot make himself admin, edit players or write ballots', async () => {
  await as(db, MEMBER, `insert into public.admins values ('${OTHER}')`)
  await as(db, MEMBER, `update public.players set name = 'hacked'`)
  await as(db, MEMBER, `update public.players set is_admin = true where id = $1`, [P.p0])
  assert.equal((await as(db, MEMBER, 'select public.is_admin() as a')).rows[0].a, false)
  await as(db, MEMBER, `insert into public.ballots values ($1, $2)`, [P.p0, [P.p1]])
  assert.equal(await count(db, 'select count(*)::int as n from public.admins'), 0)
  assert.equal(await count(db, `select count(*)::int as n from public.players where name = 'hacked'`), 0)
  assert.equal(await count(db, 'select count(*)::int as n from public.ballots where voter_id = $1', [P.p0]), 0)
})

test('v2: anon and members cannot call admin_ratings or any private helper', async () => {
  const calls = [
    'select * from public.admin_ratings()',
    `select * from private.player_scores('${G.id}')`,
    `select private.imbalance('{1}', '{2}', '{1,2}')`,
    'select * from private.combos(3, 2)',
    `select * from private.best_fill('{1}', '{2}', 0, '{1,2}')`,
    `select private.ids_json('{1}', '{}')`,
  ]
  for (const who of ['anon', MEMBER, 'other'])
    for (const sql of calls) assert.ok((await as(db, who, sql)).error, `${JSON.stringify(who)}: ${sql}`)
})

// ───────────── v2: make_teams ─────────────

const T = Array.from({ length: 12 }, (_, i) => `t${i}`)
const teamsNight = await addNight([...T, 'gone']) // the inactive player attends too but must be ignored
const makeTeams = (who, bench = []) =>
  as(db, who, 'select public.make_teams($1, $2) as r', [teamsNight.night, bench.map((n) => P[n])])

async function ratingsByAdmin() {
  const rows = (await as(db, 'admin', 'select * from public.admin_ratings()')).rows
  return Object.fromEntries(rows.map((r) => [r.player_id, r.score === null ? 50 : Number(r.score)]))
}

test('make_teams: refuses non-members', async () => {
  for (const [label, who] of NON_MEMBERS) assert.match((await makeTeams(who)).error ?? '', /not allowed/, label)
})

test('make_teams: refuses fewer than 8 players (bench excluded, inactive not counted)', async () => {
  assert.match((await makeTeams(MEMBER, ['t0', 't1', 't2', 't3', 't4'])).error ?? '', /need at least 8 players/)
  const small = await addNight(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'gone'])
  const r = await as(db, MEMBER, 'select public.make_teams($1) as r', [small.night])
  assert.match(r.error ?? '', /need at least 8 players/)
  // a group of 5 a side splits from 6 players
  await db.query('update public.groups set team_size = 5 where id = $1', [G.id])
  const six = await addNight(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'])
  const ok = await as(db, MEMBER, 'select public.make_teams($1) as r', [six.night])
  await db.query('update public.groups set team_size = 6 where id = $1', [G.id])
  assert.ok(!ok.error, ok.error)
  assert.equal(ok.rows[0].r.a.length + ok.rows[0].r.b.length, 6)
})

test('make_teams: returns only {a, b} with uuid arrays, 6 v 6, everyone once, no inactive', async () => {
  const r = await makeTeams(MEMBER)
  assert.ok(!r.error, r.error)
  const { a, b } = r.rows[0].r
  assert.deepEqual(Object.keys(r.rows[0].r).sort(), ['a', 'b'])
  assert.ok([...a, ...b].every((id) => typeof id === 'string' && UUID.test(id)))
  assert.equal(a.length, 6)
  assert.equal(b.length, 6)
  assert.deepEqual([...a, ...b].map((id) => P[id]).sort(), [...T].sort())
})

test('make_teams: bench is excluded and odd count splits ceil/floor (6 v 5)', async () => {
  const r = await makeTeams(MEMBER, ['t3'])
  assert.ok(!r.error, r.error)
  const { a, b } = r.rows[0].r
  assert.equal(a.length, 6)
  assert.equal(b.length, 5)
  assert.ok(![...a, ...b].includes(P.t3))
  const r2 = await makeTeams('admin', ['t3', 't4', 't5'])
  assert.equal(r2.rows[0].r.a.length, 5)
  assert.equal(r2.rows[0].r.b.length, 4)
})

test('make_teams: imbalance within +4 of the best possible split (5 runs, distinct ratings)', async () => {
  const rating = await ratingsByAdmin()
  const ratingOf = (id) => rating[id]
  const tIds = T.map((n) => P[n])
  assert.equal(new Set(tIds.map(ratingOf)).size, 12, 'ratings are distinct')
  let best = Infinity
  for (let mask = 0; mask < 1 << 12; mask++) {
    const a = tIds.filter((_, i) => mask & (1 << i))
    if (a.length !== 6) continue
    best = Math.min(best, imbalance(a, tIds.filter((_, i) => !(mask & (1 << i))), ratingOf))
  }
  for (let run = 0; run < 5; run++) {
    const { a, b } = (await makeTeams(MEMBER)).rows[0].r
    const got = imbalance(a, b, ratingOf)
    assert.ok(got <= best + 4, `run ${run}: ${got} vs best ${best}`)
  }
})

test('make_teams: re-roll gives different teams (equal ratings)', async () => {
  const eq = await addNight(range(0, 12))
  const seen = new Set()
  for (let run = 0; run < 6; run++) {
    const { a } = (await as(db, MEMBER, 'select public.make_teams($1) as r', [eq.night])).rows[0].r
    seen.add(sorted(a).join())
  }
  assert.ok(seen.size > 1)
})

test('make_teams: two keepers-only always end up on different teams (5 runs)', async () => {
  await db.query(`update public.players set position = 'gk' where name in ('t0', 't1')`)
  try {
    for (let run = 0; run < 5; run++) {
      const { a, b } = (await makeTeams(MEMBER)).rows[0].r
      assert.ok(a.includes(P.t0) !== a.includes(P.t1), `run ${run}`)
      assert.ok(b.includes(P.t0) !== b.includes(P.t1), `run ${run}`)
    }
  } finally {
    await db.query(`update public.players set position = 'any' where name in ('t0', 't1')`)
  }
})

// ───────────── v2: suggest_rotation ─────────────

// Match 1 had p0..p5 (A) v p6..p11 (B), A won.
const match1 = (extra = {}) => ({ num: 1, team_a: range(0, 6), team_b: range(6, 12), bench: [], winner: 'a', ...extra })

async function rotate(present, matches, { keepers = [], who = MEMBER } = {}) {
  await db.query(`update public.players set position = case when name = any($1) then 'gk' else 'any' end where name like 'p%'`, [keepers])
  const { night, matchIds } = await addNight(present, matches)
  const r = await as(db, who, 'select public.suggest_rotation($1) as r', [matchIds.at(-1)])
  await db.query(`update public.players set position = 'any' where name like 'p%'`)
  if (r.error) return { error: r.error, night }
  const { stays, ...lists } = r.rows[0].r
  const out = Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.map((id) => P[id])]))
  return { ...out, stays, raw: lists, night }
}

test('rotation: refuses non-members', async () => {
  for (const [label, who] of NON_MEMBERS)
    assert.match((await rotate(range(0, 14), [match1()], { who })).error ?? '', /not allowed/, label)
})

test('rotation: refuses a live match, a finished match without winner, and an unknown match', async () => {
  assert.match((await rotate(range(0, 14), [match1({ status: 'live', winner: null })])).error ?? '', /match not finished/)
  assert.match((await rotate(range(0, 14), [match1({ status: 'live' })])).error ?? '', /match not finished/)
  assert.match((await rotate(range(0, 14), [match1({ winner: null })])).error ?? '', /match not finished/)
  const r = await as(db, MEMBER, 'select public.suggest_rotation(gen_random_uuid())')
  assert.match(r.error ?? '', /match not finished/)
})

test('rotation: returns only team_a/team_b/bench/leaving/entering with uuid arrays', async () => {
  const res = await rotate(range(0, 14), [match1()])
  assert.deepEqual(Object.keys(res.raw).sort(), ['bench', 'entering', 'leaving', 'team_a', 'team_b'])
  assert.equal(res.stays, 'a')
  assert.ok(Object.values(res.raw).flat().every((id) => UUID.test(id)))
})

test('rotation: winner stays, all waiting come in, same number leave the loser', async () => {
  const res = await rotate(range(0, 14), [match1()])
  assert.deepEqual(res.team_a, range(0, 6))
  assert.equal(res.team_b.length, 6)
  assert.deepEqual(sorted(res.entering), ['p12', 'p13'])
  assert.ok(res.team_b.includes('p12') && res.team_b.includes('p13'))
  assert.equal(res.leaving.length, 2)
  assert.ok(res.leaving.every((n) => range(6, 12).includes(n)))
  assert.deepEqual(sorted(res.bench), sorted(res.leaving))
})

test('rotation: winner B stays as team_b', async () => {
  const res = await rotate(range(0, 14), [match1({ winner: 'b' })])
  assert.deepEqual(res.team_b, range(6, 12))
  assert.ok(res.team_a.includes('p12') && res.team_a.includes('p13'))
  assert.ok(res.leaving.every((n) => range(0, 6).includes(n)))
})

test('rotation: a draw in the first match → team A stays (both teams just came on)', async () => {
  const res = await rotate(range(0, 18), [match1({ winner: 'draw' })])
  assert.equal(res.stays, 'a')
  assert.deepEqual(sorted(res.team_a), sorted(range(0, 6)))
  assert.deepEqual(sorted(res.leaving), sorted(range(6, 12)))
})

test('rotation: a draw → the team that has been on longer goes off (same as teams.js stayingSide)', async () => {
  // Match 1: A (p0..p5) beat B (p6..p11). Match 2: A again v newcomers p12..p17, a draw: A has been on longer.
  const m2 = { num: 2, team_a: range(0, 6), team_b: range(12, 18), bench: range(6, 12), winner: 'draw' }
  const res = await rotate(range(0, 18), [match1(), m2])
  assert.equal(res.stays, 'b')
  assert.deepEqual(sorted(res.team_b), sorted(range(12, 18)))
  assert.deepEqual(sorted(res.leaving), sorted(range(0, 6)))
  const byName = (list) => list.map((n) => n)
  const js = stayingSide({ ...m2, team_a: byName(m2.team_a), team_b: byName(m2.team_b) }, range(0, 18), [match1(), m2])
  assert.equal(js, 'b')
})

test('rotation: longest streak leaves first, same result as teams.js suggestRotation', async () => {
  // p6 and p7 also played the match before (streak 2), the rest of B just came in.
  const m0 = { num: 0, team_a: ['p6', 'p7', 'p0', 'p1', 'p2', 'p3'], team_b: ['p4', 'p5', 'p12', 'p13'], bench: range(8, 12), winner: 'b' }
  const m = match1({ bench: ['p12', 'p13'] })
  const res = await rotate(range(0, 14), [m0, m])
  assert.deepEqual(sorted(res.leaving), ['p6', 'p7'])

  const presentIds = (await db.query('select player_id from public.attendance where night_id = $1 order by arrived_at, player_id', [res.night])).rows.map((r) => P[r.player_id])
  const playersById = Object.fromEntries(presentIds.map((id) => [id, { id, position: 'any' }]))
  const js = suggestRotation({ match: m, presentIds, playersById, ratingOf: () => 50, tonightMatches: [m0, m] })
  assert.deepEqual(res.team_a, js.team_a)
  for (const k of ['team_b', 'bench', 'leaving', 'entering']) assert.deepEqual(sorted(res[k]), sorted(js[k]), k)
})

test('rotation: strength breaks ties between equally tired players (same as teams.js)', async () => {
  // f0 votes p6 first and p12 second → p6 = 100, p12 ≈ 88.9, every other p player stays at 50.
  await db.query('insert into public.ballots (voter_id, ranking) values ($1, $2)', [
    P.f0, [P.p6, P.p12, ...Array.from({ length: 8 }, (_, i) => P[`f${i + 1}`])],
  ])
  try {
    const m = match1({ bench: ['p12'] })
    const res = await rotate(range(0, 13), [m])
    // A strong player comes in, so the strong p6 should be the one to rest.
    assert.deepEqual(res.leaving, ['p6'])
    const rating = await ratingsByAdmin()
    const presentIds = range(0, 13)
    const js = suggestRotation({
      match: m, presentIds, playersById: Object.fromEntries(presentIds.map((id) => [id, { id, position: 'any' }])),
      ratingOf: (n) => rating[P[n]], tonightMatches: [m],
    })
    for (const k of ['team_a', 'team_b', 'bench', 'leaving', 'entering']) assert.deepEqual(sorted(res[k]), sorted(js[k]), k)
  } finally {
    await db.query('delete from public.ballots where voter_id = $1', [P.f0])
  }
})

test('rotation: losing team keeps its keeper-only player (5 runs)', async () => {
  for (let run = 0; run < 5; run++) {
    const res = await rotate(range(0, 14), [match1()], { keepers: ['p6'] })
    assert.ok(res.team_b.includes('p6'), `run ${run}`)
    assert.ok(!res.leaving.includes('p6'))
    assert.equal(res.leaving.length, 2)
  }
})

test('rotation: a waiting keeper-only replaces the losing keeper-only', async () => {
  const res = await rotate(range(0, 14), [match1()], { keepers: ['p6', 'p12'] })
  assert.ok(res.leaving.includes('p6'))
  assert.ok(res.team_b.includes('p12'))
  assert.equal(res.leaving.length, 2)
})

test('rotation: newcomer who arrived mid-match comes in; someone who went home is dropped', async () => {
  const present = range(0, 15).filter((n) => n !== 'p3') // p3 went home, p14 arrived
  const res = await rotate(present, [match1()])
  assert.equal(res.team_a.length, 6) // winner refilled to 6
  assert.ok(!res.team_a.includes('p3') && !res.team_b.includes('p3') && !res.bench.includes('p3'))
  assert.ok(range(0, 6).filter((n) => n !== 'p3').every((n) => res.team_a.includes(n)))
  assert.ok(res.entering.includes('p14'))
  assert.equal(res.team_b.length, 6)
  assert.equal(res.team_a.length + res.team_b.length + res.bench.length, 14)
  assert.equal(new Set([...res.team_a, ...res.team_b, ...res.bench]).size, 14)
})

test('rotation: no one waiting → same teams', async () => {
  const res = await rotate(range(0, 12), [match1()])
  assert.deepEqual(res.leaving, [])
  assert.deepEqual(res.entering, [])
  assert.deepEqual(res.team_a, range(0, 6))
  assert.deepEqual(sorted(res.team_b), sorted(range(6, 12)))
  assert.deepEqual(res.bench, [])
})

test('rotation: more waiting than places → whole losing team rests except its keeper-only', async () => {
  const res = await rotate(range(0, 18), [match1()], { keepers: ['p6'] })
  assert.deepEqual(res.team_a, range(0, 6))
  assert.deepEqual(sorted(res.leaving), sorted(range(7, 12)))
  assert.equal(res.entering.length, 5)
  assert.ok(res.entering.every((n) => range(12, 18).includes(n)))
  assert.ok(res.team_b.includes('p6'))
  assert.equal(res.team_b.length, 6)
  assert.equal(res.bench.length, 6)
})

test('rotation: people went home → winner gives players so teams are even (5 v 5)', async () => {
  const res = await rotate(range(0, 10), [match1()])
  assert.equal(res.team_a.length, 5)
  assert.equal(res.team_b.length, 5)
  assert.deepEqual(res.bench, [])
})

test("rotation: teams are never bigger than the group's team size (4 a side: 4 v 4, the rest wait)", async () => {
  await db.query('update public.groups set team_size = 4 where id = $1', [G.id])
  try {
    const res = await rotate(range(0, 12), [match1()])
    assert.equal(res.team_a.length, 4)
    assert.equal(res.team_b.length, 4)
    assert.equal(res.bench.length, 4)
  } finally {
    await db.query('update public.groups set team_size = 6 where id = $1', [G.id])
  }
})

test('rotation: more waiting than places → a waiting keeper-only replaces the losing one', async () => {
  const res = await rotate(range(0, 18), [match1()], { keepers: ['p6', 'p13'] })
  assert.ok(res.leaving.includes('p6'))
  assert.ok(res.team_b.includes('p13'))
  assert.equal(res.team_b.length, 6)
})

test("rotation: refilling a short winning team never takes the losers' keeper-only (5 runs)", async () => {
  const present = range(0, 13).filter((n) => n !== 'p5') // p5 went home, p12 waiting
  for (let run = 0; run < 5; run++) {
    const res = await rotate(present, [match1()], { keepers: ['p6'] })
    assert.ok(!res.team_a.includes('p6'), `run ${run}`)
    assert.ok(res.team_b.includes('p6'))
    assert.equal(res.team_a.length, 6)
  }
})

// ───────────── Self sign-up and profile ─────────────

await addPlayer('prof')
const profileCall = (who, code, { emoji = '🦁', photo = null, position = 'mid', canGk = false, nickname = null } = {}) =>
  as(db, who, 'select public.update_my_profile($1, $2, $3, $4, $5, $6)', [code, emoji, photo, position, canGk, nickname])
const playerRow = (name) => one(db, 'select * from public.players where id = $1', [P[name]])
const allOthers = async (name) => (await db.query('select * from public.players where id <> $1 order by id', [P[name]])).rows
const joinCode = async () => (await one(db, 'select join_code from public.groups where id = $1', [G.id])).join_code

test('profile: update_my_profile changes only the caller\'s own row', async () => {
  const others = await allOthers('prof')
  const r = await profileCall('anon', ` ${C.prof.toUpperCase()} `, { emoji: '🦁', photo: 'data:image/jpeg;base64,AAAA', position: 'att', canGk: true, nickname: '  Leo  ' })
  assert.ok(!r.error, r.error)
  const me = await playerRow('prof')
  assert.equal(me.emoji, '🦁')
  assert.equal(me.photo, 'data:image/jpeg;base64,AAAA')
  assert.equal(me.position, 'att')
  assert.equal(me.can_gk, true)
  assert.equal(me.nickname, 'Leo')
  assert.deepEqual(await allOthers('prof'), others)
})

test('profile: keep_photo leaves the photo; photo_v follows every photo change', async () => {
  const photoV = async () => (await playerRow('prof')).photo_v
  await profileCall('anon', C.prof, { photo: 'data:image/jpeg;base64,AAAA' })
  const v1 = await photoV()
  assert.match(v1, /^[0-9a-f]{10}$/)
  const keep = await as(db, 'anon', 'select public.update_my_profile($1, $2, null, null, null, $3, null, true)', [C.prof, '🐯', 'K'])
  assert.ok(!keep.error, keep.error)
  const me = await playerRow('prof')
  assert.equal(me.photo, 'data:image/jpeg;base64,AAAA')
  assert.equal(me.emoji, '🐯')
  assert.equal(me.photo_v, v1)
  await profileCall('anon', C.prof, { photo: 'data:image/jpeg;base64,BBBB' })
  assert.notEqual(await photoV(), v1)
  await profileCall('anon', C.prof, { photo: null })
  assert.equal(await photoV(), null)
  // nobody writes it directly
  assert.ok((await as(db, MEMBER, `update public.players set photo_v = 'x' where id = $1`, [P.prof])).error)
})

test('profile: name and active stay as they were', async () => {
  await profileCall(MEMBER, C.prof, { nickname: 'x' })
  const me = await playerRow('prof')
  assert.equal(me.name, 'prof')
  assert.equal(me.active, true)
})

test('profile: rejects a wrong code and an inactive player\'s code', async () => {
  assert.match((await profileCall('anon', 'nope1234')).error ?? '', /invalid code/)
  assert.match((await profileCall('anon', C.gone)).error ?? '', /invalid code/)
  assert.match((await profileCall('anon', null)).error ?? '', /invalid code/)
})

test('profile: position gk forces can_gk; empty nickname becomes null', async () => {
  assert.ok(!(await profileCall('anon', C.prof, { position: 'gk', canGk: false, nickname: '   ' })).error)
  const me = await playerRow('prof')
  assert.equal(me.position, 'gk')
  assert.equal(me.can_gk, true)
  assert.equal(me.nickname, null)
  await profileCall('anon', C.prof, { position: 'def', canGk: false })
  assert.equal((await playerRow('prof')).can_gk, false)
})

test('profile: oversize photo, too-long nickname and unknown position are rejected', async () => {
  const before = await playerRow('prof')
  assert.ok((await profileCall('anon', C.prof, { photo: 'x'.repeat(300001) })).error)
  assert.ok((await profileCall('anon', C.prof, { nickname: 'n'.repeat(25) })).error)
  assert.ok((await profileCall('anon', C.prof, { position: 'striker' })).error)
  assert.deepEqual(await playerRow('prof'), before)
  assert.ok(!(await profileCall('anon', C.prof, { photo: 'x'.repeat(300000), nickname: 'n'.repeat(24) })).error)
})

test('join: valid join link adds the player and returns a working personal code', async () => {
  const jc = await joinCode()
  assert.match(jc, /^[a-hjkmnp-z2-9]{6}$/)
  const r = await as(db, 'anon', 'select public.join_team($1, $2, $3, $4, $5, $6, $7) as code', [
    ` ${jc.toUpperCase()} `, '  Newbie  ', '🐯', null, 'gk', false, ' Tiger ',
  ])
  assert.ok(!r.error, r.error)
  const code = r.rows[0].code
  assert.match(code, /^[0-9a-f]{8}$/)
  const v = await as(db, 'anon', 'select * from public.voter_by_code($1)', [code])
  assert.equal(v.rows[0].name, 'Newbie')
  const row = await one(db, 'select * from public.players where id = $1', [v.rows[0].player_id])
  assert.equal(row.emoji, '🐯')
  assert.equal(row.position, 'gk')
  assert.equal(row.can_gk, true)
  assert.equal(row.nickname, 'Tiger')
  assert.equal(row.active, true)
  // the new player is a member right away
  assert.equal((await as(db, { code }, 'select public.is_member() as m')).rows[0].m, true)
})

test('join: wrong join code, empty/too-long name and taken name (case, spaces) are rejected', async () => {
  const jc = await joinCode()
  const join = (j, name) => as(db, 'anon', 'select public.join_team($1, $2, $3, $4, $5, $6, $7)', [j, name, '⚽', null, 'any', false, null])
  const before = await count(db, 'select count(*)::int as n from public.players')
  assert.match((await join('wrongcode0', 'Someone')).error ?? '', /invalid join code/)
  assert.match((await join(null, 'Someone')).error ?? '', /invalid join code/)
  assert.match((await join(jc, '   ')).error ?? '', /name required/)
  assert.match((await join(jc, null)).error ?? '', /name required/)
  assert.match((await join(jc, 'n'.repeat(31))).error ?? '', /name required/)
  assert.match((await join(jc, ' NEWBIE ')).error ?? '', /name taken/)
  assert.match((await join(jc, 'P0')).error ?? '', /name taken/)
  assert.equal(await count(db, 'select count(*)::int as n from public.players'), before)
  // the name of a player who left (inactive) is free again
  assert.ok(!(await join(jc, 'gone')).error)
})

test('join: refuses when there are already 150 players', async () => {
  const jc = await joinCode()
  await db.exec('begin')
  try {
    await db.query(`insert into public.players (group_id, name) select $1, 'filler ' || g from generate_series(1, 150 - (select count(*) from public.players where group_id = $1)::int) g`, [G.id])
    assert.equal(await count(db, 'select count(*)::int as n from public.players where group_id = $1', [G.id]), 150)
    await db.exec('set role anon')
    await assert.rejects(
      db.query('select public.join_team($1, $2, $3, $4, $5, $6, $7)', [jc, 'Late', '⚽', null, 'any', false, null]),
      /too many players/,
    )
  } finally {
    await db.exec('rollback')
    await db.exec('reset role')
  }
})

// ───────────── Claiming a name from the join link ─────────────

const claim = (who, jc, playerId, { emoji = '🦊', photo = null, position = 'def', canGk = false, nickname = null } = {}) =>
  as(db, who, 'select public.claim_player($1, $2, $3, $4, $5, $6, $7) as code', [jc, playerId, emoji, photo, position, canGk, nickname])
const claimedAt = async (name) => (await one(db, 'select claimed_at from public.players where id = $1', [P[name]])).claimed_at

test('claim: picking an unclaimed name returns his code, saves the profile, and locks the name', async () => {
  await addPlayer('regular')
  assert.equal(await claimedAt('regular'), null)
  const jc = await joinCode()
  const r = await claim('anon', ` ${jc.toUpperCase()} `, P.regular, { position: 'gk', nickname: ' Wall ' })
  assert.ok(!r.error, r.error)
  assert.equal(r.rows[0].code, C.regular)
  const row = await one(db, 'select * from public.players where id = $1', [P.regular])
  assert.equal(row.emoji, '🦊')
  assert.equal(row.position, 'gk')
  assert.equal(row.can_gk, true)
  assert.equal(row.nickname, 'Wall')
  assert.equal(row.name, 'regular')
  assert.ok(row.claimed_at)
  // someone else can't take it now
  assert.match((await claim('anon', jc, P.regular)).error ?? '', /already claimed/)
})

test('claim: wrong join code, unknown or inactive player are refused', async () => {
  await addPlayer('regular2')
  const jc = await joinCode()
  assert.match((await claim('anon', 'wrong', P.regular2)).error ?? '', /invalid join code/)
  assert.match((await claim('anon', jc, '00000000-0000-0000-0000-000000000000')).error ?? '', /already claimed/)
  assert.match((await claim('anon', jc, P.gone)).error ?? '', /already claimed/)
  assert.equal(await claimedAt('regular2'), null)
})

test('claim: voting or editing the profile with the personal link locks the name too', async () => {
  await addPlayer('voterx')
  await addPlayer('editor')
  const jc = await joinCode()
  assert.ok(!(await as(db, 'anon', 'select public.submit_ballot($1, $2)', [C.voterx, [P.p1]])).error)
  assert.ok(await claimedAt('voterx'))
  assert.ok(!(await profileCall('anon', C.editor)).error)
  assert.ok(await claimedAt('editor'))
  assert.match((await claim('anon', jc, P.voterx)).error ?? '', /already claimed/)
  assert.match((await claim('anon', jc, P.editor)).error ?? '', /already claimed/)
  await db.query('delete from public.ballots where voter_id = $1', [P.voterx])
})

test('claim: someone who joined with a new name is already locked', async () => {
  const jc = await joinCode()
  const r = await as(db, 'anon', 'select public.join_team($1, $2, $3, $4, $5, $6, $7) as code', [jc, 'Brand New', null, null, null, false, null])
  assert.ok(!r.error, r.error)
  const id = (await one(db, `select id, claimed_at from public.players where name = 'Brand New'`))
  assert.ok(id.claimed_at)
  assert.match((await claim('anon', jc, id.id)).error ?? '', /already claimed/)
})

test('claim: only the admin can release a name; then it can be picked again', async () => {
  await addPlayer('mistake')
  const jc = await joinCode()
  assert.ok(!(await claim('anon', jc, P.mistake)).error)
  await as(db, MEMBER, 'update public.players set claimed_at = null where id = $1', [P.mistake])
  await as(db, 'other', 'update public.players set claimed_at = null where id = $1', [P.mistake])
  assert.ok(await claimedAt('mistake'))
  assert.ok(!(await as(db, 'admin', 'update public.players set claimed_at = null where id = $1', [P.mistake])).error)
  assert.equal(await claimedAt('mistake'), null)
  assert.ok(!(await claim('anon', jc, P.mistake)).error)
})

test('invite: every member (and the admin) reads his group, with its join code; others see no group', async () => {
  const jc = await joinCode()
  for (const [label, who] of NON_MEMBERS)
    assert.equal((await as(db, who, 'select * from public.groups')).rows?.length ?? 0, 0, label)
  for (const who of [MEMBER, 'admin']) {
    const rows = (await as(db, who, 'select * from public.groups')).rows
    assert.equal(rows.length, 1)
    assert.equal(rows[0].join_code, jc)
    assert.equal(rows[0].name, 'G')
  }
})

// ───────────── Weekly game settings ─────────────

test('schedule: members read day/time; only the admin changes it (and the group name)', async () => {
  const sched = async () => one(db, 'select weekday, kickoff from public.groups where id = $1', [G.id])
  assert.deepEqual((await as(db, MEMBER, 'select weekday, kickoff from public.groups')).rows, [{ weekday: 6, kickoff: '9:30' }])
  await as(db, MEMBER, `update public.groups set kickoff = '7:00'`)
  await as(db, 'other', `update public.groups set kickoff = '7:00'`)
  await as(db, 'anon', `update public.groups set kickoff = '7:00'`)
  assert.equal((await sched()).kickoff, '9:30')
  assert.ok(!(await as(db, 'admin', `update public.groups set weekday = 5, kickoff = '18:00', name = 'Gx'`)).error)
  assert.deepEqual(await sched(), { weekday: 5, kickoff: '18:00' })
  assert.ok((await as(db, 'admin', `update public.groups set kickoff = 'soon'`)).error)
  // the join code is replaced only through new_join_code()
  assert.ok((await as(db, 'admin', `update public.groups set join_code = 'abcdef'`)).error)
  await db.query(`update public.groups set weekday = 6, kickoff = '9:30', name = 'G' where id = $1`, [G.id])
})

test('rules: old groups keep 6 per team, 7 minutes, first to 3; only the admin changes them, within limits', async () => {
  const rules = 'select team_size, match_minutes, win_goals, venue from public.groups'
  assert.deepEqual((await as(db, MEMBER, rules)).rows, [{ team_size: 6, match_minutes: 7, win_goals: 3, venue: null }])
  await as(db, MEMBER, 'update public.groups set team_size = 9')
  assert.equal((await one(db, 'select team_size from public.groups where id = $1', [G.id])).team_size, 6)
  assert.ok(!(await as(db, 'admin', `update public.groups set team_size = 5, match_minutes = 10, win_goals = 0, venue = 'Park'`)).error)
  assert.ok(!(await as(db, 'admin', 'update public.groups set match_minutes = 120')).error) // a 2-hour game
  for (const bad of ['team_size = 2', 'team_size = 12', 'match_minutes = 1', 'match_minutes = 121', 'win_goals = 11', `venue = '${'x'.repeat(61)}'`])
    assert.ok((await as(db, 'admin', `update public.groups set ${bad}`)).error, bad)
  await db.query(`update public.groups set team_size = 6, match_minutes = 7, win_goals = 3, venue = null where id = $1`, [G.id])
})

test('options: start empty; only the admin changes them; unknown keys and values are refused', async () => {
  const opts = async () => (await one(db, 'select options from public.groups where id = $1', [G.id])).options
  assert.deepEqual(await opts(), {})
  assert.deepEqual((await as(db, MEMBER, 'select options from public.groups')).rows, [{ options: {} }])
  for (const who of [MEMBER, 'other', 'anon']) await as(db, who, `update public.groups set options = '{"lang":"en"}'`)
  assert.deepEqual(await opts(), {})
  const set = (o) => as(db, 'admin', 'update public.groups set options = $1', [o])
  assert.ok(!(await set({ lang: 'en' })).error)
  assert.deepEqual(await opts(), { lang: 'en' })
  assert.ok(!(await set({ lang: 'en', format: 'game', periods: 2, break_minutes: 10, extra_minutes: 0, tie: 'draw', team_a: 'red', team_b: 'white' })).error)
  await set({ lang: 'en' })
  for (const bad of [{ lang: 'fr' }, { lang: 3 }, { color: 'red' }, [], 'he', { periods: 2.5 }, { periods: '2' }, { periods: 5 },
    { break_minutes: 31 }, { extra_minutes: -1 }, { tie: 'coin' }, { team_a: 'pink' }, { team_a: 'orange' }, { team_a: 'red', team_b: 'red' }])
    assert.ok((await set(bad)).error, JSON.stringify(bad))
  assert.deepEqual(await opts(), { lang: 'en' })
  // the join link tells the group's language
  assert.equal((await as(db, 'anon', 'select public.group_preview($1) as g', [G.joinCode])).rows[0].g.lang, 'en')
  await db.query(`update public.groups set options = '{}' where id = $1`, [G.id])
  assert.equal((await as(db, 'anon', 'select public.group_preview($1) as g', [G.joinCode])).rows[0].g.lang, null)
})

test('options: create_group takes them from the settings; bad ones are refused', async () => {
  const make = (settings) => as(db, 'anon', 'select public.create_group($1, $2, null, null, null, null, null, null, $3) as code', ['Opts', 'Kim', settings])
  const r = await make({ options: { lang: 'en' } })
  assert.ok(!r.error, r.error)
  assert.deepEqual((await as(db, { code: r.rows[0].code }, 'select options from public.groups')).rows[0].options, { lang: 'en' })
  assert.match((await make({ options: { lang: 'xx' } })).error ?? '', /invalid settings/)
  assert.match((await make({ options: { nope: 1 } })).error ?? '', /invalid settings/)
})

test('rules: a new match keeps the group\'s periods, break, extra time and tie rule; changing them later does not touch it', async () => {
  await db.query(`update public.groups set options = '{"periods": 2, "break_minutes": 10, "tie": "draw", "team_a": "red"}' where id = $1`, [G.id])
  const { matchIds } = await addNight(range(0, 12), [match1({ winner: null, status: 'live' })])
  const m = await one(db, 'select rules, period, break_since from public.matches where id = $1', [matchIds[0]])
  assert.deepEqual(m.rules, { periods: 2, break_minutes: 10, tie: 'draw' })
  assert.equal(m.period, 1)
  await db.query(`update public.groups set options = '{}' where id = $1`, [G.id])
  // the manager moves it to half-time and the second half; the rules stay, a player can't change them
  assert.ok(!(await as(db, MEMBER, `update public.matches set phase = 'break', break_since = now(), rules = '{}' where id = $1`, [matchIds[0]])).error)
  assert.ok(!(await as(db, MEMBER, `update public.matches set phase = 'regular', period = 2, break_since = null where id = $1`, [matchIds[0]])).error)
  assert.deepEqual((await one(db, 'select rules, period from public.matches where id = $1', [matchIds[0]])), { rules: { periods: 2, break_minutes: 10, tie: 'draw' }, period: 2 })
  // a draw can be saved; nonsense can't
  assert.ok(!(await as(db, MEMBER, `update public.matches set status = 'finished', winner = 'draw' where id = $1`, [matchIds[0]])).error)
  for (const bad of [`winner = 'c'`, `phase = 'nap'`, 'period = 5'])
    assert.ok((await as(db, MEMBER, `update public.matches set ${bad} where id = $1`, [matchIds[0]])).error, bad)
})

test('rules: a match keeps the rules it started with, even when the group changes them or a player tries', async () => {
  await db.query('update public.groups set match_minutes = 12, win_goals = 5 where id = $1', [G.id])
  const { matchIds: [m] } = await addNight(['p0', 'p1'], [{ num: 1, team_a: ['p0'], team_b: ['p1'], status: 'live', winner: null }])
  const of = async () => one(db, 'select match_minutes, win_goals from public.matches where id = $1', [m])
  assert.deepEqual(await of(), { match_minutes: 12, win_goals: 5 })
  await db.query('update public.groups set match_minutes = 7, win_goals = 3 where id = $1', [G.id])
  assert.ok(!(await as(db, MEMBER, 'update public.matches set match_minutes = 1, win_goals = 1, clock_ms = 5 where id = $1', [m])).error)
  assert.deepEqual(await of(), { match_minutes: 12, win_goals: 5 })
  assert.equal((await one(db, 'select clock_ms from public.matches where id = $1', [m])).clock_ms, 5)
})

test('cancel: players can create a game night but only the admin cancels or restores it', async () => {
  const day = `date '2030-01-0' + 1`
  assert.match((await as(db, MEMBER, `insert into public.nights (day, cancelled) values (date '2030-01-05', true)`)).error ?? '', /only the admin/)
  const n = await as(db, MEMBER, `insert into public.nights (day) values (date '2030-01-05') returning id, group_id`)
  assert.ok(!n.error, n.error)
  const id = n.rows[0].id
  assert.equal(n.rows[0].group_id, G.id) // lands in the caller's group by itself
  assert.match((await as(db, MEMBER, 'update public.nights set cancelled = true where id = $1', [id])).error ?? '', /only the admin/)
  assert.ok(!(await as(db, 'admin', 'update public.nights set cancelled = true where id = $1', [id])).error)
  assert.match((await as(db, MEMBER, 'update public.nights set cancelled = false where id = $1', [id])).error ?? '', /only the admin/)
  assert.ok(!(await as(db, 'admin', 'update public.nights set cancelled = false where id = $1', [id])).error)
  await db.query('delete from public.nights where id = $1', [id])
  void day
})

// ───────────── Player of the match ─────────────

const mvp = await addNight(range(0, 13), [
  { num: 1, team_a: range(0, 6), team_b: range(6, 12), bench: ['p12'] },
  { num: 2, team_a: range(0, 6), team_b: range(6, 12), status: 'live', winner: null },
])
const vote = (code, match, player) => as(db, 'anon', 'select public.vote_mvp($1, $2, $3)', [code, match, P[player]])

test('mvp: a player who played votes for someone else in that match; re-voting replaces his vote', async () => {
  const [m1] = mvp.matchIds
  assert.ok(!(await vote(C.p0, m1, 'p1')).error)
  assert.ok(!(await vote(C.p6, m1, 'p1')).error)
  assert.ok(!(await vote(C.p7, m1, 'p0')).error)
  assert.ok(!(await vote(C.p7, m1, 'p1')).error) // changed his mind
  const tally = (await as(db, MEMBER, 'select * from public.mvp_tally() where match_id = $1', [m1])).rows
  assert.deepEqual(tally.map((t) => [P[t.player_id], t.votes]), [['p1', 3]])
  const mine = (await as(db, 'anon', 'select * from public.my_mvp_votes($1)', [C.p7])).rows
  assert.deepEqual(mine.map((v) => P[v.player_id]), ['p1'])
})

test('mvp: no voting for yourself, by someone who sat out, for someone who sat out, on a live match, or with a bad code', async () => {
  const [m1, m2] = mvp.matchIds
  assert.match((await vote(C.p2, m1, 'p2')).error ?? '', /pick someone who played/)
  assert.match((await vote(C.p12, m1, 'p1')).error ?? '', /did not play/)
  assert.match((await vote(C.p3, m1, 'p12')).error ?? '', /pick someone who played/)
  assert.match((await vote(C.p3, m2, 'p1')).error ?? '', /match not finished/)
  assert.match((await vote('nope1234', m1, 'p1')).error ?? '', /invalid code/)
  assert.match((await vote(C.gone, m1, 'p1')).error ?? '', /invalid code/)
})

test('mvp: single votes are private (no direct read for anyone but through the totals)', async () => {
  for (const who of ['anon', MEMBER, 'other']) {
    const r = await as(db, who, 'select * from public.mvp_votes')
    assert.ok(r.error || r.rows.length === 0)
  }
})

test('join code: only the admin replaces it; the old link stops working', async () => {
  const old = await joinCode()
  for (const who of ['anon', MEMBER, 'other']) assert.match((await as(db, who, 'select public.new_join_code()')).error ?? '', /not allowed/)
  assert.equal(await joinCode(), old)
  const r = await as(db, 'admin', 'select public.new_join_code() as c')
  assert.ok(!r.error, r.error)
  const fresh = r.rows[0].c
  assert.match(fresh, /^[a-hjkmnp-z2-9]{6}$/)
  assert.equal(await joinCode(), fresh)
  const join = (j, name) => as(db, 'anon', 'select public.join_team($1, $2, $3, $4, $5, $6, $7)', [j, name, '⚽', null, 'any', false, null])
  assert.match((await join(old, 'Another')).error ?? '', /invalid join code/)
  assert.ok(!(await join(fresh.toUpperCase(), 'Another')).error)
})

test('schema: running it again keeps groups and join codes; schema_version still 5', async () => {
  const jc = await joinCode()
  const groups = await count(db, 'select count(*)::int as n from public.groups')
  await db.exec(SCHEMA)
  assert.equal(await joinCode(), jc)
  assert.equal(await count(db, 'select count(*)::int as n from public.groups'), groups)
  assert.equal((await one(db, 'select public.schema_version() as v')).v, 5)
})

// ───────────── Several positions per player ─────────────

test('positions: a player picks several; position/can_gk follow (only {gk} = goalkeeper only)', async () => {
  await addPlayer('multi')
  const set = (positions) => as(db, 'anon', 'select public.update_my_profile($1, null, null, null, null, null, $2)', [C.multi, positions])
  const row = () => one(db, 'select positions, position, can_gk from public.players where id = $1', [P.multi])
  assert.ok(!(await set(['mid', 'def'])).error)
  assert.deepEqual(await row(), { positions: ['def', 'mid'], position: 'any', can_gk: false })
  await set(['att', 'gk'])
  assert.deepEqual(await row(), { positions: ['gk', 'att'], position: 'att', can_gk: true })
  await set(['gk'])
  assert.deepEqual(await row(), { positions: ['gk'], position: 'gk', can_gk: true })
  await set(['gk', 'def', 'mid', 'att', 'def'])
  assert.deepEqual(await row(), { positions: ['gk', 'def', 'mid', 'att'], position: 'any', can_gk: true })
  await set([])
  assert.deepEqual(await row(), { positions: [], position: 'any', can_gk: false })
  assert.match((await set(['striker'])).error ?? '', /invalid position/)
  // the old way (one position + can play in goal) still works and fills positions
  await profileCall('anon', C.multi, { position: 'def', canGk: true })
  assert.deepEqual(await row(), { positions: ['gk', 'def'], position: 'def', can_gk: true })
})

test('positions: the admin sets them directly; join and create take them too', async () => {
  await addPlayer('multi2')
  assert.ok(!(await as(db, 'admin', `update public.players set positions = '{att,mid}' where id = $1`, [P.multi2])).error)
  assert.deepEqual(await one(db, 'select positions, position from public.players where id = $1', [P.multi2]), { positions: ['mid', 'att'], position: 'any' })
  const r = await as(db, 'anon', 'select public.join_team($1, $2, null, null, null, null, null, $3) as code', [await joinCode(), 'Multi3', ['def', 'mid']])
  assert.ok(!r.error, r.error)
  assert.deepEqual((await one(db, `select positions from public.players where name = 'Multi3'`)).positions, ['def', 'mid'])
})

// ═════════════ Many groups: nobody sees or touches another group ═════════════

const H = await newGroup(db, 'H', { adminName: 'hboss', main: false })
for (const n of ['h0', 'h1', 'h2', 'p0']) await addPlayer(n === 'p0' ? 'hp0' : n, { group: H.id }) // a 'p0' twin by name below
const hNight = await addNight(['h0', 'h1'], [{ num: 1, team_a: ['h0'], team_b: ['h1'] }], H.id)
const HM = { code: C.h0 }
const HADMIN = { code: H.adminCode }

test('groups: a member of H reads only H (players, group, nights, matches, goals, ratings, mvp)', async () => {
  const names = (await as(db, HM, 'select name from public.players order by name')).rows.map((r) => r.name)
  assert.deepEqual(names, ['h0', 'h1', 'h2', 'hboss', 'hp0'])
  assert.deepEqual((await as(db, HM, 'select name from public.groups')).rows, [{ name: 'H' }])
  assert.deepEqual((await as(db, HM, 'select id from public.nights')).rows.map((r) => r.id), [hNight.night])
  assert.equal((await as(db, HM, 'select * from public.matches')).rows.length, 1)
  assert.equal((await as(db, HM, 'select * from public.goals')).rows.length, 0)
  assert.equal((await as(db, HM, 'select * from public.mvp_tally()')).rows.length, 0)
  const rat = (await as(db, HADMIN, 'select * from public.admin_ratings()')).rows
  assert.deepEqual(sorted(rat.map((r) => P[r.player_id] ?? 'hboss')), ['h0', 'h1', 'h2', 'hboss', 'hp0'])
  assert.equal((await as(db, HADMIN, 'select * from public.player_codes')).rows.length, 5)
})

test("groups: H cannot write into G's night, nor bring G's players into its own", async () => {
  const tries = [
    [`insert into public.attendance (night_id, player_id) values ('${fx.night}', '${P.h2}') returning player_id`, HM],
    [`insert into public.attendance (night_id, player_id) values ('${hNight.night}', '${P.p5}') returning player_id`, HM],
    [`insert into public.matches (night_id, num, team_a, team_b) values ('${hNight.night}', 9, array['${P.p0}']::uuid[], '{}') returning id`, HM],
    [`insert into public.goals (match_id, team, scorer) values ('${hNight.matchIds[0]}', 'a', '${P.p0}') returning id`, HM],
    [`insert into public.goals (match_id, team) values ('${fxMatch}', 'a') returning id`, HM],
    [`update public.matches set clock_ms = 99 where id = '${fxMatch}' returning id`, HM],
    [`delete from public.nights where id = '${fx.night}' returning id`, HADMIN],
    [`insert into public.nights (group_id, day) values ('${G.id}', '2031-01-01') returning id`, HM],
    [`update public.players set name = 'x' where id = '${P.p0}' returning id`, HADMIN],
    [`delete from public.players where id = '${P.p0}' returning id`, HADMIN],
    [`insert into public.players (group_id, name) values ('${G.id}', 'spy') returning id`, HADMIN],
    [`update public.player_codes set code = 'stolen00' where player_id = '${P.p0}' returning code`, HADMIN],
    [`update public.groups set name = 'x' where id = '${G.id}' returning id`, HADMIN],
  ]
  for (const [sql, who] of tries) assert.ok(!wrote(await as(db, who, sql, [], { rollback: true })), sql)
  // a player of G mixed into H's match by the database owner is refused by the trigger too
  await assert.rejects(db.query(`insert into public.attendance (night_id, player_id) values ($1, $2)`, [hNight.night, P.p1]), /another group/)
})

test("groups: H cannot run G's team tools or vote in G's matches", async () => {
  assert.match((await as(db, HM, 'select public.make_teams($1)', [teamsNight.night])).error ?? '', /not allowed/)
  assert.match((await as(db, HM, 'select public.suggest_rotation($1)', [mvp.matchIds[0]])).error ?? '', /not allowed/)
  assert.match((await vote(C.h0, mvp.matchIds[0], 'p1')).error ?? '', /match not finished/)
})

test("groups: a ballot keeps only players of the voter's own group", async () => {
  assert.ok(!(await as(db, 'anon', 'select public.submit_ballot($1, $2)', [C.h0, [P.p0, P.h1, P.p1, P.h2]])).error)
  assert.deepEqual((await one(db, 'select ranking from public.ballots where voter_id = $1', [P.h0])).ranking, [P.h1, P.h2])
})

test("groups: join links work per group (same name in two groups is fine; can't claim the other group's name)", async () => {
  const r = await as(db, 'anon', 'select public.join_team($1, $2, $3, $4, $5, $6, $7) as code', [H.joinCode, 'p1', '⚽', null, 'any', false, null])
  assert.ok(!r.error, r.error)
  assert.equal((await as(db, 'anon', 'select * from public.voter_by_code($1)', [r.rows[0].code])).rows[0].group_id, H.id)
  await addPlayer('unclaimedG')
  assert.match((await claim('anon', H.joinCode, P.unclaimedG)).error ?? '', /already claimed/)
  assert.equal(await claimedAt('unclaimedG'), null)
})

test('groups: group_preview shows the name and only unclaimed active names; nothing for a bad code', async () => {
  await addPlayer('hfree', { group: H.id })
  await addPlayer('hgone', { group: H.id, active: false })
  const r = (await as(db, 'anon', 'select public.group_preview($1) as g', [` ${H.joinCode.toUpperCase()} `])).rows[0].g
  assert.equal(r.name, 'H')
  assert.equal(r.id, H.id)
  assert.deepEqual(r.open.map((p) => p.name).sort(), ['h1', 'h2', 'hfree', 'hp0']) // h0 voted → claimed
  assert.deepEqual(Object.keys(r.open[0]).sort(), ['emoji', 'id', 'name', 'photo'])
  assert.equal((await as(db, 'anon', 'select public.group_preview($1) as g', ['nope00'])).rows[0].g, null)
})

test('groups: voter_by_code tells the group and whether he is admin', async () => {
  const v = (await as(db, 'anon', 'select * from public.voter_by_code($1)', [H.adminCode])).rows[0]
  assert.equal(v.group_id, H.id)
  assert.equal(v.group_name, 'H')
  assert.equal(v.is_admin, true)
  assert.equal((await as(db, 'anon', 'select * from public.voter_by_code($1)', [C.h1])).rows[0].is_admin, false)
})

test('create_group: anyone opens a group and is its only player and admin', async () => {
  const r = await as(db, 'anon', 'select public.create_group($1, $2, $3, $4, $5, $6, $7) as code', ['  Thursday Ball ', ' Dana ', '🦊', null, 'mid', false, ' D '])
  assert.ok(!r.error, r.error)
  const code = r.rows[0].code
  const me = { code }
  assert.equal((await as(db, me, 'select public.is_admin() as a')).rows[0].a, true)
  const g = (await as(db, me, 'select * from public.groups')).rows
  assert.equal(g.length, 1)
  assert.equal(g[0].name, 'Thursday Ball')
  assert.match(g[0].join_code, /^[a-hjkmnp-z2-9]{6}$/)
  const players = (await as(db, me, 'select * from public.players')).rows
  assert.equal(players.length, 1)
  assert.equal(players[0].name, 'Dana')
  assert.equal(players[0].nickname, 'D')
  assert.ok(players[0].claimed_at)
  // he adds a player: it lands in his group by itself
  const add = await as(db, me, `insert into public.players (name) values ('Friend') returning group_id`)
  assert.ok(!add.error, add.error)
  assert.equal(add.rows[0].group_id, g[0].id)
  // a different group name and empty names are refused
  const bad = (group, name) => as(db, 'anon', 'select public.create_group($1, $2, null, null, null, null, null)', [group, name])
  assert.match((await bad('  ', 'x')).error ?? '', /group name required/)
  assert.match((await bad('n'.repeat(41), 'x')).error ?? '', /group name required/)
  assert.match((await bad('ok', ' ')).error ?? '', /name required/)
  // without settings: Saturday 9:30, 6 per team, 7 minutes, first to 3
  assert.deepEqual(
    (await as(db, me, 'select weekday, kickoff, team_size, match_minutes, win_goals, venue from public.groups')).rows,
    [{ weekday: 6, kickoff: '9:30', team_size: 6, match_minutes: 7, win_goals: 3, venue: null }])
})

test('create_group: the organizer sets day, time, place and rules; out-of-range settings are refused', async () => {
  const create = (settings) => as(db, 'anon', 'select public.create_group($1, $2, null, null, null, null, null, null, $3) as code', ['Mon', 'Eli', settings])
  const r = await create({ weekday: 1, kickoff: '20:30', team_size: 5, match_minutes: 10, win_goals: 0, venue: ' Park ' })
  assert.ok(!r.error, r.error)
  assert.deepEqual(
    (await as(db, { code: r.rows[0].code }, 'select weekday, kickoff, team_size, match_minutes, win_goals, venue from public.groups')).rows,
    [{ weekday: 1, kickoff: '20:30', team_size: 5, match_minutes: 10, win_goals: 0, venue: 'Park' }])
  for (const bad of [{ weekday: 7 }, { kickoff: 'evening' }, { team_size: 2 }, { match_minutes: 'x' }, { win_goals: 20 }])
    assert.match((await create(bad)).error ?? '', /invalid settings/, JSON.stringify(bad))
  // the join link shows when and where
  const join = (await as(db, { code: r.rows[0].code }, 'select join_code from public.groups')).rows[0].join_code
  const p = (await as(db, 'anon', 'select public.group_preview($1) as g', [join])).rows[0].g
  assert.deepEqual([p.weekday, p.kickoff, p.venue], [1, '20:30', 'Park'])
})

test('admins: an admin makes a co-admin; the last admin cannot step down, leave or be deleted', async () => {
  const code = (await as(db, 'anon', 'select public.create_group($1, $2, null, null, null, null, null) as code', ['Solo', 'Ann'])).rows[0].code
  const ann = { code }
  const annId = (await as(db, 'anon', 'select * from public.voter_by_code($1)', [code])).rows[0].player_id
  assert.match((await as(db, ann, 'update public.players set is_admin = false where id = $1', [annId])).error ?? '', /last admin/)
  assert.match((await as(db, ann, 'update public.players set active = false where id = $1', [annId])).error ?? '', /last admin/)
  assert.match((await as(db, ann, 'delete from public.players where id = $1', [annId])).error ?? '', /last admin/)
  const bob = (await as(db, ann, `insert into public.players (name) values ('Bob') returning id`)).rows[0].id
  const bobCode = (await as(db, ann, 'select code from public.player_codes where player_id = $1', [bob])).rows[0].code
  assert.equal((await as(db, { code: bobCode }, 'select public.is_admin() as a')).rows[0].a, false)
  assert.ok(!(await as(db, ann, 'update public.players set is_admin = true where id = $1', [bob])).error)
  assert.equal((await as(db, { code: bobCode }, 'select public.is_admin() as a')).rows[0].a, true)
  assert.ok(!(await as(db, ann, 'update public.players set is_admin = false where id = $1', [annId])).error) // Bob is still admin
  // nobody moves a player to another group
  assert.ok((await as(db, { code: bobCode }, `update public.players set group_id = '${G.id}' where id = $1`, [bob])).error)
  // deleting the whole group is not blocked by the guard
  const gid = (await as(db, ann, 'select group_id from public.players where id = $1', [annId])).rows[0].group_id
  await db.query('delete from public.groups where id = $1', [gid])
  assert.equal(await count(db, 'select count(*)::int as n from public.players where group_id = $1', [gid]), 0)
})

test('realtime: changes send a content-free ping to "g:<group>" (when Supabase Realtime exists)', async () => {
  const rt = await newDb()
  await rt.exec(`create schema realtime; create table realtime.sent (payload jsonb, event text, topic text, private boolean);
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
    language sql as $$ insert into realtime.sent values (payload, event, topic, private) $$;`)
  await rt.exec(SCHEMA)
  const g = await newGroup(rt)
  await as(rt, 'admin', `insert into public.nights (day) values ('2030-02-02')`)
  const sent = (await rt.query('select * from realtime.sent')).rows
  assert.ok(sent.length >= 2) // the admin player, then the night
  assert.ok(sent.every((m) => m.topic === `g:${g.id}` && m.event === 'change' && m.private === false))
  assert.deepEqual(sent.at(-1).payload, { table: 'nights' })
  // Realtime failing must not stop the write itself.
  await rt.exec(`create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
    returns void language plpgsql as $$ begin raise exception 'realtime down'; end $$`)
  const r = await as(rt, 'admin', `insert into public.nights (day) values ('2030-02-03') returning id`)
  assert.ok(!r.error && r.rows.length === 1, r.error)
  await rt.close()
})

// ═════════════ Upgrade: older databases with data, then the new schema on top ═════════════

test('upgrade: v1 data (players, codes, ballots, ratings) survives the new schema, run twice, in one group', async () => {
  const up = await newDb()
  await up.exec(SCHEMA_V1)
  await up.exec(`insert into public.admins values ('${ADMIN}')`)
  const pid = {}
  for (const n of ['a', 'b', 'c', 'd']) pid[n] = (await one(up, `insert into public.players (name, position) values ($1, 'any') returning id`, [n])).id
  await up.query(`update public.players set position = 'gk' where id = $1`, [pid.d])
  await up.query('insert into public.ballots (voter_id, ranking) values ($1, $2), ($3, $4)', [pid.a, [pid.c, pid.b, pid.d], pid.b, [pid.d, pid.a]])
  const scores = (rows) => rows.map((r) => [r.player_id, Number(r.score), r.votes]).sort()
  // v1: the Supabase Auth admin reads the ranking
  await up.query(`select set_config('request.jwt.claim.sub', $1, false)`, [ADMIN])
  const ratingsBefore = scores((await up.query('select * from public.admin_ratings()')).rows)
  await up.query(`select set_config('request.jwt.claim.sub', '', false)`)
  const snapshot = async () => ({
    // can_gk left out: a goalkeeper-only player saved without it gets it now (positions = {gk})
    players: (await up.query('select id, name, emoji, photo, position, active, created_at from public.players order by id')).rows,
    codes: (await up.query('select * from public.player_codes order by player_id')).rows,
    // moved left out: measured once by the upgrade (checked below)
    ballots: (await up.query('select voter_id, ranking, updated_at from public.ballots order by voter_id')).rows,
    admins: (await up.query('select * from public.admins')).rows,
  })
  const before = await snapshot()
  await up.exec(SCHEMA)
  await up.exec(SCHEMA)
  assert.deepEqual(await snapshot(), before)
  assert.deepEqual((await one(up, 'select positions, can_gk from public.players where id = $1', [pid.d])), { positions: ['gk'], can_gk: true })
  assert.equal(await count(up, 'select count(*)::int as n from public.ballots where moved is null'), 0)
  assert.deepEqual((await one(up, 'select positions from public.players where id = $1', [pid.a])).positions, [])
  assert.equal((await one(up, 'select public.schema_version() as v')).v, 5)
  // groups from before options existed played in Hebrew, and keep it
  assert.deepEqual((await one(up, 'select options from public.groups')).options, { lang: 'he' })
  assert.equal(await count(up, 'select count(*)::int as n from public.groups'), 1)
  assert.equal(await count(up, 'select count(distinct group_id)::int as n from public.players'), 1)

  // request.headers never set at all on this connection → anon is not a member.
  await up.exec('set role anon')
  try {
    assert.equal((await one(up, 'select public.is_member() as m')).m, false)
    await assert.rejects(up.query(`insert into public.nights (day) values ('2030-01-01')`))
  } finally {
    await up.exec('reset role')
  }
  // no group admin yet: the owner names one (supabase/make_admin.sql), then the ranking is the same
  await up.query(`update public.players set is_admin = true where name = 'a'`)
  const aCode = before.codes.find((c) => c.player_id === pid.a).code
  assert.deepEqual(scores((await as(up, { code: aCode }, 'select * from public.admin_ratings()')).rows), ratingsBefore)
  for (const t of ['nights', 'attendance', 'matches', 'goals'])
    assert.equal(await count(up, `select count(*)::int as n from public.${t}`), 0)

  await up.close()
})

test('upgrade: a version 4 database (old limits) accepts draws, half-time and 60-minute halves after the update', async () => {
  const up = await newDb()
  await up.exec(SCHEMA)
  // back to version 4: the old checks under their old names, no rules/period/break_since
  await up.exec(`
    alter table public.matches drop constraint matches_winner_check, drop constraint matches_phase_check, drop constraint matches_period_check;
    alter table public.matches add constraint matches_winner_check check (winner in ('a', 'b')),
      add constraint matches_phase_check check (phase in ('regular', 'extra', 'golden'));
    alter table public.matches drop column rules, drop column period, drop column break_since;
    alter table public.groups drop constraint groups_rules_valid;
    alter table public.groups add constraint groups_rules_valid check (
      team_size between 3 and 11 and match_minutes between 2 and 45 and win_goals between 0 and 10
      and (venue is null or length(trim(venue)) <= 60));`)
  const g = await newGroup(up, 'Old rules')
  assert.ok(await up.query('update public.groups set match_minutes = 60 where id = $1', [g.id]).then(() => false, () => true)) // refused before
  const night = (await one(up, `insert into public.nights (group_id, day) values ($1, '2026-11-07') returning id`, [g.id])).id
  // (inserted without the new trigger, which already expects the version 5 columns)
  await up.exec('alter table public.matches disable trigger matches_fill_group')
  const old = (await one(up, `insert into public.matches (night_id, group_id, num, team_a, team_b) values ($1, $2, 1, '{}', '{}') returning id`, [night, g.id])).id
  await up.exec('alter table public.matches enable trigger matches_fill_group')
  await up.exec(SCHEMA)
  await up.query('update public.groups set match_minutes = 60 where id = $1', [g.id])
  await up.query(`update public.matches set phase = 'break' where id = $1`, [old])
  await up.query(`update public.matches set phase = 'penalties' where id = $1`, [old])
  await up.query(`update public.matches set status = 'finished', winner = 'draw' where id = $1`, [old])
  // a match from before keeps no rules (= the old behaviour) and starts in period 1
  assert.deepEqual(await one(up, 'select rules, period from public.matches where id = $1', [old]), { rules: null, period: 1 })
})

test('upgrade: v3 groups (before options) get Hebrew once; groups opened later keep their own', async () => {
  const up = await newDb()
  await up.exec(SCHEMA)
  // a version 3 database: same tables, no options column yet
  await up.exec('drop trigger groups_check_options on public.groups; alter table public.groups drop column options')
  const old = await newGroup(up, 'Old')
  await up.exec(SCHEMA)
  assert.deepEqual((await one(up, 'select options from public.groups where id = $1', [old.id])).options, { lang: 'he' })
  const later = await newGroup(up, 'Later', { main: false })
  await up.query(`update public.groups set options = '{"lang": "en"}' where id = $1`, [later.id])
  await up.exec(SCHEMA) // running it again changes nobody's language
  assert.deepEqual((await one(up, 'select options from public.groups where id = $1', [later.id])).options, { lang: 'en' })
  assert.deepEqual((await one(up, 'select options from public.groups where id = $1', [old.id])).options, { lang: 'he' })
})

test('upgrade: v2 data (join code, schedule, nights, matches, goals, MVP votes) moves into one group, run twice', async () => {
  const up = await newDb({ realtime: true })
  await up.exec(SCHEMA_V2)
  await up.exec(`update public.settings set value = '4821' where key = 'join_code'; update public.schedule set weekday = 4, kickoff = '20:00'`)
  const pid = {}
  for (const n of ['a', 'b', 'c', 'd']) pid[n] = (await one(up, `insert into public.players (name, claimed_at) values ($1, case when $1 = 'd' then null else now() end) returning id`, [n])).id
  const night = (await one(up, `insert into public.nights (day) values ('2026-10-31') returning id`)).id
  for (const n of ['a', 'b', 'c']) await up.query('insert into public.attendance (night_id, player_id) values ($1, $2)', [night, pid[n]])
  const match = (await one(up, `insert into public.matches (night_id, num, team_a, team_b, status, winner) values ($1, 1, $2, $3, 'finished', 'a') returning id`, [night, [pid.a], [pid.b]])).id
  await up.query(`insert into public.goals (match_id, team, scorer) values ($1, 'a', $2)`, [match, pid.a])
  await up.query('insert into public.mvp_votes (match_id, voter_id, player_id) values ($1, $2, $3)', [match, pid.b, pid.a])
  const counts = async () => {
    const out = {}
    for (const t of ['players', 'player_codes', 'nights', 'attendance', 'matches', 'goals', 'mvp_votes']) out[t] = await count(up, `select count(*)::int as n from public.${t}`)
    return out
  }
  const before = await counts()
  await up.exec(SCHEMA)
  await up.exec(SCHEMA)
  assert.deepEqual(await counts(), before)
  const g = await one(up, 'select * from public.groups')
  assert.equal(await count(up, 'select count(*)::int as n from public.groups'), 1)
  assert.equal(g.join_code, '4821') // the link already in WhatsApp keeps working
  assert.equal(g.weekday, 4)
  assert.equal(g.kickoff, '20:00')
  assert.deepEqual(g.options, { lang: 'he' }) // it was a Hebrew group
  for (const t of ['players', 'nights', 'attendance', 'matches', 'goals'])
    assert.equal(await count(up, `select count(*)::int as n from public.${t} where group_id is distinct from $1`, [g.id]), 0, t)
  assert.equal(await one(up, `select to_regclass('public.settings') as t`).then((r) => r.t), null)
  // players carry on as before: their code reads the group, the MVP total is there
  const aCode = (await one(up, 'select code from public.player_codes where player_id = $1', [pid.a])).code
  assert.equal((await as(up, { code: aCode }, 'select * from public.players')).rows.length, 4)
  assert.deepEqual((await as(up, { code: aCode }, 'select votes from public.mvp_tally()')).rows, [{ votes: 1 }])
  const preview = (await as(up, 'anon', 'select public.group_preview($1) as g', ['4821'])).rows[0].g
  assert.deepEqual(preview.open.map((p) => p.name), ['d'])
  // the same day can now exist once per group
  assert.ok(!(await as(up, 'anon', 'select public.create_group($1, $2, null, null, null, null, null)', ['Other', 'z'])).error)
  await up.query(`insert into public.nights (group_id, day) select id, '2026-10-31' from public.groups where name = 'Other'`)
  await assert.rejects(up.query(`insert into public.nights (group_id, day) values ($1, '2026-10-31')`, [g.id]))
  await up.close()
})

// ───────────── Deleting a played match, real rankings, leaving ─────────────

test('delete match: anyone cancels a live match; only an admin deletes a played one; cascades still work', async () => {
  const { night, matchIds: [live, played] } = await addNight(['p0', 'p1'], [
    { num: 1, team_a: ['p0'], team_b: ['p1'], status: 'live', winner: null },
    { num: 2, team_a: ['p0'], team_b: ['p1'], status: 'finished', winner: 'a' },
  ])
  assert.match((await as(db, MEMBER, 'delete from public.matches where id = $1', [played])).error ?? '', /only the admin/)
  assert.ok(!(await as(db, MEMBER, 'delete from public.matches where id = $1', [live])).error)
  assert.ok(!(await as(db, 'admin', 'delete from public.matches where id = $1 returning id', [played])).error)
  assert.equal(await count(db, 'select count(*)::int as n from public.matches where night_id = $1', [night]), 0)
  // a night with a played match can still be removed as a whole
  const again = await addNight(['p0', 'p1'], [{ num: 1, team_a: ['p0'], team_b: ['p1'], status: 'finished', winner: 'b' }])
  assert.ok(!(await as(db, 'admin', 'delete from public.nights where id = $1', [again.night])).error)
})

test('ballots: "moved" counts players moved from alphabetical order; an untouched ballot does not count', async () => {
  const g = await newGroup(db, 'Rank', { main: false })
  const names = ['Avi', 'Ben', 'Dan', 'Eli', 'Gil']
  const id = {}
  const code = {}
  for (const n of names) {
    id[n] = (await one(db, 'insert into public.players (group_id, name) values ($1, $2) returning id', [g.id, n])).id
    code[n] = (await one(db, 'select code from public.player_codes where player_id = $1', [id[n]])).code
  }
  const vote = (who, order) => as(db, 'anon', 'select public.submit_ballot($1, $2)', [code[who], order.map((n) => id[n])])
  const movedOf = async (who) => (await one(db, 'select moved from public.ballots where voter_id = $1', [id[who]])).moved
  await vote('Avi', ['Ben', 'Dan', 'Eli', 'Gil']) // pressed save
  assert.equal(await movedOf('Avi'), 0)
  await vote('Ben', ['Gil', 'Avi', 'Dan', 'Eli']) // moved Gil to the top
  assert.equal(await movedOf('Ben'), 1)
  await vote('Dan', ['Gil', 'Eli', 'Ben', 'Avi']) // reversed
  assert.equal(await movedOf('Dan'), 3)

  const admin = { code: g.adminCode }
  const status = (await as(db, admin, 'select * from public.admin_ballot_status()')).rows
  assert.deepEqual(Object.keys(status[0]).sort(), ['moved', 'player_id', 'ranked', 'updated_at']) // no orders
  const byId = Object.fromEntries(status.map((r) => [r.player_id, r]))
  assert.deepEqual([byId[id.Avi].moved, byId[id.Ben].moved, byId[id.Eli].ranked], [0, 1, null])
  assert.ok((await as(db, { code: code.Eli }, 'select * from public.admin_ballot_status()')).error)

  // Avi's untouched ballot (Ben above Gil) is ignored: only Ben and Dan count, both put Gil first.
  const scores = Object.fromEntries((await as(db, admin, 'select player_id, score from public.admin_ratings()')).rows.map((r) => [r.player_id, Number(r.score)]))
  assert.equal(scores[id.Gil], 100)
})

test('leave_group: he becomes inactive and his code stops working; the last admin cannot leave', async () => {
  const g = await newGroup(db, 'Leave', { main: false })
  const pid = (await one(db, `insert into public.players (group_id, name) values ($1, 'Leaver') returning id`, [g.id])).id
  const code = (await one(db, 'select code from public.player_codes where player_id = $1', [pid])).code
  assert.ok(!(await as(db, 'anon', 'select public.leave_group($1)', [code])).error)
  assert.equal((await one(db, 'select active from public.players where id = $1', [pid])).active, false)
  assert.match((await as(db, 'anon', 'select public.leave_group($1)', [code])).error ?? '', /invalid code/)
  assert.match((await as(db, 'anon', 'select public.leave_group($1)', [g.adminCode])).error ?? '', /last admin/)
})
