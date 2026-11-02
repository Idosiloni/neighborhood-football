-- Neighborhood football: step 1 (players + peer ranking)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run again: it only creates what is missing and replaces functions.

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
