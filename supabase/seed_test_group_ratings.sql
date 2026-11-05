-- Ratings for the test group (seed_test_group.sql): 7 of the made-up players rate everyone by
-- categories and rank everyone, dated last week so the cards already show them.
-- The admin (the real phone) rates nobody: that is left for him to try.
-- Replaces earlier seeded ratings of these 7 voters only.

do $$
declare
  v_group uuid := (select g.id from public.groups g where g.name = 'קבוצת בדיקות');
  v_voters uuid[];
  v_when timestamptz := date_trunc('week', now()) - interval '3 days';
begin
  if v_group is null then
    raise exception 'no test group';
  end if;
  v_voters := array(select p.id from public.players p where p.group_id = v_group and not p.is_admin order by p.name limit 7);

  -- Each player's "true" level per category, 1–5 (goalkeepers: the goalkeeping ones).
  create temp table lvl on commit drop as
  select p.id as player_id, a.attr, 1 + floor(random() * 5)::int as base
  from public.players p
  cross join unnest(array['spd', 'sht', 'pas', 'tec', 'def', 'fit', 'gk_ref', 'gk_han', 'gk_pos', 'gk_dis']) as a(attr)
  where p.group_id = v_group
    and ((a.attr like 'gk_%' and 'gk' = any(p.positions)) or (a.attr not like 'gk_%' and p.positions <> '{gk}'));

  delete from public.attr_ratings r where r.voter_id = any(v_voters);
  insert into public.attr_ratings (voter_id, player_id, group_id, attr, score, updated_at)
  select v, l.player_id, v_group, l.attr, greatest(1, least(5, l.base + floor(random() * 3)::int - 1)), v_when
  from unnest(v_voters) v cross join lvl l
  where l.player_id <> v;

  delete from public.ballots b where b.voter_id = any(v_voters);
  insert into public.ballots (voter_id, ranking, moved, updated_at)
  select v,
         array(select l.player_id from lvl l where l.player_id <> v group by l.player_id order by avg(l.base) + random() desc),
         6, v_when
  from unnest(v_voters) v;
end $$;

select count(*) as ratings from public.attr_ratings r join public.groups g on g.id = r.group_id where g.name = 'קבוצת בדיקות';
