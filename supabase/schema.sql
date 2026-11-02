-- Neighborhood football, schema version 3: many groups in one database.
-- Each group has its own players, game nights, matches, ratings and join link.
-- The player who opens a group is its admin (and may make other players admins too).
--
-- Paste this whole file into Supabase → SQL Editor → Run (or: npx supabase db query --linked -f supabase/schema.sql).
-- Safe to run again: it only creates what is missing and replaces functions.
-- Running it on a version 2 database moves everything into one group (same join code and
-- game day), keeping every player, personal code, ballot and match.
--
-- Who is who: every request may carry header x-player-code with a personal code. That code
-- decides the group (my_group()) and whether the caller is its admin (is_admin()).
-- Nothing of a group can be read without one of its codes.

-- ───────────── Tables ─────────────

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  join_code text not null unique,
  weekday int not null default 6 check (weekday between 0 and 6),          -- 0 = Sunday … 6 = Saturday
  kickoff text not null default '9:30' check (kickoff ~ '^\d{1,2}:\d{2}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text not null default '⚽',
  photo text,                       -- small JPEG as a data URL (resized in the browser)
  position text not null default 'any' check (position in ('gk', 'def', 'mid', 'att', 'any')),
  can_gk boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Version 1–2 admins (Supabase Auth users). No longer used; kept so no data is lost.
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- One personal code per player. Only the group's admins read them.
create table if not exists public.player_codes (
  player_id uuid primary key references public.players on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
);

-- One ballot per voter: the ordered list of player ids (of his group), best first.
create table if not exists public.ballots (
  voter_id uuid primary key references public.players on delete cascade,
  ranking uuid[] not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.nights (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  day date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  night_id uuid not null references public.nights on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  group_id uuid not null references public.groups on delete cascade,
  arrived_at timestamptz not null default now(),
  primary key (night_id, player_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references public.nights on delete cascade,
  group_id uuid not null references public.groups on delete cascade,
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
  group_id uuid not null references public.groups on delete cascade,
  team text not null check (team in ('a', 'b')),
  scorer uuid null references public.players on delete set null,
  assist uuid null references public.players on delete set null,
  at_ms int not null default 0,
  created_at timestamptz not null default now()
);

-- Player of the match. Single votes stay private; only the totals are shown.
create table if not exists public.mvp_votes (
  match_id uuid not null references public.matches on delete cascade,
  voter_id uuid not null references public.players on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_id)
);

-- ───────────── Columns added after version 1 (for older databases) ─────────────

alter table public.players add column if not exists group_id uuid references public.groups on delete cascade;
alter table public.players add column if not exists nickname text;
-- When the player himself first used the app (join link, his personal link, a vote).
-- Until then, the admin's name for him can be picked from the join link.
alter table public.players add column if not exists claimed_at timestamptz;
alter table public.players add column if not exists is_admin boolean not null default false;
-- Every position he plays, in this order: gk, def, mid, att. Empty = anywhere (not in goal).
-- Only {gk} = goalkeeper only. position and can_gk are kept in step with it (team building uses them).
alter table public.players add column if not exists positions text[] not null default '{}';
-- Changes whenever the photo changes, so the app lists players without their photos and
-- downloads each photo only once per phone (it keeps them by player id + photo_v).
alter table public.players add column if not exists photo_v text
  generated always as (case when photo is null then null else left(md5(photo), 10) end) stored;
alter table public.nights add column if not exists group_id uuid references public.groups on delete cascade;
alter table public.nights add column if not exists cancelled boolean not null default false;  -- a week with no game
alter table public.attendance add column if not exists group_id uuid references public.groups on delete cascade;
alter table public.matches add column if not exists group_id uuid references public.groups on delete cascade;
alter table public.goals add column if not exists group_id uuid references public.groups on delete cascade;
-- Each group's own game rules (the defaults are the rules every group played by before).
alter table public.groups add column if not exists team_size int not null default 6;          -- players per team on the pitch
alter table public.groups add column if not exists match_minutes int not null default 7;      -- regular time of one match
alter table public.groups add column if not exists win_goals int not null default 3;          -- first to this many wins; 0 = time only
alter table public.groups add column if not exists venue text;                                -- where they play (free text)
-- A match keeps the rules it started with, so changing them never ends a match that is on.
-- Null (matches from before) = the old rules: 7 minutes, first to 3.
-- Which sport the group plays. Only 'football' for now (src/sports/ holds each sport's rules and words).
alter table public.groups add column if not exists sport text not null default 'football';
-- How many players the voter moved from the starting (alphabetical) order. 0 = he saved without
-- ranking, and the ballot doesn't count. Null = saved before this was measured.
alter table public.ballots add column if not exists moved int;
alter table public.matches add column if not exists match_minutes int;
alter table public.matches add column if not exists win_goals int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_nickname_len' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_nickname_len
      check (nickname is null or length(trim(nickname)) <= 24);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_sport_valid' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_sport_valid check (sport in ('football'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_rules_valid' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_rules_valid check (
      team_size between 3 and 11 and match_minutes between 2 and 45 and win_goals between 0 and 10
      and (venue is null or length(trim(venue)) <= 60));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_positions_valid' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_positions_valid
      check (positions <@ array['gk', 'def', 'mid', 'att']);
  end if;
  -- "not valid": photos already saved are left alone, every new or changed photo is checked.
  if not exists (select 1 from pg_constraint where conname = 'players_photo_size' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_photo_size
      check (photo is null or length(photo) <= 300000) not valid;
  end if;
end $$;

-- ───────────── Private helpers (not reachable through the API) ─────────────

create schema if not exists private;
revoke all on schema private from public;

-- The personal code this request carries (header x-player-code), lowercased.
create or replace function private.header_code()
returns text
language sql stable set search_path = ''
as $$
  select lower(trim(nullif(current_setting('request.headers', true), '')::json->>'x-player-code'));
$$;

-- A new join code: 6 letters/digits without look-alikes (0/o, 1/l/i), unused by any group.
create or replace function private.new_join_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_abc constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_abc, 1 + (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % length(v_abc))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups g where g.join_code = v_code);
  end loop;
  return v_code;
end $$;

-- ───────────── Moving a version 2 database into its first group ─────────────
-- Everything without a group goes into one group that keeps the old join code and game day.

do $$
declare
  v_group uuid;
  v_join text;
  v_weekday int := 6;
  v_kickoff text := '9:30';
begin
  if not exists (select 1 from public.players where group_id is null)
     and not exists (select 1 from public.nights where group_id is null) then
    return;
  end if;

  if to_regclass('public.settings') is not null then
    execute $q$select value from public.settings where key = 'join_code'$q$ into v_join;
  end if;
  if to_regclass('public.schedule') is not null then
    execute $q$select weekday, kickoff from public.schedule where id = 1$q$ into v_weekday, v_kickoff;
  end if;
  if v_join is null or exists (select 1 from public.groups g where g.join_code = lower(trim(v_join))) then
    v_join := private.new_join_code();
  end if;

  insert into public.groups (name, join_code, weekday, kickoff)
  values ('כדורגל שכונה', lower(trim(v_join)), coalesce(v_weekday, 6), coalesce(v_kickoff, '9:30'))
  returning id into v_group;

  update public.players set group_id = v_group where group_id is null;
  update public.nights set group_id = v_group where group_id is null;
end $$;

-- Children take their group from their parent row.
update public.attendance a set group_id = n.group_id from public.nights n where n.id = a.night_id and a.group_id is null;
update public.matches m set group_id = n.group_id from public.nights n where n.id = m.night_id and m.group_id is null;
update public.goals g set group_id = m.group_id from public.matches m where m.id = g.match_id and g.group_id is null;

alter table public.players alter column group_id set not null;
alter table public.nights alter column group_id set not null;
alter table public.attendance alter column group_id set not null;
alter table public.matches alter column group_id set not null;
alter table public.goals alter column group_id set not null;

-- One game night per day per group (it used to be one per day for the whole database).
alter table public.nights drop constraint if exists nights_day_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nights_group_day_key' and conrelid = 'public.nights'::regclass) then
    alter table public.nights add constraint nights_group_day_key unique (group_id, day);
  end if;
end $$;

-- The join code and weekly schedule live on the group now.
drop table if exists public.settings;
drop table if exists public.schedule;

create index if not exists players_group_idx on public.players (group_id);
create index if not exists attendance_player_idx on public.attendance (player_id);
create index if not exists attendance_group_idx on public.attendance (group_id);
create index if not exists matches_group_idx on public.matches (group_id);
create index if not exists goals_match_idx on public.goals (match_id);
create index if not exists goals_group_idx on public.goals (group_id);

-- ───────────── Old functions whose signature or meaning changed ─────────────

drop function if exists public.voter_by_code(text);
-- These gained p_positions.
drop function if exists public.create_group(text, text, text, text, text, boolean, text);
drop function if exists public.create_group(text, text, text, text, text, boolean, text, text[]);
drop function if exists public.join_team(text, text, text, text, text, boolean, text);
drop function if exists public.claim_player(text, uuid, text, text, text, boolean, text);
drop function if exists public.update_my_profile(text, text, text, text, boolean, text);
drop function if exists public.update_my_profile(text, text, text, text, boolean, text, text[]);
drop function if exists public.member_join_code();
drop function if exists private.player_scores();

-- ───────────── Who is calling ─────────────

-- The active player whose personal code this request carries (null if none).
create or replace function public.my_player_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.player_id
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  where c.code = private.header_code();
$$;

-- His group (null if none). Every read and write is limited to it.
create or replace function public.my_group()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.group_id
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  where c.code = private.header_code();
$$;

create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.my_group() is not null;
$$;

-- An admin of his own group (whoever opened it, and anyone he made admin).
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.player_codes c
    join public.players p on p.id = c.player_id and p.active and p.is_admin
    where c.code = private.header_code()
  );
$$;

create or replace function public.schema_version()
returns int
language sql immutable security definer set search_path = ''
as $$ select 3 $$;

-- New rows land in the caller's group unless the server sets it.
alter table public.players alter column group_id set default public.my_group();
alter table public.nights alter column group_id set default public.my_group();

-- ───────────── Triggers ─────────────

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

-- A player never moves to another group, and a group always keeps at least one active admin.
create or replace function private.guard_players()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.group_id is distinct from old.group_id then
    raise exception 'players cannot change group';
  end if;
  if old.is_admin and old.active
     and (tg_op = 'DELETE' or not (new.is_admin and new.active))
     and exists (select 1 from public.groups g where g.id = old.group_id)  -- not when the whole group is deleted
     and not exists (
       select 1 from public.players p
       where p.group_id = old.group_id and p.id <> old.id and p.is_admin and p.active) then
    raise exception 'last admin';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists players_guard on public.players;
create trigger players_guard before update or delete on public.players
  for each row execute function private.guard_players();

-- The old single position (+ "can play in goal") as a list of positions.
-- Fewest players present to split into two teams: 8 for 6 a side, 6 for small sides, 18 for 11 a side.
create or replace function private.min_players(p_team_size int)
returns int
language sql immutable set search_path = ''
as $$ select least(2 * p_team_size, greatest(6, 2 * p_team_size - 4)) $$;

create or replace function private.positions_of(p_position text, p_can_gk boolean)
returns text[]
language sql immutable set search_path = ''
as $$
  select case
    when p_position = 'gk' then array['gk']
    when p_position in ('def', 'mid', 'att') then case when p_can_gk then array['gk', p_position] else array[p_position] end
    when p_can_gk then array['gk', 'def', 'mid', 'att']  -- anywhere, goal too
    else '{}'::text[]
  end;
$$;

-- positions is what players choose; position and can_gk follow it (and the other way round
-- for anything that still writes position/can_gk).
create or replace function private.sync_positions()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_field text[];
begin
  if tg_op = 'INSERT' and new.positions = '{}' and (new.position <> 'any' or new.can_gk)
     or tg_op = 'UPDATE' and new.positions is not distinct from old.positions
        and (new.position is distinct from old.position or new.can_gk is distinct from old.can_gk) then
    new.positions := private.positions_of(new.position, new.can_gk);
  end if;
  if new.position not in ('gk', 'def', 'mid', 'att', 'any') or not new.positions <@ array['gk', 'def', 'mid', 'att'] then
    raise exception 'invalid position';
  end if;
  -- Each position once, in the usual order.
  new.positions := array(select x from unnest(array['gk', 'def', 'mid', 'att']) as x where x = any(new.positions));
  v_field := array(select x from unnest(new.positions) as x where x <> 'gk');
  new.position := case
    when new.positions = array['gk'] then 'gk'
    when cardinality(v_field) = 1 then v_field[1]
    else 'any'
  end;
  new.can_gk := 'gk' = any(new.positions);
  return new;
end $$;

drop trigger if exists players_sync_positions on public.players;
create trigger players_sync_positions before insert or update on public.players
  for each row execute function private.sync_positions();

-- Players saved before positions existed get theirs once.
update public.players set positions = private.positions_of(position, can_gk)
where positions = '{}' and (position <> 'any' or can_gk);

-- Attendance, matches and goals take their group from the night/match, and may only
-- mention players of that group.
create or replace function private.fill_group()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  -- On update only the ids that changed are checked: a player deleted mid-match must not
  -- stop the clock from being saved.
  if tg_table_name = 'attendance' then
    new.group_id := (select n.group_id from public.nights n where n.id = new.night_id);
    v_ids := array[new.player_id];
  elsif tg_table_name = 'matches' then
    new.group_id := (select n.group_id from public.nights n where n.id = new.night_id);
    if tg_op = 'INSERT' then
      select g.match_minutes, g.win_goals into new.match_minutes, new.win_goals
      from public.groups g where g.id = new.group_id;
    else
      new.match_minutes := old.match_minutes;
      new.win_goals := old.win_goals;
    end if;
    v_ids := new.team_a || new.team_b || new.bench;
    if tg_op = 'UPDATE' then
      v_ids := array(select x from unnest(v_ids) as x where not (x = any(old.team_a || old.team_b || old.bench)));
    end if;
  else
    new.group_id := (select m.group_id from public.matches m where m.id = new.match_id);
    v_ids := array_remove(array[new.scorer, new.assist], null);
    if tg_op = 'UPDATE' then
      v_ids := array(select x from unnest(v_ids) as x where x is distinct from old.scorer and x is distinct from old.assist);
    end if;
  end if;
  if exists (
    select 1 from unnest(v_ids) as x
    where not exists (select 1 from public.players p where p.id = x and p.group_id = new.group_id)
  ) then
    raise exception 'player from another group';
  end if;
  return new;
end $$;

drop trigger if exists attendance_fill_group on public.attendance;
create trigger attendance_fill_group before insert or update on public.attendance
  for each row execute function private.fill_group();
drop trigger if exists matches_fill_group on public.matches;
create trigger matches_fill_group before insert or update on public.matches
  for each row execute function private.fill_group();
drop trigger if exists goals_fill_group on public.goals;
create trigger goals_fill_group before insert or update on public.goals
  for each row execute function private.fill_group();

-- Players may create a game night (by signing up), but only an admin cancels one.
create or replace function public.guard_night_cancel()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.group_id is distinct from old.group_id then
    raise exception 'nights cannot change group';
  end if;
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

-- Any player may cancel a match that is on, but only an admin deletes one that was played.
-- Not security definer: current_user tells an app request (anon/authenticated) from the owner,
-- and deletes that cascade from a night or group (trigger depth > 1) are let through.
create or replace function public.guard_match_delete()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status = 'finished' and pg_trigger_depth() = 1
     and current_user in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'only the admin deletes a played match';
  end if;
  return old;
end $$;

drop trigger if exists matches_guard_delete on public.matches;
create trigger matches_guard_delete before delete on public.matches
  for each row execute function public.guard_match_delete();

-- Live updates: a content-free "something changed" ping on the group's public channel
-- (topic "g:<group id>"); phones then reload what they may read. Skipped without Supabase Realtime.
create or replace function private.ping_group()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid := case when tg_op = 'DELETE' then old.group_id else new.group_id end;
begin
  -- A failed ping must never stop a goal or an attendance tap from being saved.
  begin
    if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is not null then
      execute 'select realtime.send($1, $2, $3, false)'
        using jsonb_build_object('table', tg_table_name), 'change', 'g:' || v_group::text;
    end if;
  exception when others then
    null;
  end;
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['players', 'nights', 'attendance', 'matches', 'goals'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_ping', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.ping_group()', t || '_ping', t);
  end loop;
end $$;

-- Version 2 sent whole rows to every phone; the pings above replace that.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['nights', 'attendance', 'matches', 'goals'] loop
      if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime drop table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ───────────── Row level security ─────────────
-- Start from nothing: drop every policy on our tables and every grant to the API roles,
-- then allow exactly what is listed below.

do $$
declare
  r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('groups', 'players', 'admins', 'player_codes', 'ballots', 'nights', 'attendance', 'matches', 'goals', 'mvp_votes')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.groups enable row level security;
alter table public.players enable row level security;
alter table public.admins enable row level security;
alter table public.player_codes enable row level security;
alter table public.ballots enable row level security;
alter table public.nights enable row level security;
alter table public.attendance enable row level security;
alter table public.matches enable row level security;
alter table public.goals enable row level security;
alter table public.mvp_votes enable row level security;

revoke all on public.groups, public.players, public.admins, public.player_codes, public.ballots,
  public.nights, public.attendance, public.matches, public.goals, public.mvp_votes
  from public, anon, authenticated;
-- admins, ballots and mvp_votes: no policies and no grants. Only the functions below touch them.

-- Group: members read it (name, join code, game day); admins rename it and set the day.
create policy "members read their group" on public.groups
  for select to anon, authenticated using (id = (select public.my_group()));
create policy "admins change their group" on public.groups
  for update to anon, authenticated
  using (id = (select public.my_group()) and (select public.is_admin()))
  with check (id = (select public.my_group()));
grant select on public.groups to anon, authenticated;
grant update (name, weekday, kickoff, team_size, match_minutes, win_goals, venue) on public.groups to anon, authenticated;

-- Players: members see their group; admins add, edit and remove them.
create policy "members read players" on public.players
  for select to anon, authenticated using (group_id = (select public.my_group()));
create policy "admins add players" on public.players
  for insert to anon, authenticated
  with check (group_id = (select public.my_group()) and (select public.is_admin()));
create policy "admins change players" on public.players
  for update to anon, authenticated
  using (group_id = (select public.my_group()) and (select public.is_admin()))
  with check (group_id = (select public.my_group()));
create policy "admins remove players" on public.players
  for delete to anon, authenticated
  using (group_id = (select public.my_group()) and (select public.is_admin()));
grant select, delete on public.players to anon, authenticated;
grant insert (name, emoji, photo, position, can_gk, positions, active, nickname, is_admin) on public.players to anon, authenticated;
grant update (name, emoji, photo, position, can_gk, positions, active, nickname, is_admin, claimed_at) on public.players to anon, authenticated;

-- Personal codes: only the group's admins read or replace them.
create policy "admins read codes" on public.player_codes
  for select to anon, authenticated
  using ((select public.is_admin())
         and exists (select 1 from public.players p where p.id = player_id and p.group_id = (select public.my_group())));
create policy "admins change codes" on public.player_codes
  for update to anon, authenticated
  using ((select public.is_admin())
         and exists (select 1 from public.players p where p.id = player_id and p.group_id = (select public.my_group())))
  with check (true);
grant select, update (code) on public.player_codes to anon, authenticated;

-- Nights, attendance, matches, goals: any member of the group reads and writes them.
do $$
declare
  t text;
begin
  foreach t in array array['nights', 'attendance', 'matches', 'goals'] loop
    execute format('create policy "members read %s" on public.%I for select to anon, authenticated using (group_id = (select public.my_group()))', t, t);
    execute format('create policy "members add %s" on public.%I for insert to anon, authenticated with check (group_id = (select public.my_group()))', t, t);
    execute format('create policy "members change %s" on public.%I for update to anon, authenticated using (group_id = (select public.my_group())) with check (group_id = (select public.my_group()))', t, t);
    execute format('create policy "members remove %s" on public.%I for delete to anon, authenticated using (group_id = (select public.my_group()))', t, t);
  end loop;
end $$;
grant select, insert, update, delete on public.nights, public.attendance, public.matches, public.goals to anon, authenticated;

-- ───────────── Opening a group, joining it ─────────────

-- Anyone opens a new group and becomes its first player and admin. Returns his personal code.
-- p_settings (all optional): weekday, kickoff, team_size, match_minutes, win_goals, venue.
create or replace function public.create_group(
  p_group text, p_name text, p_emoji text, p_photo text, p_position text, p_can_gk boolean, p_nickname text,
  p_positions text[] default null, p_settings jsonb default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_group_name text := trim(coalesce(p_group, ''));
  v_name text := trim(coalesce(p_name, ''));
  v_group uuid;
  v_id uuid;
begin
  if length(v_group_name) = 0 or length(v_group_name) > 40 then
    raise exception 'group name required';
  end if;
  if length(v_name) = 0 or length(v_name) > 30 then
    raise exception 'name required';
  end if;

  begin
    insert into public.groups (name, join_code, weekday, kickoff, team_size, match_minutes, win_goals, venue)
    values (
      v_group_name, private.new_join_code(),
      coalesce((p_settings->>'weekday')::int, 6),
      coalesce(nullif(p_settings->>'kickoff', ''), '9:30'),
      coalesce((p_settings->>'team_size')::int, 6),
      coalesce((p_settings->>'match_minutes')::int, 7),
      coalesce((p_settings->>'win_goals')::int, 3),
      nullif(trim(p_settings->>'venue'), ''))
    returning id into v_group;
  exception when check_violation or invalid_text_representation then
    raise exception 'invalid settings';
  end;

  insert into public.players (group_id, name, emoji, photo, position, can_gk, positions, nickname, claimed_at, is_admin)
  values (
    v_group, v_name,
    coalesce(nullif(trim(p_emoji), ''), '⚽'),
    p_photo,
    coalesce(p_position, 'any'),
    coalesce(p_can_gk, false) or coalesce(p_position, 'any') = 'gk',
    coalesce(p_positions, '{}'),
    nullif(trim(p_nickname), ''),
    now(), true)
  returning id into v_id;

  return (select c.code from public.player_codes c where c.player_id = v_id);
end $$;

-- What the join link shows before you are in: the group (id, name) and the names nobody has claimed yet.
create or replace function public.group_preview(p_join text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'weekday', g.weekday,
    'kickoff', g.kickoff,
    'venue', g.venue,
    'open', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'emoji', p.emoji, 'photo', p.photo) order by p.name)
      from public.players p
      where p.group_id = g.id and p.active and p.claimed_at is null), '[]'::jsonb))
  from public.groups g
  where g.join_code = lower(trim(p_join));
