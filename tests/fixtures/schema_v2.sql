-- Neighborhood football: step 1 (players + peer ranking) and step 2 (nights, matches, teams).
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run again: it only creates what is missing and replaces functions.
-- Running it on a database that already has step 1 keeps all players, codes and ballots.

-- ───────────── Tables ─────────────

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  emoji text not null default '⚽',
  photo text,                       -- small JPEG as a data URL (resized in the browser)
  position text not null default 'any' check (position in ('gk', 'def', 'mid', 'att', 'any')),
  can_gk boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Who may see the ranking and manage players (Ido).
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- One personal voting code per player. Never readable by players.
create table if not exists public.player_codes (
  player_id uuid primary key references public.players on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
);

-- One ballot per voter: the ordered list of player ids, best first.
create table if not exists public.ballots (
  voter_id uuid primary key references public.players on delete cascade,
  ranking uuid[] not null,
  updated_at timestamptz not null default now()
);

-- ───────────── Helpers ─────────────

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Every new player gets a personal code automatically.
create or replace function public.give_player_code()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.player_codes (player_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists players_give_code on public.players;
create trigger players_give_code after insert on public.players
  for each row execute function public.give_player_code();

-- ───────────── Row level security ─────────────

alter table public.players enable row level security;
alter table public.admins enable row level security;
alter table public.player_codes enable row level security;
alter table public.ballots enable row level security;
-- admins and ballots have no policies at all: nobody reads them directly.

drop policy if exists "players are public" on public.players;
create policy "players are public" on public.players
  for select to anon, authenticated using (true);

drop policy if exists "admin manages players" on public.players;
create policy "admin manages players" on public.players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin reads codes" on public.player_codes;
create policy "admin reads codes" on public.player_codes
  for select to authenticated using (public.is_admin());

drop policy if exists "admin changes codes" on public.player_codes;
create policy "admin changes codes" on public.player_codes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.players to anon, authenticated;
grant insert, update, delete on public.players to authenticated;
grant select, update on public.player_codes to authenticated;

-- ───────────── Voting (players, by personal code) ─────────────

create or replace function public.voter_by_code(p_code text)
returns table (player_id uuid, name text, ranking uuid[])
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, b.ranking
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  left join public.ballots b on b.voter_id = p.id
  where c.code = lower(trim(p_code));
$$;

create or replace function public.submit_ballot(p_code text, p_ranking uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_voter uuid;
  v_clean uuid[];
begin
  select c.player_id into v_voter
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  where c.code = lower(trim(p_code));

  if v_voter is null then
    raise exception 'invalid code';
  end if;

  -- Keep only real active players, drop the voter himself and duplicates, keep the order.
  select coalesce(array_agg(t.id order by t.ord), '{}') into v_clean
  from (
    select distinct on (r.id) r.id, r.ord
    from unnest(p_ranking) with ordinality as r(id, ord)
    join public.players p on p.id = r.id and p.active
    where r.id <> v_voter
    order by r.id, r.ord
  ) t;

  insert into public.ballots (voter_id, ranking, updated_at)
  values (v_voter, v_clean, now())
  on conflict (voter_id) do update set ranking = excluded.ranking, updated_at = now();

  -- Using his personal code means the name is his: it can't be picked from the join link anymore.
  -- (claimed_at is added further down this file; plpgsql only resolves it when this runs.)
  update public.players set claimed_at = coalesce(claimed_at, now()) where id = v_voter;
end $$;

-- ───────────── Ranking (admin only) ─────────────
-- Each ballot is first trimmed to players who are still active (and never the voter),
-- then each place becomes a score from 100 (first) to 0 (last), so ballots of different
-- lengths count the same. A player's rating is the average score over the ballots he is on.

create or replace function public.admin_ratings()
returns table (player_id uuid, score numeric, avg_rank numeric, votes int, has_voted boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  return query
  with placed as (
    select r.id,
           row_number() over (partition by b.voter_id order by r.ord) as pos,
           count(*) over (partition by b.voter_id) as n
    from public.ballots b
    cross join lateral unnest(b.ranking) with ordinality as r(id, ord)
    join public.players p on p.id = r.id and p.active
    where r.id <> b.voter_id
  ),
  scored as (
    select placed.id, placed.pos,
           case when placed.n = 1 then 0.5 else 1 - (placed.pos - 1)::numeric / (placed.n - 1) end as s
    from placed
  )
  select p.id,
         round(avg(sc.s) * 100, 1),
         round(avg(sc.pos), 1),
         count(sc.s)::int,
         exists (select 1 from public.ballots b where b.voter_id = p.id)
  from public.players p
  left join scored sc on sc.id = p.id
  where p.active
  group by p.id;
end $$;

-- ───────────── Who may call what ─────────────

revoke execute on function public.voter_by_code(text) from public;
revoke execute on function public.submit_ballot(text, uuid[]) from public;
revoke execute on function public.admin_ratings() from public, anon;
revoke execute on function public.give_player_code() from public, anon, authenticated;

grant execute on function public.voter_by_code(text) to anon, authenticated;
grant execute on function public.submit_ballot(text, uuid[]) to anon, authenticated;
grant execute on function public.admin_ratings() to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ═════════════ Step 2: game nights, attendance, matches, goals (schema version 2) ═════════════
-- Everyone may read these. Writing needs a member: Ido (admin) or a request carrying the
-- personal code of an active player in header x-player-code. Ratings never leave the database.

-- ───────────── Tables ─────────────

create table if not exists public.nights (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  night_id uuid not null references public.nights on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  arrived_at timestamptz not null default now(),
  primary key (night_id, player_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references public.nights on delete cascade,
  num int not null,
  team_a uuid[] not null,
  team_b uuid[] not null,
  bench uuid[] not null default '{}',
  status text not null default 'live' check (status in ('live', 'finished')),
  phase text not null default 'regular' check (phase in ('regular', 'extra', 'golden')),
  clock_ms int not null default 0,
  running_since timestamptz null,
  winner text null check (winner in ('a', 'b')),
  created_at timestamptz not null default now(),
  ended_at timestamptz null,
  unique (night_id, num)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches on delete cascade,
  team text not null check (team in ('a', 'b')),
  scorer uuid null references public.players on delete set null,
  assist uuid null references public.players on delete set null,
  at_ms int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists attendance_player_idx on public.attendance (player_id);
create index if not exists goals_match_idx on public.goals (match_id);

alter table public.nights enable row level security;
alter table public.attendance enable row level security;
alter table public.matches enable row level security;
alter table public.goals enable row level security;

-- ───────────── Who is a member ─────────────

create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.player_codes c
    join public.players p on p.id = c.player_id and p.active
    where c.code = lower(trim(nullif(current_setting('request.headers', true), '')::json->>'x-player-code'))
  );
$$;

create or replace function public.schema_version()
returns int
language sql immutable security definer set search_path = ''
as $$ select 2 $$;

-- ───────────── Row level security ─────────────

do $$
declare
  t text;
begin
  foreach t in array array['nights', 'attendance', 'matches', 'goals'] loop
    execute format('drop policy if exists "%s are public" on public.%I', t, t);
    execute format('create policy "%s are public" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('drop policy if exists "members add %s" on public.%I', t, t);
    execute format('create policy "members add %s" on public.%I for insert to anon, authenticated with check ((select public.is_member()))', t, t);
    execute format('drop policy if exists "members change %s" on public.%I', t, t);
    execute format('create policy "members change %s" on public.%I for update to anon, authenticated using ((select public.is_member())) with check ((select public.is_member()))', t, t);
    execute format('drop policy if exists "members remove %s" on public.%I', t, t);
    execute format('create policy "members remove %s" on public.%I for delete to anon, authenticated using ((select public.is_member()))', t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.nights, public.attendance, public.matches, public.goals to anon, authenticated;

-- Live updates for everyone watching (only if Supabase Realtime is set up).
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['nights', 'attendance', 'matches', 'goals'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ───────────── Private helpers (not reachable through the API) ─────────────
-- Same rules as src/lib/teams.js. Players are handled as positions (1..n) in a list,
-- with their ratings in a parallel float8[].

create schema if not exists private;
revoke all on schema private from public;

-- Rating of every active player: the admin_ratings() score, unrounded, 50 without votes.
create or replace function private.player_scores()
returns table (player_id uuid, score numeric)
language sql stable set search_path = ''
as $$
  with placed as (
    select r.id,
           row_number() over (partition by b.voter_id order by r.ord) as pos,
           count(*) over (partition by b.voter_id) as n
    from public.ballots b
    cross join lateral unnest(b.ranking) with ordinality as r(id, ord)
    join public.players p on p.id = r.id and p.active
    where r.id <> b.voter_id
  ),
  scored as (
    select placed.id,
           case when placed.n = 1 then 0.5 else 1 - (placed.pos - 1)::numeric / (placed.n - 1) end as s
    from placed
  )
  select p.id, coalesce(avg(sc.s) * 100, 50)
  from public.players p
  left join scored sc on sc.id = p.id
  where p.active
  group by p.id;
$$;

-- Difference in strength between two teams (positions into r). Unequal sizes compare averages.
create or replace function private.imbalance(a int[], b int[], r float8[])
returns float8
language sql immutable set search_path = ''
as $$
  select case when t.na = t.nb then abs(t.sa - t.sb)
              else abs(case when t.na > 0 then t.sa / t.na else 0 end
                       - case when t.nb > 0 then t.sb / t.nb else 0 end) * greatest(t.na, t.nb)
         end
  from (
    select cardinality(a) as na, cardinality(b) as nb,
           coalesce((select sum(r[x]) from unnest(a) as x), 0)::float8 as sa,
           coalesce((select sum(r[x]) from unnest(b) as x), 0)::float8 as sb
  ) t;
$$;

-- All k-element subsets of 1..n, in the same (lexicographic) order as combinations() in teams.js.
create or replace function private.combos(n int, k int)
returns setof int[]
language sql immutable set search_path = ''
as $$
  with recursive c(combo, hi) as (
    select '{}'::int[], 0
    union all
    select c.combo || i, i
    from c, generate_series(c.hi + 1, n - (k - cardinality(c.combo)) + 1) as i
    where cardinality(c.combo) < k
  )
  select c.combo from c where cardinality(c.combo) = k and k <= n order by c.combo;
$$;

-- Picks, from pool, who joins the winning team w (fill_w places) to keep teams even.
-- A goalkeeper-only player (gk) stays with his team when there are enough others to move.
drop function if exists private.best_fill(int[], int[], int, float8[]);
create or replace function private.best_fill(w int[], pool int[], fill_w int, r float8[], gk boolean[], out fill int[], out cost float8)
language plpgsql immutable set search_path = ''
as $$
declare
  v_combo int[];
  v_cands int[];
  v_f int[];
  v_rest int[];
  v_cost float8;
begin
  if fill_w = 0 then
    fill := '{}';
    cost := private.imbalance(w, pool, r);
    return;
  end if;
  v_cands := array(select x from unnest(pool) with ordinality as u(x, o) where not gk[x] order by u.o);
  if cardinality(v_cands) < fill_w then
    v_cands := pool;
  end if;
  for v_combo in select * from private.combos(cardinality(v_cands), least(fill_w, cardinality(v_cands))) loop
    v_f := array(select v_cands[x] from unnest(v_combo) with ordinality as u(x, o) order by u.o);
    v_rest := array(select x from unnest(pool) with ordinality as u(x, o) where not (x = any(v_f)) order by u.o);
    v_cost := private.imbalance(w || v_f, v_rest, r);
    if fill is null or v_cost < cost then
      fill := v_f;
      cost := v_cost;
    end if;
  end loop;
end $$;

-- Positions → their player ids, as a JSON array.
create or replace function private.ids_json(idx int[], ids uuid[])
returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_agg(ids[u.x] order by u.o), '[]'::jsonb)
  from unnest(idx) with ordinality as u(x, o);
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ───────────── Team building (members) ─────────────

-- Splits tonight's players (minus p_bench) into two balanced teams: splitTeams() in teams.js.
create or replace function public.make_teams(p_night uuid, p_bench uuid[] default '{}')
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ids uuid[];
  v_r float8[];
  v_gk boolean[];
  v_keepers int[];
  v_rest int[];
  v_n int;
  v_size_a int;
  v_a int[];
  v_b int[];
  v_cost float8;
  v_best_cost float8;
  v_best_a int[];
  v_best_b int[];
  i int;
  x int;
begin
  if not public.is_member() then
    raise exception 'not allowed';
  end if;

  select coalesce(array_agg(p.id order by at.arrived_at, p.id), '{}'),
         coalesce(array_agg(coalesce(s.score, 50)::float8 order by at.arrived_at, p.id), '{}'),
         coalesce(array_agg(p.position = 'gk' order by at.arrived_at, p.id), '{}')
  into v_ids, v_r, v_gk
  from public.attendance at
  join public.players p on p.id = at.player_id and p.active
  left join private.player_scores() s on s.player_id = p.id
  where at.night_id = p_night
    and not (p.id = any(coalesce(p_bench, '{}')));

  v_n := cardinality(v_ids);
  if v_n < 8 then
    raise exception 'need at least 8 players';
  end if;

  v_keepers := array(select g from generate_series(1, v_n) as g where v_gk[g]);
  v_rest := array(select g from generate_series(1, v_n) as g where not v_gk[g]);
  v_size_a := (v_n + 1) / 2;

  for s in 1..1500 loop
    v_a := '{}';
    v_b := '{}';
    -- Alternate keepers-only between teams first, then fill with everyone else.
    i := 0;
    for x in select k from unnest(v_keepers) as k order by random() loop
      if i % 2 = 0 then v_a := v_a || x; else v_b := v_b || x; end if;
      i := i + 1;
    end loop;
    for x in select k from unnest(v_rest) as k order by random() loop
      if cardinality(v_a) < v_size_a then v_a := v_a || x; else v_b := v_b || x; end if;
    end loop;
    continue when cardinality(v_a) <> v_size_a;
    v_cost := private.imbalance(v_a, v_b, v_r) + random() * 4;
    if v_best_a is null or v_cost < v_best_cost then
      v_best_cost := v_cost;
      v_best_a := v_a;
      v_best_b := v_b;
    end if;
  end loop;

  return jsonb_build_object('a', private.ids_json(v_best_a, v_ids), 'b', private.ids_json(v_best_b, v_ids));
end $$;

-- Who plays next after a finished match: suggestRotation() in teams.js.
create or replace function public.suggest_rotation(p_match uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  m public.matches;
  v_ids uuid[];
  v_r float8[];
  v_gk boolean[];
  v_played int[];
  v_prio int[];
  v_jit float8[];
  v_n int;
  v_win int[];
  v_lose int[];
  v_waiting int[];
  v_size int;
  v_slots int;
  v_fill_w int;
  v_keep int[];
  v_forced int[];
  v_cands int[];
  v_k int;
  v_kk int;
  v_combo int[];
  v_c int[];
  v_out int[];
  v_pool int[];
  v_score float8;
  v_best_score float8;
  v_best_out int[];
  v_leaving int[] := '{}';
  v_entering int[] := '{}';
  v_fill int[];
  v_cost float8;
  v_winner_team int[];
  v_new_team int[];
  v_bench int[];
  v_extra int[];
  v_wk int;
  x int;
begin
  if not public.is_member() then
    raise exception 'not allowed';
  end if;

  select * into m from public.matches where id = p_match;
  if not found or m.status <> 'finished' or m.winner is null then
    raise exception 'match not finished';
  end if;

  -- Present tonight (active players), in order of arrival.
  select coalesce(array_agg(p.id order by at.arrived_at, p.id), '{}'),
         coalesce(array_agg(coalesce(s.score, 50)::float8 order by at.arrived_at, p.id), '{}'),
         coalesce(array_agg(p.position = 'gk' order by at.arrived_at, p.id), '{}')
  into v_ids, v_r, v_gk
  from public.attendance at
  join public.players p on p.id = at.player_id and p.active
  left join private.player_scores() s on s.player_id = p.id
  where at.night_id = m.night_id;
  v_n := cardinality(v_ids);

  -- Games tonight (up to this match), and the streak of games in a row counting back from the latest.
  select coalesce(array_agg(st.played order by u.o), '{}'),
         coalesce(array_agg(st.streak * 10 + st.played order by u.o), '{}')
  into v_played, v_prio
  from unnest(v_ids) with ordinality as u(id, o)
  cross join lateral (
    select max(t.num) as last_missed
    from public.matches t
    where t.night_id = m.night_id and t.num <= m.num
      and not (u.id = any(t.team_a) or u.id = any(t.team_b))
  ) miss
  cross join lateral (
    select (count(*) filter (where u.id = any(t.team_a) or u.id = any(t.team_b)))::int as played,
           (count(*) filter (where miss.last_missed is null or t.num > miss.last_missed))::int as streak
    from public.matches t
    where t.night_id = m.night_id and t.num <= m.num
  ) st;

  v_win := array(
    select array_position(v_ids, t.id)
    from unnest(case when m.winner = 'a' then m.team_a else m.team_b end) with ordinality as t(id, o)
    where t.id = any(v_ids) order by t.o);
  v_lose := array(
    select array_position(v_ids, t.id)
    from unnest(case when m.winner = 'a' then m.team_b else m.team_a end) with ordinality as t(id, o)
    where t.id = any(v_ids) order by t.o);
  v_size := least(6, v_n / 2);

  -- People went home and teams got smaller: the winners' most tired players move over.
  if cardinality(v_win) > v_size then
    v_extra := array(
      select w from unnest(v_win) as w
      where not v_gk[w]
      order by v_prio[w] desc, random()
      limit cardinality(v_win) - v_size);
    v_win := array(select w from unnest(v_win) with ordinality as u(w, o) where not (w = any(v_extra)) order by u.o);
  end if;

  v_waiting := array(
    select g from generate_series(1, v_n) as g
    where not (g = any(v_win)) and not (g = any(v_lose)) order by g);

  v_slots := 2 * v_size - cardinality(v_win);
  v_fill_w := greatest(0, v_size - cardinality(v_win));

  if cardinality(v_waiting) >= v_slots then
    -- More people waiting than places: the whole losing team rests (except its keeper-only,
    -- unless a keeper-only is waiting to replace him), and those who played least tonight come in.
    v_wk := (select w from unnest(v_waiting) with ordinality as u(w, o) where v_gk[w] order by u.o limit 1);
    if v_wk is null then
      v_keep := (array(select x2 from unnest(v_lose) with ordinality as u(x2, o) where v_gk[x2] order by u.o))[1:greatest(v_slots, 0)];
    else
      v_keep := '{}';
    end if;
    v_leaving := array(select x2 from unnest(v_lose) with ordinality as u(x2, o) where not (x2 = any(v_keep)) order by u.o);
    v_entering := array(
      select w from unnest(v_waiting) with ordinality as u(w, o)
      order by (w is not distinct from v_wk) desc, v_played[w], random()
      limit greatest(v_slots - cardinality(v_keep), 0));
  else
    v_entering := v_waiting;
    v_k := cardinality(v_lose) + cardinality(v_waiting) - v_slots;
    v_forced := '{}';
    if exists (select 1 from unnest(v_waiting) as w where v_gk[w]) then
      v_forced := (array(select x2 from unnest(v_lose) with ordinality as u(x2, o) where v_gk[x2] order by u.o))[1:greatest(v_k, 0)];
    end if;
    v_kk := v_k - cardinality(v_forced);
    v_cands := array(select x2 from unnest(v_lose) with ordinality as u(x2, o) where not v_gk[x2] order by u.o);
    if cardinality(v_cands) < v_kk then
      v_cands := array(select x2 from unnest(v_lose) with ordinality as u(x2, o) where not (x2 = any(v_forced)) order by u.o);
    end if;
    v_leaving := v_forced;
    if v_kk > 0 then
      v_jit := array_fill(0::float8, array[greatest(v_n, 1)]);
      foreach x in array v_lose loop
        v_jit[x] := random();
      end loop;
      for v_combo in select * from private.combos(cardinality(v_cands), v_kk) loop
        v_c := array(select v_cands[y] from unnest(v_combo) with ordinality as u(y, o) order by u.o);
        v_out := v_forced || v_c;
        v_pool := array(select x2 from unnest(v_lose) with ordinality as u(x2, o) where not (x2 = any(v_out)) order by u.o) || v_entering;
        select bf.cost into v_cost from private.best_fill(v_win, v_pool, v_fill_w, v_r, v_gk) bf;
        v_score := -(select coalesce(sum(v_prio[y]), 0) from unnest(v_c) as y)
                   + 0.3 * v_cost
                   + (select coalesce(sum(v_jit[y]), 0) from unnest(v_c) as y) * 0.01;
        if v_best_out is null or v_score < v_best_score then
          v_best_score := v_score;
          v_best_out := v_out;
        end if;
      end loop;
      v_leaving := coalesce(v_best_out, v_forced);
    end if;
  end if;

  v_pool := array(select x2 from unnest(v_lose) with ordinality as u(x2, o) where not (x2 = any(v_leaving)) order by u.o) || v_entering;
  select bf.fill into v_fill from private.best_fill(v_win, v_pool, v_fill_w, v_r, v_gk) bf;
  v_winner_team := v_win || v_fill;
  v_new_team := array(select x2 from unnest(v_pool) with ordinality as u(x2, o) where not (x2 = any(v_fill)) order by u.o);
  v_bench := array(
    select g from generate_series(1, v_n) as g
    where not (g = any(v_winner_team)) and not (g = any(v_new_team)) order by g);

  return jsonb_build_object(
    'team_a', private.ids_json(case when m.winner = 'a' then v_winner_team else v_new_team end, v_ids),
    'team_b', private.ids_json(case when m.winner = 'b' then v_winner_team else v_new_team end, v_ids),
    'bench', private.ids_json(v_bench, v_ids),
    'leaving', private.ids_json(v_leaving, v_ids),
    'entering', private.ids_json(v_entering, v_ids));
end $$;

revoke execute on function public.is_member() from public;
revoke execute on function public.schema_version() from public;
revoke execute on function public.make_teams(uuid, uuid[]) from public;
revoke execute on function public.suggest_rotation(uuid) from public;

grant execute on function public.is_member() to anon, authenticated;
grant execute on function public.schema_version() to anon, authenticated;
grant execute on function public.make_teams(uuid, uuid[]) to anon, authenticated;
grant execute on function public.suggest_rotation(uuid) to anon, authenticated;

-- ═════════════ Self sign-up and profile ═════════════

alter table public.players add column if not exists nickname text;
-- When the player himself first used the app (join link, his personal link, a vote).
-- Until then, Ido's name for him can be picked from the join link.
alter table public.players add column if not exists claimed_at timestamptz;
update public.players p set claimed_at = now()
where p.claimed_at is null and exists (select 1 from public.ballots b where b.voter_id = p.id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_nickname_len' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_nickname_len
      check (nickname is null or length(trim(nickname)) <= 24);
  end if;
  -- "not valid": photos already saved are left alone, every new or changed photo is checked.
  if not exists (select 1 from pg_constraint where conname = 'players_photo_size' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_photo_size
      check (photo is null or length(photo) <= 300000) not valid;
  end if;
end $$;

-- Group settings (the join link code). Only the admin reads or changes them.
create table if not exists public.settings (
  key text primary key,
  value text not null
);

alter table public.settings enable row level security;

drop policy if exists "admin reads settings" on public.settings;
create policy "admin reads settings" on public.settings
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "admin changes settings" on public.settings;
create policy "admin changes settings" on public.settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.settings from anon, authenticated;
grant select, update on public.settings to authenticated;

insert into public.settings (key, value)
values ('join_code', lpad((floor(random() * 10000))::int::text, 4, '0'))
on conflict do nothing;

-- The join code is 4 digits, easy to type. An older long code is replaced once.
update public.settings
set value = lpad((floor(random() * 10000))::int::text, 4, '0')
where key = 'join_code' and length(value) > 4;

-- A player edits his own profile with his personal code. Name and active stay with the admin.
create or replace function public.update_my_profile(
  p_code text, p_emoji text, p_photo text, p_position text, p_can_gk boolean, p_nickname text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid;
begin
  select c.player_id into v_player
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  where c.code = lower(trim(p_code));

  if v_player is null then
    raise exception 'invalid code';
  end if;

  update public.players
  set emoji = coalesce(nullif(trim(p_emoji), ''), emoji),
      photo = p_photo,
      position = coalesce(p_position, position),
      can_gk = coalesce(p_can_gk, false) or coalesce(p_position, position) = 'gk',
      nickname = nullif(trim(p_nickname), ''),
      claimed_at = coalesce(claimed_at, now())
  where id = v_player;
end $$;

-- Someone with the group's join link adds himself; returns his new personal code.
create or replace function public.join_team(
  p_join text, p_name text, p_emoji text, p_photo text, p_position text, p_can_gk boolean, p_nickname text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
  v_code text;
begin
  if not exists (
    select 1 from public.settings s where s.key = 'join_code' and lower(trim(s.value)) = lower(trim(p_join))
  ) then
    raise exception 'invalid join code';
  end if;

  if length(v_name) = 0 or length(v_name) > 30 then
    raise exception 'name required';
  end if;

  -- One sign-up at a time, so two people can't take the same name together.
  perform pg_advisory_xact_lock(hashtext('public.join_team'));

  if exists (select 1 from public.players p where p.active and lower(trim(p.name)) = lower(v_name)) then
    raise exception 'name taken';
  end if;

  if (select count(*) from public.players) >= 150 then
    raise exception 'too many players';
  end if;

  insert into public.players (name, emoji, photo, position, can_gk, nickname, claimed_at)
  values (
    v_name,
    coalesce(nullif(trim(p_emoji), ''), '⚽'),
    p_photo,
    coalesce(p_position, 'any'),
    coalesce(p_can_gk, false) or coalesce(p_position, 'any') = 'gk',
    nullif(trim(p_nickname), ''),
    now())
  returning id into v_id;

  select c.code into v_code from public.player_codes c where c.player_id = v_id;
  return v_code;
end $$;

revoke execute on function public.update_my_profile(text, text, text, text, boolean, text) from public;
revoke execute on function public.join_team(text, text, text, text, text, boolean, text) from public;
grant execute on function public.update_my_profile(text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.join_team(text, text, text, text, text, boolean, text) to anon, authenticated;

-- ═════════════ Claiming a name from the join link ═════════════
-- Ido adds the regulars by name; each one opens the group link, picks his own name
-- (only names nobody has claimed yet) and fills in his profile. Returns his personal code.
create or replace function public.claim_player(
  p_join text, p_player uuid, p_emoji text, p_photo text, p_position text, p_can_gk boolean, p_nickname text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not exists (
    select 1 from public.settings s where s.key = 'join_code' and lower(trim(s.value)) = lower(trim(p_join))
  ) then
    raise exception 'invalid join code';
  end if;

  -- Same lock as join_team: two phones can't claim the same name together.
  perform pg_advisory_xact_lock(hashtext('public.join_team'));

  update public.players
  set emoji = coalesce(nullif(trim(p_emoji), ''), emoji),
      photo = p_photo,
      position = coalesce(p_position, position),
      can_gk = coalesce(p_can_gk, false) or coalesce(p_position, position) = 'gk',
      nickname = nullif(trim(p_nickname), ''),
      claimed_at = now()
  where id = p_player and active and claimed_at is null;

  if not found then
    raise exception 'already claimed';
  end if;

  select c.code into v_code from public.player_codes c where c.player_id = p_player;
  return v_code;
end $$;

revoke execute on function public.claim_player(text, uuid, text, text, text, boolean, text) from public;
grant execute on function public.claim_player(text, uuid, text, text, text, boolean, text) to anon, authenticated;

-- ═════════════ Every registered player can invite friends ═════════════
-- The join code is shown to anyone with an active personal code (and to Ido), so they can share the link.
create or replace function public.member_join_code()
returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'not allowed';
  end if;
  return (select s.value from public.settings s where s.key = 'join_code');
end $$;

revoke execute on function public.member_join_code() from public;
grant execute on function public.member_join_code() to anon, authenticated;

-- ═════════════ Weekly game settings (day, time, cancelled weeks) ═════════════
-- One row: the usual game day (0 = Sunday … 6 = Saturday) and kickoff time. Everyone reads it, Ido changes it.
create table if not exists public.schedule (
  id int primary key default 1 check (id = 1),
  weekday int not null default 6 check (weekday between 0 and 6),
  kickoff text not null default '9:30' check (kickoff ~ '^\d{1,2}:\d{2}$')
);
insert into public.schedule (id) values (1) on conflict do nothing;

alter table public.schedule enable row level security;
drop policy if exists "schedule is public" on public.schedule;
create policy "schedule is public" on public.schedule for select to anon, authenticated using (true);
drop policy if exists "admin changes schedule" on public.schedule;
create policy "admin changes schedule" on public.schedule
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.schedule to anon, authenticated;
grant update on public.schedule to authenticated;

-- A week with no game.
alter table public.nights add column if not exists cancelled boolean not null default false;

-- Players may create a game night (by signing up), but only Ido cancels one.
create or replace function public.guard_night_cancel()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.cancelled and (tg_op = 'INSERT' or not old.cancelled) and not public.is_admin() then
    raise exception 'only the admin can cancel a game';
  end if;
  if tg_op = 'UPDATE' and old.cancelled and not new.cancelled and not public.is_admin() then
    raise exception 'only the admin can cancel a game';
  end if;
  return new;
end $$;

drop trigger if exists nights_guard_cancel on public.nights;
create trigger nights_guard_cancel before insert or update on public.nights
  for each row execute function public.guard_night_cancel();
revoke execute on function public.guard_night_cancel() from public, anon, authenticated;

-- ═════════════ Player of the match (MVP) ═════════════
-- Everyone who played a finished match picks the best player in it (not himself).
-- Single votes stay private; only the totals are public.
create table if not exists public.mvp_votes (
  match_id uuid not null references public.matches on delete cascade,
  voter_id uuid not null references public.players on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_id)
);
alter table public.mvp_votes enable row level security;
-- no policies: only the functions below touch it

create or replace function public.vote_mvp(p_code text, p_match uuid, p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_voter uuid;
  m public.matches;
begin
  select c.player_id into v_voter
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  where c.code = lower(trim(p_code));
  if v_voter is null then
    raise exception 'invalid code';
  end if;

  select * into m from public.matches where id = p_match;
  if not found or m.status <> 'finished' then
    raise exception 'match not finished';
  end if;
  if not (v_voter = any(m.team_a) or v_voter = any(m.team_b)) then
    raise exception 'you did not play';
  end if;
  if p_player = v_voter or not (p_player = any(m.team_a) or p_player = any(m.team_b)) then
    raise exception 'pick someone who played';
  end if;

  insert into public.mvp_votes (match_id, voter_id, player_id)
  values (p_match, v_voter, p_player)
  on conflict (match_id, voter_id) do update set player_id = excluded.player_id, created_at = now();
end $$;

-- Totals per match and player (public).
create or replace function public.mvp_tally()
returns table (match_id uuid, player_id uuid, votes int)
language sql stable security definer set search_path = ''
as $$
  select v.match_id, v.player_id, count(*)::int
  from public.mvp_votes v
  group by v.match_id, v.player_id;
$$;

-- Which player this phone's owner picked in each match.
create or replace function public.my_mvp_votes(p_code text)
returns table (match_id uuid, player_id uuid)
language sql stable security definer set search_path = ''
as $$
  select v.match_id, v.player_id
  from public.mvp_votes v
  join public.player_codes c on c.player_id = v.voter_id
  where c.code = lower(trim(p_code));
$$;

revoke execute on function public.vote_mvp(text, uuid, uuid) from public;
revoke execute on function public.mvp_tally() from public;
revoke execute on function public.my_mvp_votes(text) from public;
grant execute on function public.vote_mvp(text, uuid, uuid) to anon, authenticated;
grant execute on function public.mvp_tally() to anon, authenticated;
grant execute on function public.my_mvp_votes(text) to anon, authenticated;
