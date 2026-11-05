-- A test group for trying things on the real app: 14 made-up players, "advanced" level
-- (rating by categories), and three past game days with results, goals and MVP votes.
-- Its first player (the admin) is the only real phone in it; the others are made up.
-- Adds rows to a new group only; nothing else is touched. Stops if the group is already there.
-- Prints the admin's personal code at the end (link: <site>/#/v/<code>).

do $$
declare
  v_group uuid;
  v_me uuid;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_night uuid;
  v_match uuid;
  v_day date;
  v_present uuid[];
  v_order uuid[];
  v_a uuid[];
  v_b uuid[];
  v_ga int;
  v_gb int;
  v_side text;
  v_team uuid[];
  v_scorer uuid;
  v_assist uuid;
  v_start timestamptz;
  v_at int;
  v_top uuid;
  v_names text[] := array['סילוני', 'אבי', 'בני', 'גיא', 'דור', 'הראל', 'יואב', 'כפיר', 'ליאור', 'מתן', 'נועם', 'עידן', 'רון', 'שחר'];
  v_pos text[] := array['mid,att', 'def', 'att', 'mid', 'def,mid', 'att', 'gk', 'def', 'mid,att', 'def', 'att', 'mid', 'gk,def', 'mid'];
  v_emoji text[] := array['⚽', '🦁', '🚀', '🎯', '🧱', '⚡', '🧤', '🐂', '🎩', '🛡️', '🔥', '🌀', '🦸', '🐆'];
begin
  if exists (select 1 from public.groups g where g.name = 'קבוצת בדיקות') then
    raise exception 'the test group is already there';
  end if;

  insert into public.groups (name, join_code, weekday, kickoff, team_size, match_minutes, win_goals, venue, options)
  values ('קבוצת בדיקות', private.new_join_code(), 4, '21:00', 6, 7, 3, 'מגרש הבדיקות', '{"lang": "he", "rating": "attrs"}')
  returning id into v_group;

  for i in 1 .. array_length(v_names, 1) loop
    insert into public.players (group_id, name, emoji, positions, claimed_at, is_admin)
    values (v_group, v_names[i], v_emoji[i], string_to_array(v_pos[i], ','), now(), i = 1)
    returning id into v_id;
    v_ids := v_ids || v_id;
    if i = 1 then v_me := v_id; end if;
  end loop;

  foreach v_day in array array['2026-10-15', '2026-10-22', '2026-10-29']::date[] loop
    insert into public.nights (group_id, day) values (v_group, v_day) returning id into v_night;
    -- 12 to 14 of them came; the admin always.
    v_order := array(select x from unnest(v_ids[2:]) x order by random());
    v_present := v_me || v_order[1 : 11 + floor(random() * 3)::int];
    for i in 1 .. array_length(v_present, 1) loop
      insert into public.attendance (night_id, player_id, arrived_at)
      values (v_night, v_present[i], (v_day + time '20:40') at time zone 'Asia/Jerusalem' + i * interval '40 seconds');
    end loop;

    for num in 1 .. 4 + floor(random() * 2)::int loop
      v_order := array(select x from unnest(v_present) x order by random());
      v_a := v_order[1:6];
      v_b := v_order[7:12];
      v_start := (v_day + time '21:00') at time zone 'Asia/Jerusalem' + (num - 1) * interval '12 minutes';
      insert into public.matches (night_id, num, team_a, team_b, bench, status, phase, clock_ms, winner, created_at, ended_at)
      values (v_night, num, v_a, v_b, coalesce(v_order[13:], '{}'), 'finished', 'regular', 0, null, v_start, v_start + interval '10 minutes')
      returning id into v_match;

      -- First to 3.
      v_ga := 0; v_gb := 0; v_at := 0;
      while v_ga < 3 and v_gb < 3 loop
        v_side := case when random() < 0.5 then 'a' else 'b' end;
        v_team := case when v_side = 'a' then v_a else v_b end;
        -- Goalkeepers only now and then.
        v_scorer := (select x from unnest(v_team) x join public.players p on p.id = x
                     order by random() * case when p.positions = '{gk}' then 8 else 1 end limit 1);
        v_assist := case when random() < 0.6 then (select x from unnest(v_team) x where x <> v_scorer order by random() limit 1) end;
        v_at := v_at + 30000 + floor(random() * 90000)::int;
        insert into public.goals (match_id, team, scorer, assist, at_ms, created_at)
        values (v_match, v_side, v_scorer, v_assist, v_at, v_start + v_at * interval '1 millisecond');
        if v_side = 'a' then v_ga := v_ga + 1; else v_gb := v_gb + 1; end if;
      end loop;
      update public.matches set winner = case when v_ga > v_gb then 'a' else 'b' end, clock_ms = v_at where id = v_match;

      -- A few votes for the winners' top scorer.
      select g.scorer into v_top from public.goals g
      where g.match_id = v_match and g.team = (case when v_ga > v_gb then 'a' else 'b' end) and g.scorer is not null
      group by g.scorer order by count(*) desc, random() limit 1;
      insert into public.mvp_votes (match_id, voter_id, player_id)
      select v_match, x, v_top from unnest(v_order[1:12]) x where x <> v_top order by random() limit 4;
    end loop;
  end loop;

  raise notice 'admin code: %', (select c.code from public.player_codes c where c.player_id = v_me);
end $$;

select c.code as admin_code
from public.player_codes c
join public.players p on p.id = c.player_id
join public.groups g on g.id = p.group_id
where g.name = 'קבוצת בדיקות' and p.is_admin;
