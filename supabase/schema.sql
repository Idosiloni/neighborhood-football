-- Neighborhood football, schema version 9: many groups in one database, each with its own options and rules.
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

-- Version 6: the admins' own rating of each player, 1–5 stars, for groups that rate this way
-- (options.rating = 'admin'). Private like the ballots: only through admin functions.
create table if not exists public.coach_ratings (
  player_id uuid primary key references public.players on delete cascade,
  group_id uuid not null references public.groups on delete cascade,
  stars int not null check (stars between 1 and 5),
  updated_at timestamptz not null default now()
);

-- Version 7: seasons. Each one starts on a day; it runs until the next one starts. Games before
-- the first season belong to "earlier". Members read them; admins start and rename them.
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  name text not null check (length(trim(name)) between 1 and 30),
  starts_on date not null,
  created_at timestamptz not null default now(),
  unique (group_id, starts_on)
);

-- Version 8: category ratings ("advanced"): every player rates the others 1–5 in each category
-- (speed, shooting, passing, technique, defending, fitness; four more for goalkeepers), relative to
-- the group. One standing value per rater, player and category. Private: only through functions;
-- the cards show only the combined result (attr_cards), never who rated what.
create table if not exists public.attr_ratings (
  voter_id uuid not null references public.players on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  group_id uuid not null references public.groups on delete cascade,
  attr text not null check (attr in ('spd', 'sht', 'pas', 'tec', 'def', 'fit', 'gk_ref', 'gk_han', 'gk_pos', 'gk_dis')),
  score int not null check (score between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (voter_id, player_id, attr)
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
  phase text not null default 'regular' check (phase in ('regular', 'extra', 'golden', 'break', 'penalties')),
  clock_ms int not null default 0,
  running_since timestamptz null,
  winner text null check (winner in ('a', 'b', 'draw')),
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
-- The group's other settings, as one object checked by private.options_valid (version 4, trigger groups_check_options).
-- Today: lang ('he' / 'en', the group's language). More options are added there, never as new columns.
-- Groups from before version 4 all played in Hebrew: they get lang 'he' once, when the column is added
-- (so phones set to English keep showing them in Hebrew). Groups opened later are left alone.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'groups' and column_name = 'options') then
    alter table public.groups add column options jsonb not null default '{}'::jsonb;
    update public.groups set options = '{"lang": "he"}';
  end if;
end $$;
-- How many players the voter moved from the starting (alphabetical) order. 0 = he saved without
-- ranking, and the ballot doesn't count. Null = saved before this was measured.
alter table public.ballots add column if not exists moved int;
alter table public.matches add column if not exists match_minutes int;
alter table public.matches add column if not exists win_goals int;
-- Version 5: the rest of the group's rules, frozen on the match too ({ periods, break_minutes,
-- extra_minutes, tie }; null = from before: one period, 2 minutes of extra time, then golden goal),
-- which period is on, and when half-time started (the break's own timer).
alter table public.matches add column if not exists rules jsonb;
alter table public.matches add column if not exists period int not null default 1;
alter table public.matches add column if not exists break_since timestamptz;

-- Limits that changed in version 5 are replaced on every run, so existing databases get them too:
-- draws, half-time and penalties, and periods up to 120 minutes.
alter table public.matches drop constraint if exists matches_winner_check;
alter table public.matches add constraint matches_winner_check check (winner in ('a', 'b', 'draw'));
alter table public.matches drop constraint if exists matches_phase_check;
alter table public.matches add constraint matches_phase_check
  check (phase in ('regular', 'extra', 'golden', 'break', 'penalties'));
alter table public.matches drop constraint if exists matches_period_check;
alter table public.matches add constraint matches_period_check check (period between 1 and 4);
alter table public.groups drop constraint if exists groups_rules_valid;

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
      team_size between 3 and 11 and match_minutes between 2 and 120 and win_goals between 0 and 10
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

-- A whole number option within limits (or not set). Checks the type first, so 2.5 or "x" is refused, not rounded.
create or replace function private.option_int(o jsonb, k text, lo int, hi int)
returns boolean
language sql immutable set search_path = ''
as $$
  select not o ? k or (jsonb_typeof(o->k) = 'number' and (o->>k)::numeric = trunc((o->>k)::numeric)
                       and (o->>k)::numeric between lo and hi);
$$;

-- A true/false option (or not set).
create or replace function private.option_bool(o jsonb, k text)
returns boolean
language sql immutable set search_path = ''
as $$
  select not o ? k or jsonb_typeof(o->k) = 'boolean';
$$;

-- A group's options: an object with known keys only, each with an allowed value. Same rules as
-- src/lib/options.js. A new option = a new line here and there (old groups simply don't have it).
create or replace function private.options_valid(o jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(o) = 'object'
    and not exists (select 1 from jsonb_object_keys(o) k where k not in (
      'lang', 'format', 'periods', 'break_minutes', 'extra_minutes', 'tie', 'team_a', 'team_b',
      'rating', 'mvp', 'assists', 'quick_signup'))
    and (not o ? 'rating' or o->>'rating' in ('peers', 'admin', 'none', 'attrs'))
    and private.option_bool(o, 'mvp') and private.option_bool(o, 'assists') and private.option_bool(o, 'quick_signup')
    and (not o ? 'lang' or o->>'lang' in ('he', 'en'))
    and (not o ? 'format' or o->>'format' in ('rounds', 'game'))
    and (not o ? 'tie' or o->>'tie' in ('extra', 'penalties', 'draw'))
    and private.option_int(o, 'periods', 1, 4)
    and private.option_int(o, 'break_minutes', 0, 30)
    and private.option_int(o, 'extra_minutes', 0, 10)
    and (not o ? 'team_a' or o->>'team_a' in ('blue', 'orange', 'red', 'white', 'black', 'yellow', 'green', 'purple'))
    and (not o ? 'team_b' or o->>'team_b' in ('blue', 'orange', 'red', 'white', 'black', 'yellow', 'green', 'purple'))
    and coalesce(o->>'team_a', 'blue') <> coalesce(o->>'team_b', 'orange');
$$;

-- Checked by a trigger rather than a check constraint: a constraint would run private.options_valid
-- as the caller, who may not use the private schema.
create or replace function private.check_options()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.options_valid(new.options) then
    raise exception 'invalid options' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists groups_check_options on public.groups;
create trigger groups_check_options before insert or update of options on public.groups
  for each row execute function private.check_options();

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

  insert into public.groups (name, join_code, weekday, kickoff, options)
  values ('כדורגל שכונה', lower(trim(v_join)), coalesce(v_weekday, 6), coalesce(v_kickoff, '9:30'), '{"lang": "he"}')
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
as $$ select 9 $$;

-- New rows land in the caller's group unless the server sets it.
alter table public.players alter column group_id set default public.my_group();
alter table public.nights alter column group_id set default public.my_group();
alter table public.seasons alter column group_id set default public.my_group();

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
      select g.match_minutes, g.win_goals,
             jsonb_strip_nulls(jsonb_build_object(
               'periods', g.options->'periods', 'break_minutes', g.options->'break_minutes',
               'extra_minutes', g.options->'extra_minutes', 'tie', g.options->'tie'))
      into new.match_minutes, new.win_goals, new.rules
      from public.groups g where g.id = new.group_id;
      new.period := 1;
    else
      new.match_minutes := old.match_minutes;
      new.win_goals := old.win_goals;
      new.rules := old.rules;
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
  foreach t in array array['players', 'nights', 'attendance', 'matches', 'goals', 'seasons'] loop
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
      and tablename in ('groups', 'players', 'admins', 'player_codes', 'ballots', 'nights', 'attendance', 'matches', 'goals', 'mvp_votes', 'seasons')
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
alter table public.coach_ratings enable row level security;
alter table public.attr_ratings enable row level security;

revoke all on public.groups, public.players, public.admins, public.player_codes, public.ballots,
  public.nights, public.attendance, public.matches, public.goals, public.mvp_votes, public.coach_ratings,
  public.attr_ratings
  from public, anon, authenticated;
-- admins, ballots, mvp_votes and coach_ratings: no policies and no grants. Only the functions below touch them.

-- Group: members read it (name, join code, game day); admins rename it and set the day.
create policy "members read their group" on public.groups
  for select to anon, authenticated using (id = (select public.my_group()));
create policy "admins change their group" on public.groups
  for update to anon, authenticated
  using (id = (select public.my_group()) and (select public.is_admin()))
  with check (id = (select public.my_group()));
grant select on public.groups to anon, authenticated;
grant update (name, weekday, kickoff, team_size, match_minutes, win_goals, venue, options) on public.groups to anon, authenticated;

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

-- Seasons: members read their group's; admins start, rename and remove them.
alter table public.seasons enable row level security;
revoke all on public.seasons from public, anon, authenticated;
create policy "members read seasons" on public.seasons
  for select to anon, authenticated using (group_id = (select public.my_group()));
create policy "admins add seasons" on public.seasons
  for insert to anon, authenticated with check (group_id = (select public.my_group()) and (select public.is_admin()));
create policy "admins change seasons" on public.seasons
  for update to anon, authenticated using (group_id = (select public.my_group()) and (select public.is_admin()))
  with check (group_id = (select public.my_group()));
create policy "admins remove seasons" on public.seasons
  for delete to anon, authenticated using (group_id = (select public.my_group()) and (select public.is_admin()));
grant select, insert, delete on public.seasons to anon, authenticated;
grant update (name, starts_on) on public.seasons to anon, authenticated;

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
    insert into public.groups (name, join_code, weekday, kickoff, team_size, match_minutes, win_goals, venue, options)
    values (
      v_group_name, private.new_join_code(),
      coalesce((p_settings->>'weekday')::int, 6),
      coalesce(nullif(p_settings->>'kickoff', ''), '9:30'),
      coalesce((p_settings->>'team_size')::int, 6),
      coalesce((p_settings->>'match_minutes')::int, 7),
      coalesce((p_settings->>'win_goals')::int, 3),
      nullif(trim(p_settings->>'venue'), ''),
      coalesce(p_settings->'options', '{}'::jsonb))
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
    'lang', g.options->>'lang',
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
-- The combined value of each player in each category, 1–5. Same steps as src/lib/attributes.js:
-- - only ratings from before this week began (published once a week, so the timing doesn't tell who rated);
-- - not about oneself, only active raters and players;
-- - a rater who gave the same score to everyone in everything (3+ players) is left out;
-- - 5+ raters: the highest and the lowest are dropped; then the mean, pulled toward the group's
--   mean for that category as if 3 more average ratings were there (C = 3 when there is none).
create or replace function private.attr_scores(p_group uuid)
returns table (player_id uuid, attr text, value numeric, raters int)
language sql stable set search_path = ''
as $$
  with base as (
    select r.voter_id, r.player_id, r.attr, r.score
    from public.attr_ratings r
    join public.players v on v.id = r.voter_id and v.active and v.group_id = p_group
    join public.players p on p.id = r.player_id and p.active and p.group_id = p_group
    where r.group_id = p_group and r.voter_id <> r.player_id and r.updated_at < date_trunc('week', now())
  ),
  flat as (
    select b.voter_id from base b group by b.voter_id
    having count(distinct b.player_id) >= 3 and count(distinct b.score) = 1
  ),
  kept as (
    select b.* from base b where b.voter_id not in (select f.voter_id from flat f)
  ),
  ranked as (
    select k.*,
           row_number() over (partition by k.player_id, k.attr order by k.score, k.voter_id) as lo,
           row_number() over (partition by k.player_id, k.attr order by k.score desc, k.voter_id) as hi,
           count(*) over (partition by k.player_id, k.attr) as n
    from kept k
  ),
  centre as (
    select r.player_id, r.attr, max(r.n)::int as n,
           (case when max(r.n) >= 5 then max(r.n) - 2 else max(r.n) end)::int as used,
           avg(r.score) filter (where r.n < 5 or (r.lo > 1 and r.hi > 1))::numeric as mean
    from ranked r group by r.player_id, r.attr
  ),
  prior as (
    select k.attr, avg(k.score)::numeric as c from kept k group by k.attr
  )
  select ce.player_id, ce.attr,
         -- the ratings actually used (5+: two fewer), plus 3 imagined ones at the group's mean
         round((ce.mean * ce.used + 3 * coalesce(pr.c, 3)) / (ce.used + 3), 3),
         ce.n
  from centre ce left join prior pr on pr.attr = ce.attr;
$$;

create or replace function private.player_scores(p_group uuid)
returns table (player_id uuid, score numeric)
language sql stable set search_path = ''
as $$
  -- How the group rates (options.rating): 'peers' = everyone's ballots (the default), 'admin' = the
  -- admins' stars (1–5 → 0–100), 'none' = everyone the same (teams by luck and positions only).
  -- Ballots and stars are both kept, so switching back brings the old ratings back.
  with mode as (
    select coalesce(g.options->>'rating', 'peers') as m from public.groups g where g.id = p_group
  ),
  placed as (
    select r.id,
           row_number() over (partition by b.voter_id order by r.ord) as pos,
           count(*) over (partition by b.voter_id) as n
    from public.ballots b
    join public.players v on v.id = b.voter_id and v.group_id = p_group
    cross join lateral unnest(b.ranking) with ordinality as r(id, ord)
    join public.players p on p.id = r.id and p.active and p.group_id = p_group
    where r.id <> b.voter_id
      and private.ballot_counts(b)
      and (select m from mode) = 'peers'
  ),
  scored as (
    select placed.id,
           case when placed.n = 1 then 0.5 else 1 - (placed.pos - 1)::numeric / (placed.n - 1) end as s
    from placed
  )
  select p.id,
         case (select m from mode)
           when 'admin' then coalesce((select (cr.stars - 1) * 25.0 from public.coach_ratings cr where cr.player_id = p.id), 50)
           -- categories: the average of the player's published field categories, 1–5 → 0–100
           when 'attrs' then coalesce((select (avg(a.value) - 1) * 25 from private.attr_scores(p_group) a
                                       where a.player_id = p.id and a.raters >= 3 and a.attr not like 'gk\_%'), 50)
           when 'none' then 50
           else coalesce(avg(sc.s) * 100, 50)
         end
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
  v_streak int[];
  v_stay text;
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
         coalesce(array_agg(st.streak * 10 + st.played order by u.o), '{}'),
         coalesce(array_agg(st.streak order by u.o), '{}')
  into v_played, v_prio, v_streak
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

  -- Who stays: the winner. After a draw, the team that has been on longer (more games in a row
  -- on average) goes off; level (e.g. the first match) = team A stays. Same as stayingSide in teams.js.
  if m.winner in ('a', 'b') then
    v_stay := m.winner;
  else
    select case
      when coalesce(sum(v_streak[array_position(v_ids, t.id)]) filter (where t.side = 'a'), 0) * greatest(count(*) filter (where t.side = 'b'), 1)
         > coalesce(sum(v_streak[array_position(v_ids, t.id)]) filter (where t.side = 'b'), 0) * greatest(count(*) filter (where t.side = 'a'), 1)
      then 'b' else 'a' end
    into v_stay
    from (select x2 as id, 'a' as side from unnest(m.team_a) as x2
          union all select x2, 'b' from unnest(m.team_b) as x2) t
    where t.id = any(v_ids);
  end if;

  v_win := array(
    select array_position(v_ids, t.id)
    from unnest(case when v_stay = 'a' then m.team_a else m.team_b end) with ordinality as t(id, o)
    where t.id = any(v_ids) order by t.o);
  v_lose := array(
    select array_position(v_ids, t.id)
    from unnest(case when v_stay = 'a' then m.team_b else m.team_a end) with ordinality as t(id, o)
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
    'team_a', private.ids_json(case when v_stay = 'a' then v_winner_team else v_new_team end, v_ids),
    'team_b', private.ids_json(case when v_stay = 'b' then v_winner_team else v_new_team end, v_ids),
    'stays', v_stay,
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

-- ───────────── Group options, admin stars, one-tap sign-up (version 6) ─────────────

-- Changes only the options it is given (null = back to the default) and keeps every other key,
-- also ones this version of the app doesn't know. Admins only. Returns the group's options.
create or replace function public.set_options(p_patch jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'invalid options';
  end if;
  update public.groups set options = jsonb_strip_nulls(options || p_patch)
  where id = public.my_group()
  returning options into v_out;
  return v_out;
end $$;

-- The admins' stars for every active player of their group (null = not rated yet).
create or replace function public.admin_stars()
returns table (player_id uuid, stars int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return query
  select p.id, cr.stars
  from public.players p
  left join public.coach_ratings cr on cr.player_id = p.id
  where p.group_id = public.my_group() and p.active;
end $$;

-- An admin rates a player of the group, 1–5 stars (null = remove the rating).
create or replace function public.set_stars(p_player uuid, p_stars int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_group uuid := public.my_group();
begin
  if not public.is_admin() or not exists (select 1 from public.players p where p.id = p_player and p.group_id = v_group) then
    raise exception 'not allowed';
  end if;
  if p_stars is null then
    delete from public.coach_ratings where player_id = p_player;
  elsif p_stars between 1 and 5 then
    insert into public.coach_ratings (player_id, group_id, stars) values (p_player, v_group, p_stars)
    on conflict (player_id) do update set stars = excluded.stars, updated_at = now();
  else
    raise exception 'invalid stars';
  end if;
end $$;

-- One-tap sign-up from the group's link, for groups that allow it (options.quick_signup):
-- no personal link needed, tap your name. The day must be the group's game day, from yesterday
-- to 8 days ahead. Returns the group, the list of active players (no codes, no photos) and who
-- is coming, in order. Null for a wrong join code or a group that doesn't allow it.
create or replace function private.quick_group(p_join text, p_day date)
returns public.groups
language plpgsql stable security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  select * into g from public.groups x where x.join_code = lower(trim(p_join));
  if not found or coalesce((g.options->>'quick_signup')::boolean, false) is not true then
    return null;
  end if;
  if p_day is null or extract(dow from p_day) <> g.weekday or p_day < current_date - 1 or p_day > current_date + 8 then
    raise exception 'invalid day';
  end if;
  return g;
end $$;

create or replace function public.quick_roster(p_join text, p_day date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  g public.groups := private.quick_group(p_join, p_day);
  v_night public.nights;
begin
  if g.id is null then
    return null;
  end if;
  select * into v_night from public.nights n where n.group_id = g.id and n.day = p_day;
  return jsonb_build_object(
    'id', g.id, 'name', g.name, 'weekday', g.weekday, 'kickoff', g.kickoff, 'team_size', g.team_size,
    'options', g.options,
    'cancelled', coalesce(v_night.cancelled, false),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'emoji', p.emoji) order by p.name)
      from public.players p where p.group_id = g.id and p.active), '[]'::jsonb),
    'coming', coalesce((
      select jsonb_agg(a.player_id order by a.arrived_at, a.player_id)
      from public.attendance a join public.players p on p.id = a.player_id and p.active
      where a.night_id = v_night.id), '[]'::jsonb));
end $$;

create or replace function public.quick_signup(p_join text, p_player uuid, p_day date, p_coming boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups := private.quick_group(p_join, p_day);
  v_night uuid;
begin
  if g.id is null then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from public.players p where p.id = p_player and p.group_id = g.id and p.active) then
    raise exception 'not allowed';
  end if;
  insert into public.nights (group_id, day) values (g.id, p_day) on conflict (group_id, day) do nothing;
  select n.id into v_night from public.nights n where n.group_id = g.id and n.day = p_day and not n.cancelled;
  if v_night is null then
    raise exception 'no game';
  end if;
  if p_coming then
    insert into public.attendance (night_id, player_id) values (v_night, p_player) on conflict do nothing;
  else
    delete from public.attendance where night_id = v_night and player_id = p_player;
  end if;
end $$;

-- ───────────── Category ratings (version 8) ─────────────

-- A player rates another in one category, 1–5 (null = remove). Only active players of the same
-- group, never oneself.
create or replace function public.rate_attr(p_code text, p_player uuid, p_attr text, p_score int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_voter uuid;
  v_group uuid;
begin
  select p.id, p.group_id into v_voter, v_group
  from public.player_codes c join public.players p on p.id = c.player_id and p.active
  where c.code = lower(trim(p_code));
  if v_voter is null then
    raise exception 'invalid code';
  end if;
  if p_player = v_voter or not exists (select 1 from public.players p where p.id = p_player and p.group_id = v_group and p.active) then
    raise exception 'not allowed';
  end if;
  if p_score is null then
    delete from public.attr_ratings where voter_id = v_voter and player_id = p_player and attr = p_attr;
  else
    insert into public.attr_ratings (voter_id, player_id, group_id, attr, score) values (v_voter, p_player, v_group, p_attr, p_score)
    on conflict (voter_id, player_id, attr) do update set score = excluded.score, updated_at = now();
  end if;
end $$;

-- What this phone's owner gave (to fill in the rating screen).
create or replace function public.my_attr_ratings(p_code text)
returns table (player_id uuid, attr text, score int)
language sql stable security definer set search_path = ''
as $$
  select r.player_id, r.attr, r.score
  from public.attr_ratings r
  join public.player_codes c on c.player_id = r.voter_id
  join public.players v on v.id = r.voter_id and v.active
  where c.code = lower(trim(p_code));
$$;


-- The published category values of the caller's group, for the cards (members only): only
-- categories with 3 or more raters, never single ratings.
create or replace function public.attr_cards()
returns table (player_id uuid, attr text, value numeric, raters int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'not allowed';
  end if;
  return query select a.player_id, a.attr, a.value, a.raters from private.attr_scores(public.my_group()) a where a.raters >= 3;
end $$;

-- Admins see who has rated and how many players (never the values), like the ranking.
create or replace function public.attr_rating_status()
returns table (player_id uuid, rated int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return query
  select p.id, count(distinct r.player_id)::int
  from public.players p
  left join public.attr_ratings r on r.voter_id = p.id
  where p.group_id = public.my_group() and p.active
  group by p.id;
end $$;

-- ───────────── Notifications on the phone (version 9) ─────────────
-- A phone that allowed notifications saves its push subscription for the player of the open group
-- (one phone in two groups = two rows, same endpoint). What to send waits in push_outbox; the
-- "push" Edge Function (supabase/functions/push) takes it with push_take() and sends it.
-- Nobody reads either table through the API: only the functions below.

create table if not exists public.push_subs (
  player_id uuid not null references public.players on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  created_at timestamptz not null default now(),
  primary key (player_id, endpoint)
);

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players on delete cascade,
  group_id uuid not null references public.groups on delete cascade,
  title text not null,
  body text not null,
  url text not null default '#/',
  tag text not null,                 -- one message per player and tag (e.g. 'remind:2026-11-12')
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create unique index if not exists push_outbox_tag on public.push_outbox (player_id, tag);

alter table public.push_subs enable row level security;
alter table public.push_outbox enable row level security;
revoke all on public.push_subs, public.push_outbox from public, anon, authenticated;

-- The player behind a personal code (active), or null.
create or replace function private.player_of(p_code text)
returns uuid
language sql stable set search_path = ''
as $$
  select p.id from public.player_codes c join public.players p on p.id = c.player_id and p.active
  where c.code = lower(trim(p_code));
$$;

-- This phone wants notifications for the player of this code. At most 10 phones per player.
create or replace function public.save_push(p_code text, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid := private.player_of(p_code);
begin
  if v_player is null then
    raise exception 'invalid code';
  end if;
  insert into public.push_subs (player_id, endpoint, p256dh, auth) values (v_player, p_endpoint, p_p256dh, p_auth)
  on conflict (player_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  delete from public.push_subs s
  where s.player_id = v_player
    and s.endpoint not in (select x.endpoint from public.push_subs x where x.player_id = v_player order by x.created_at desc limit 10);
exception when check_violation then
  raise exception 'invalid subscription';
end $$;

create or replace function public.drop_push(p_code text, p_endpoint text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.push_subs s where s.player_id = private.player_of(p_code) and s.endpoint = p_endpoint;
$$;

create or replace function public.has_push(p_code text, p_endpoint text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.push_subs s where s.player_id = private.player_of(p_code) and s.endpoint = p_endpoint);
$$;

-- One message to some players of a group (only those with a phone that wants notifications).
-- p_only: just these players; p_except: everyone but this one. Same player and tag twice = once.
create or replace function private.queue_push(p_group uuid, p_tag text, p_title text, p_body text, p_url text,
  p_only uuid[] default null, p_except uuid default null)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.push_outbox (player_id, group_id, title, body, url, tag)
  select p.id, p_group, p_title, p_body, coalesce(p_url, '#/'), p_tag
  from public.players p
  where p.group_id = p_group and p.active
    and (p_only is null or p.id = any(p_only))
    and p.id is distinct from p_except
    and exists (select 1 from public.push_subs s where s.player_id = p.id)
  on conflict (player_id, tag) do nothing;
$$;

-- Someone new in the group (joined with the link, picked a name the admin added, or was let in):
-- the others are asked to rate him, the way the group rates.
create or replace function private.push_joined()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  g record;
  v_he boolean;
  v_body text;
  v_url text;
begin
  if new.claimed_at is null or not new.active or (tg_op = 'UPDATE' and old.claimed_at is not null) then
    return null;
  end if;
  begin
    select x.id, x.name, coalesce(x.options->>'rating', 'peers') as rating, coalesce(x.options->>'lang', 'he') as lang
    into g from public.groups x where x.id = new.group_id;
    v_he := g.lang <> 'en';
    v_body := case when v_he then 'הצטרפות חדשה: ' || new.name || ' 👋' else new.name || ' just joined 👋' end;
    v_body := v_body || case g.rating
      when 'peers' then case when v_he then ' זה הזמן לעדכן את הסידור.' else ' Time to update your ranking.' end
      when 'attrs' then case when v_he then ' זה הזמן לתת ציונים.' else ' Time to rate them.' end
      when 'admin' then case when v_he then ' זה הזמן לתת כוכבים.' else ' Time to give them stars.' end
      else '' end;
    v_url := case g.rating when 'peers' then '#/place' when 'attrs' then '#/rate' when 'admin' then '#/admin' else '#/' end;
    perform private.queue_push(g.id, 'joined:' || new.id::text, g.name, v_body, v_url,
      case when g.rating = 'admin' then array(select p.id from public.players p where p.group_id = g.id and p.is_admin) end,
      new.id);
  exception when others then
    null; -- a notification must never stop someone from joining
  end;
  return null;
end $$;

drop trigger if exists players_push_joined on public.players;
create trigger players_push_joined after insert or update of claimed_at on public.players
  for each row execute function private.push_joined();

-- The day before each game (24 to 20 hours before kickoff, Israel time): who signed up and how many
-- are missing, to everyone with notifications on (each sees whether they are in). Not for cancelled weeks.
create or replace function private.queue_reminders(p_now timestamptz default now())
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'Asia/Jerusalem';
  g record;
  v_day date;
  v_kick timestamp;
  v_night uuid;
  v_in uuid[];
  v_n int;
  v_need int;
  v_he boolean;
  v_title text;
begin
  for g in
    select x.id, x.name, x.weekday, x.kickoff, x.team_size, coalesce(x.options->>'lang', 'he') as lang
    from public.groups x
    where exists (select 1 from public.players p join public.push_subs s on s.player_id = p.id where p.group_id = x.id and p.active)
  loop
    v_day := v_local::date + ((g.weekday - extract(dow from v_local)::int + 7) % 7);
    v_kick := v_day + g.kickoff::time;
    if v_local < v_kick - interval '24 hours' or v_local >= v_kick - interval '20 hours' then
      v_day := v_day + 7; -- maybe the game is tomorrow and today is game day too: check next week's
      v_kick := v_day + g.kickoff::time;
      continue when v_local < v_kick - interval '24 hours' or v_local >= v_kick - interval '20 hours';
    end if;
    select n.id into v_night from public.nights n where n.group_id = g.id and n.day = v_day;
    continue when exists (select 1 from public.nights n where n.id = v_night and n.cancelled);
    v_in := array(select a.player_id from public.attendance a where a.night_id = v_night);
    v_n := coalesce(array_length(v_in, 1), 0);
    v_need := greatest(0, 2 * g.team_size - v_n);
    v_he := g.lang <> 'en';
    v_title := g.name || case when v_he then ' · מחר ב-' else ' · tomorrow at ' end || g.kickoff;
    perform private.queue_push(g.id, 'remind:' || v_day::text, v_title,
      case when v_he then 'יש לך מקום ✓ רשומים ' || v_n || case when v_need > 0 then ', חסרים עוד ' || v_need else ', יש משחק!' end
           else 'You''re in ✓ ' || v_n || ' signed up' || case when v_need > 0 then ', ' || v_need || ' more needed' else ', game on!' end end,
      '#/', v_in);
    perform private.queue_push(g.id, 'remind:' || v_day::text, v_title,
      case when v_he then 'רשומים ' || v_n || case when v_need > 0 then ', חסרים עוד ' || v_need else '' end || '. לחיצה להרשמה'
           else v_n || ' signed up' || case when v_need > 0 then ', ' || v_need || ' more needed' else '' end || '. Tap to sign up' end,
      '#/', array(select p.id from public.players p where p.group_id = g.id and p.active and not (p.id = any(v_in))));
  end loop;
end $$;

-- For the sender only (the Edge Function, with the service role): queues the reminders that are due,
-- then hands out what waits (each message once; older than a day is dropped) with every phone to send it to.
-- url: the screen to open, with the group (?g=) so a phone in two groups opens the right one.
create or replace function public.push_take(p_limit int default 300)
returns table (id bigint, endpoint text, p256dh text, auth text, title text, body text, url text, tag text)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.queue_reminders();
  delete from public.push_outbox o where o.created_at < now() - interval '14 days';
  return query
  with picked as (
    select o.id from public.push_outbox o
    where o.sent_at is null and o.created_at > now() - interval '1 day'
    order by o.id limit p_limit
    for update skip locked
  ), marked as (
    update public.push_outbox o set sent_at = now() from picked where o.id = picked.id
    returning o.id, o.player_id, o.group_id, o.title, o.body, o.url, o.tag
  )
  select m.id, s.endpoint, s.p256dh, s.auth, m.title, m.body, '/?g=' || m.group_id::text || m.url, m.tag
  from marked m join public.push_subs s on s.player_id = m.player_id;
end $$;

-- Phones the push service says are gone (uninstalled, notifications turned off).
create or replace function public.push_gone(p_endpoints text[])
returns void
language sql security definer set search_path = ''
as $$
  delete from public.push_subs s where s.endpoint = any(p_endpoints);
$$;

-- ───────────── Finding a group (version 9) ─────────────
-- An admin may list the group so people without a group find it by city or pitch, and ask to join.
-- Listed groups show only: name, city, pitch, day and time, team size, a line about the group,
-- how many players, and "looking for players this week". Never players, photos or codes.

alter table public.groups add column if not exists city text;
alter table public.groups add column if not exists about text;
alter table public.groups add column if not exists listed boolean not null default false;
alter table public.groups add column if not exists looking_until date; -- "missing players" until this game day

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_listing_valid' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_listing_valid check (
      (city is null or length(trim(city)) between 1 and 40) and (about is null or length(trim(about)) between 1 and 140));
  end if;
end $$;

-- Someone without a group asks to join a listed one. token: a random secret kept on that phone;
-- it is the only way to see the answer (and the personal code once let in).
create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  token text not null check (length(token) between 16 and 64),
  name text not null check (length(trim(name)) between 1 and 30),
  note text check (note is null or length(note) <= 140),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  player_id uuid references public.players on delete set null,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (group_id, token)
);
alter table public.join_requests enable row level security;
revoke all on public.join_requests from public, anon, authenticated;

-- The day of the group's next game, from today (Israel time).
create or replace function private.next_game_day(p_weekday int)
returns date
language sql stable set search_path = ''
as $$
  select (now() at time zone 'Asia/Jerusalem')::date
         + ((p_weekday - extract(dow from now() at time zone 'Asia/Jerusalem')::int + 7) % 7);
$$;

-- Admins: listed or not, city, the line about the group, and "looking for players this week".
-- Only the keys given change. Returns the listing.
create or replace function public.set_listing(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  update public.groups g set
    listed = case when p ? 'listed' then coalesce((p->>'listed')::boolean, false) else g.listed end,
    city = case when p ? 'city' then nullif(trim(p->>'city'), '') else g.city end,
    about = case when p ? 'about' then nullif(trim(p->>'about'), '') else g.about end,
    looking_until = case when p ? 'looking' then
      case when coalesce((p->>'looking')::boolean, false) then private.next_game_day(g.weekday) end
      else g.looking_until end
  where g.id = public.my_group()
  returning jsonb_build_object('listed', g.listed, 'city', g.city, 'about', g.about, 'looking_until', g.looking_until)
  into v_out;
  return v_out;
exception when check_violation or invalid_text_representation then
  raise exception 'invalid listing';
end $$;

-- Anyone: the listed groups, those looking for players first. p_query matches the city, the pitch or the name.
create or replace function public.find_groups(p_query text default null)
returns table (id uuid, name text, city text, venue text, weekday int, kickoff text, team_size int,
  about text, players int, looking boolean, lang text)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, g.city, g.venue, g.weekday, g.kickoff, g.team_size, g.about,
         (select count(*)::int from public.players p where p.group_id = g.id and p.active and p.claimed_at is not null),
         coalesce(g.looking_until >= (now() at time zone 'Asia/Jerusalem')::date, false),
         coalesce(g.options->>'lang', 'he')
  from public.groups g
  where g.listed
    and (coalesce(trim(p_query), '') = ''
         or concat_ws(' ', g.city, g.venue, g.name) ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by 10 desc, 9 desc, g.name
  limit 50;
$$;

-- Ask to join a listed group (again = update the name and note). The group's admins get a notification.
create or replace function public.request_join(p_group uuid, p_token text, p_name text, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g record;
  v_name text := trim(coalesce(p_name, ''));
  v_old text;
begin
  select x.id, x.name, coalesce(x.options->>'lang', 'he') as lang into g from public.groups x where x.id = p_group and x.listed;
  if g.id is null then
    raise exception 'not listed';
  end if;
  if length(v_name) = 0 or length(v_name) > 30 then
    raise exception 'name required';
  end if;
  if coalesce(length(p_token), 0) not between 16 and 64 then
    raise exception 'invalid token';
  end if;
  perform pg_advisory_xact_lock(hashtext('request:' || p_group::text));
  select r.status into v_old from public.join_requests r where r.group_id = p_group and r.token = p_token;
  if v_old = 'approved' then
    raise exception 'already in';
  elsif v_old = 'declined' then
    raise exception 'declined';
  end if;
  if v_old is null and (
       (select count(*) from public.join_requests r where r.group_id = p_group and r.status = 'pending') >= 30
       or (select count(*) from public.join_requests r where r.token = p_token and r.status = 'pending') >= 5) then
    raise exception 'too many requests';
  end if;
  insert into public.join_requests (group_id, token, name, note) values (p_group, p_token, v_name, nullif(trim(p_note), ''))
  on conflict (group_id, token) do update set name = excluded.name, note = excluded.note;
  if v_old is null then
    perform private.queue_push(g.id, 'request:' || p_token, g.name,
      case when g.lang <> 'en' then 'בקשת הצטרפות: ' || v_name else 'Join request: ' || v_name end, '#/admin',
      array(select p.id from public.players p where p.group_id = g.id and p.is_admin));
  end if;
end $$;

-- This phone's requests (last 30 days) and, once let in, the personal code.
create or replace function public.my_requests(p_token text)
returns table (id uuid, group_id uuid, group_name text, status text, code text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.group_id, g.name, r.status,
         (select c.code from public.player_codes c join public.players p on p.id = c.player_id and p.active
          where c.player_id = r.player_id and r.status = 'approved'),
         r.created_at
  from public.join_requests r join public.groups g on g.id = r.group_id
  where r.token = p_token and length(p_token) >= 16 and r.created_at > now() - interval '30 days'
  order by r.created_at desc;
$$;

create or replace function public.cancel_request(p_token text, p_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.join_requests r where r.id = p_id and r.token = p_token and r.status = 'pending';
$$;

-- Admins: the requests waiting in their group.
create or replace function public.admin_requests()
returns table (id uuid, name text, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return query select r.id, r.name, r.note, r.created_at from public.join_requests r
  where r.group_id = public.my_group() and r.status = 'pending' order by r.created_at;
end $$;

-- Admins let someone in (as a new player, under p_name if given) or say no.
create or replace function public.answer_request(p_id uuid, p_ok boolean, p_name text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.join_requests;
  v_name text;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  select * into r from public.join_requests x where x.id = p_id and x.group_id = public.my_group() and x.status = 'pending' for update;
  if r.id is null then
    raise exception 'not found';
  end if;
  if not p_ok then
    update public.join_requests set status = 'declined', answered_at = now() where id = r.id;
    return;
  end if;
  v_name := trim(coalesce(nullif(trim(p_name), ''), r.name));
  if length(v_name) > 30 then
    raise exception 'name required';
  end if;
  perform pg_advisory_xact_lock(hashtext('join:' || r.group_id::text));
  if exists (select 1 from public.players p where p.group_id = r.group_id and p.active and lower(trim(p.name)) = lower(v_name)) then
    raise exception 'name taken';
  end if;
  if (select count(*) from public.players p where p.group_id = r.group_id) >= 150 then
    raise exception 'too many players';
  end if;
  insert into public.players (group_id, name, claimed_at) values (r.group_id, v_name, now()) returning id into v_id;
  update public.join_requests set status = 'approved', answered_at = now(), player_id = v_id where id = r.id;
end $$;

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
    'public.vote_mvp(text, uuid, uuid)', 'public.mvp_tally()', 'public.my_mvp_votes(text)',
    'public.set_options(jsonb)', 'public.admin_stars()', 'public.set_stars(uuid, int)',
    'public.quick_roster(text, date)', 'public.quick_signup(text, uuid, date, boolean)',
    'public.rate_attr(text, uuid, text, int)', 'public.my_attr_ratings(text)', 'public.attr_cards()', 'public.attr_rating_status()',
    'public.save_push(text, text, text, text)', 'public.drop_push(text, text)', 'public.has_push(text, text)',
    'public.set_listing(jsonb)', 'public.find_groups(text)', 'public.request_join(uuid, text, text, text)',
    'public.my_requests(text)', 'public.cancel_request(text, uuid)', 'public.admin_requests()', 'public.answer_request(uuid, boolean, text)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  -- Trigger functions: never called directly.
  foreach f in array array['public.give_player_code()', 'public.guard_night_cancel()', 'public.guard_match_delete()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  -- The notification sender only (Supabase's service role; not there in the tests).
  foreach f in array array['public.push_take(int)', 'public.push_gone(text[])'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