$$;

-- Someone with the group's join link adds himself; returns his new personal code.
create or replace function public.join_team(
  p_join text, p_name text, p_emoji text, p_photo text, p_position text, p_can_gk boolean, p_nickname text, p_positions text[] default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid := (select g.id from public.groups g where g.join_code = lower(trim(p_join)));
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_group is null then
    raise exception 'invalid join code';
  end if;

  if length(v_name) = 0 or length(v_name) > 30 then
    raise exception 'name required';
  end if;

  -- One sign-up at a time per group, so two people can't take the same name together.
  perform pg_advisory_xact_lock(hashtext('join:' || v_group::text));

  if exists (select 1 from public.players p where p.group_id = v_group and p.active and lower(trim(p.name)) = lower(v_name)) then
    raise exception 'name taken';
  end if;

  if (select count(*) from public.players p where p.group_id = v_group) >= 150 then
    raise exception 'too many players';
  end if;

  insert into public.players (group_id, name, emoji, photo, position, can_gk, positions, nickname, claimed_at)
  values (
    v_group,
    v_name,
    coalesce(nullif(trim(p_emoji), ''), '⚽'),
    p_photo,
    coalesce(p_position, 'any'),
    coalesce(p_can_gk, false) or coalesce(p_position, 'any') = 'gk',
    coalesce(p_positions, '{}'),
    nullif(trim(p_nickname), ''),
    now())
  returning id into v_id;

  return (select c.code from public.player_codes c where c.player_id = v_id);
end $$;

-- The admin adds the regulars by name; each one opens the join link, picks his own name
-- (only names nobody has claimed yet) and fills in his profile. Returns his personal code.
create or replace function public.claim_player(
  p_join text, p_player uuid, p_emoji text, p_photo text, p_position text, p_can_gk boolean, p_nickname text, p_positions text[] default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid := (select g.id from public.groups g where g.join_code = lower(trim(p_join)));
begin
  if v_group is null then
    raise exception 'invalid join code';
  end if;

  -- Same lock as join_team: two phones can't claim the same name together.
  perform pg_advisory_xact_lock(hashtext('join:' || v_group::text));

  update public.players
  set emoji = coalesce(nullif(trim(p_emoji), ''), emoji),
      photo = p_photo,
      position = coalesce(p_position, position),
      can_gk = coalesce(p_can_gk, false) or coalesce(p_position, position) = 'gk',
      positions = coalesce(p_positions, positions),
      nickname = nullif(trim(p_nickname), ''),
      claimed_at = now()
  where id = p_player and group_id = v_group and active and claimed_at is null;

  if not found then
    raise exception 'already claimed';
  end if;

  return (select c.code from public.player_codes c where c.player_id = p_player);
end $$;

-- An admin replaces the group's join link (the old one stops working).
create or replace function public.new_join_code()
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  v_code := private.new_join_code();
  update public.groups set join_code = v_code where id = public.my_group();
  return v_code;
end $$;

-- ───────────── A player's own things, by personal code ─────────────

create or replace function public.voter_by_code(p_code text)
returns table (player_id uuid, name text, ranking uuid[], group_id uuid, group_name text, is_admin boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, b.ranking, g.id, g.name, p.is_admin
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  join public.groups g on g.id = p.group_id
  left join public.ballots b on b.voter_id = p.id
  where c.code = lower(trim(p_code));
$$;

-- How many players were moved from alphabetical order (the order a first ballot starts in, the same
-- order the app lists players in): the count minus the longest run already in that order.
create or replace function private.moved_count(p_ranking uuid[])
returns int
language plpgsql stable set search_path = ''
as $$
declare
  v_pos int[];
  v_tails int[] := '{}';
  v_len int := 0;
  x int;
  lo int;
  hi int;
  mid int;
begin
  select coalesce(array_agg(t.k order by t.ord), '{}') into v_pos
  from (
    select r.ord, row_number() over (order by p.name, p.id) as k
    from unnest(p_ranking) with ordinality as r(id, ord)
    join public.players p on p.id = r.id
  ) t;
  foreach x in array v_pos loop
    lo := 1;
    hi := v_len + 1;
    while lo < hi loop
      mid := (lo + hi) / 2;
      if v_tails[mid] < x then lo := mid + 1; else hi := mid; end if;
    end loop;
    v_tails[lo] := x;
    v_len := greatest(v_len, lo);
  end loop;
  return cardinality(v_pos) - v_len;
end $$;

create or replace function public.submit_ballot(p_code text, p_ranking uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_voter uuid;
  v_group uuid;
  v_clean uuid[];
begin
  select p.id, p.group_id into v_voter, v_group
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  where c.code = lower(trim(p_code));

  if v_voter is null then
    raise exception 'invalid code';
  end if;

  -- Keep only active players of his group, drop the voter himself and duplicates, keep the order.
  select coalesce(array_agg(t.id order by t.ord), '{}') into v_clean
  from (
    select distinct on (r.id) r.id, r.ord
    from unnest(p_ranking) with ordinality as r(id, ord)
    join public.players p on p.id = r.id and p.active and p.group_id = v_group
    where r.id <> v_voter
    order by r.id, r.ord
  ) t;

  insert into public.ballots (voter_id, ranking, moved, updated_at)
  values (v_voter, v_clean, private.moved_count(v_clean), now())
  on conflict (voter_id) do update set ranking = excluded.ranking, moved = excluded.moved, updated_at = now();

  -- Using his personal code means the name is his: it can't be picked from the join link anymore.
  update public.players set claimed_at = coalesce(claimed_at, now()) where id = v_voter;
end $$;

-- A player edits his own profile with his personal code. Name, active and admin stay with the admins.
-- p_keep_photo: leave the photo as it is (the app sends the photo only when he changed it).
create or replace function public.update_my_profile(
  p_code text, p_emoji text, p_photo text, p_position text, p_can_gk boolean, p_nickname text,
  p_positions text[] default null, p_keep_photo boolean default false)
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
      photo = case when p_keep_photo then photo else p_photo end,
      position = coalesce(p_position, position),
      can_gk = coalesce(p_can_gk, false) or coalesce(p_position, position) = 'gk',
      positions = coalesce(p_positions, positions),
      nickname = nullif(trim(p_nickname), ''),
      claimed_at = coalesce(claimed_at, now())
  where id = v_player;
end $$;

-- ───────────── Ranking ─────────────
-- Each ballot is first trimmed to active players of the group (and never the voter),
-- then each place becomes a score from 100 (first) to 0 (last), so ballots of different
-- lengths count the same. A player's rating is the average score over the ballots he is on.

-- A ballot saved without moving anybody (3+ players, still alphabetical) is noise: it doesn't count.
create or replace function private.ballot_counts(b public.ballots)
returns boolean
language sql immutable set search_path = ''
as $$ select b.moved is null or b.moved > 0 or cardinality(b.ranking) < 3 $$;

-- Rating of every active player of a group: unrounded, 50 without votes.
create or replace function private.player_scores(p_group uuid)
returns table (player_id uuid, score numeric)
language sql stable set search_path = ''
as $$
  with placed as (
    select r.id,
           row_number() over (partition by b.voter_id order by r.ord) as pos,
           count(*) over (partition by b.voter_id) as n
    from public.ballots b
    join public.players v on v.id = b.voter_id and v.group_id = p_group
    cross join lateral unnest(b.ranking) with ordinality as r(id, ord)
    join public.players p on p.id = r.id and p.active and p.group_id = p_group
    where r.id <> b.voter_id
      and private.ballot_counts(b)
  ),
  scored as (
    select placed.id,
           case when placed.n = 1 then 0.5 else 1 - (placed.pos - 1)::numeric / (placed.n - 1) end as s
    from placed
  )
  select p.id, coalesce(avg(sc.s) * 100, 50)
  from public.players p
  left join scored sc on sc.id = p.id
  where p.active and p.group_id = p_group
  group by p.id;
$$;

-- The ranking of the caller's group. Admins only.
create or replace function public.admin_ratings()
returns table (player_id uuid, score numeric, avg_rank numeric, votes int, has_voted boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_group uuid := public.my_group();
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
    join public.players v on v.id = b.voter_id and v.group_id = v_group
    cross join lateral unnest(b.ranking) with ordinality as r(id, ord)
    join public.players p on p.id = r.id and p.active and p.group_id = v_group
    where r.id <> b.voter_id
      and private.ballot_counts(b)
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
  where p.active and p.group_id = v_group
  group by p.id;
end $$;

-- Ballots saved before "moved" was measured get it once.
update public.ballots set moved = private.moved_count(ranking) where moved is null;

-- Who of the caller's group has ranked, and how many players each moved from the starting order.
-- Admins only. Never the ballots themselves: what each player ranked stays secret.
create or replace function public.admin_ballot_status()
returns table (player_id uuid, ranked int, moved int, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return query
  select p.id, cardinality(b.ranking), b.moved, b.updated_at
  from public.players p
  left join public.ballots b on b.voter_id = p.id
  where p.group_id = public.my_group() and p.active;
end $$;

-- A player leaves his group: he becomes inactive (his games and goals stay in the stats) and his
-- code stops working. An admin can bring him back. The last admin can't leave (trigger).
create or replace function public.leave_group(p_code text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid := (
    select c.player_id from public.player_codes c
    join public.players p on p.id = c.player_id and p.active
    where c.code = lower(trim(p_code)));
begin
  if v_player is null then
    raise exception 'invalid code';
  end if;
  update public.players set active = false, is_admin = false where id = v_player;
end $$;

-- ───────────── Team building (members) ─────────────
-- Same rules as src/lib/teams.js. Players are handled as positions (1..n) in a list,
-- with their ratings in a parallel float8[].

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

-- Splits tonight's players (minus p_bench) into two balanced teams: splitTeams() in teams.js.
create or replace function public.make_teams(p_night uuid, p_bench uuid[] default '{}')
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_group uuid := public.my_group();
  v_ids uuid[];
  v_r float8[];
  v_gk boolean[];
  v_keepers int[];
  v_rest int[];
  v_n int;
  v_size_a int;
  v_min int;
  v_a int[];
  v_b int[];
  v_cost float8;
  v_best_cost float8;
  v_best_a int[];
  v_best_b int[];
  i int;
  x int;
begin
  if v_group is null or not exists (select 1 from public.nights n where n.id = p_night and n.group_id = v_group) then
    raise exception 'not allowed';
  end if;

  select coalesce(array_agg(p.id order by at.arrived_at, p.id), '{}'),
         coalesce(array_agg(coalesce(s.score, 50)::float8 order by at.arrived_at, p.id), '{}'),
         coalesce(array_agg(p.position = 'gk' order by at.arrived_at, p.id), '{}')
  into v_ids, v_r, v_gk
  from public.attendance at
  join public.players p on p.id = at.player_id and p.active
  left join private.player_scores(v_group) s on s.player_id = p.id
  where at.night_id = p_night
    and not (p.id = any(coalesce(p_bench, '{}')));

  v_n := cardinality(v_ids);
  v_min := (select private.min_players(g.team_size) from public.groups g where g.id = v_group);
  if v_n < v_min then
    raise exception 'need at least % players', v_min;
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
  select * into m from public.matches where id = p_match;
  if not public.is_member() or (found and m.group_id is distinct from public.my_group()) then
    raise exception 'not allowed';
  end if;
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
  left join private.player_scores(m.group_id) s on s.player_id = p.id
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
  v_size := least((select g.team_size from public.groups g where g.id = m.group_id), v_n / 2);

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

-- ───────────── Player of the match (MVP) ─────────────
-- Everyone who played a finished match picks the best player in it (not himself).

create or replace function public.vote_mvp(p_code text, p_match uuid, p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_voter uuid;
  v_group uuid;
  m public.matches;
begin
  select p.id, p.group_id into v_voter, v_group
  from public.player_codes c
  join public.players p on p.id = c.player_id and p.active
  where c.code = lower(trim(p_code));
  if v_voter is null then
    raise exception 'invalid code';
  end if;

  select * into m from public.matches where id = p_match and group_id = v_group;
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

-- Totals per match and player, for the caller's group.
create or replace function public.mvp_tally()
returns table (match_id uuid, player_id uuid, votes int)
language sql stable security definer set search_path = ''
as $$
  select v.match_id, v.player_id, count(*)::int
  from public.mvp_votes v
  join public.matches m on m.id = v.match_id and m.group_id = public.my_group()
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

-- ───────────── Who may call what ─────────────

do $$
declare
  f text;
begin
  -- Called through the API by anyone (each checks the caller itself).
  foreach f in array array[
    'public.my_player_id()', 'public.my_group()', 'public.is_member()', 'public.is_admin()', 'public.schema_version()',
    'public.create_group(text, text, text, text, text, boolean, text, text[], jsonb)', 'public.group_preview(text)',
    'public.join_team(text, text, text, text, text, boolean, text, text[])',
    'public.claim_player(text, uuid, text, text, text, boolean, text, text[])', 'public.new_join_code()',
    'public.voter_by_code(text)', 'public.submit_ballot(text, uuid[])',
    'public.update_my_profile(text, text, text, text, boolean, text, text[], boolean)', 'public.admin_ratings()',
    'public.make_teams(uuid, uuid[])', 'public.suggest_rotation(uuid)', 'public.admin_ballot_status()', 'public.leave_group(text)',
    'public.vote_mvp(text, uuid, uuid)', 'public.mvp_tally()', 'public.my_mvp_votes(text)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  -- Trigger functions: never called directly.
  foreach f in array array['public.give_player_code()', 'public.guard_night_cancel()', 'public.guard_match_delete()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
