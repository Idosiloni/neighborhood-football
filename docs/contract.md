# Data contract (schema version 7: group options, match rules, draws, levels, seasons)

The browser app (src/data/supabaseApi.js) and the database (supabase/schema.sql) must agree on this.
The demo (src/data/mockApi.js) mirrors it in localStorage. Tests: tests/sql.test.js (PGlite).

## Who is calling

There are no accounts. Every request may carry header `x-player-code` with a player's personal code
(8 hex chars, globally unique). From it the database derives:

- `public.my_player_id()`: the active player with that code (null if none).
- `public.my_group()`: his group (null if none). **Every read and write is limited to this group.**
- `public.is_member()`: `my_group() is not null`.
- `public.is_admin()`: that player is active and `is_admin`. The player who opens a group is its admin;
  admins can make other players admins. A group always keeps at least one active admin (trigger).

A phone in several groups keeps one code per group (`localStorage['my-groups']`) and sends the open
group's code (`localStorage['my-player-code']`). Supabase Auth and `public.admins` are no longer used.

## Tables (all have RLS; grants are explicit)

```
groups       id, name (1–40), join_code unique (6 chars a-z/2-9 without look-alikes; older groups may have 4 digits),
             weekday 0–6, kickoff 'H:MM', venue (≤ 60), team_size 3–11 (6), match_minutes 2–45 (7),
             win_goals 0–10 (3; 0 = time only), created_at,
             options jsonb ({}): the group's other settings, one object with known keys only, checked by
             trigger groups_check_options → private.options_valid (same rules: src/lib/options.js).
             Keys: lang 'he'|'en'; format 'rounds'|'game'; periods 1–4; break_minutes 0–30; extra_minutes 0–10;
             tie 'extra'|'penalties'|'draw'; team_a / team_b bib colors (blue, orange, red, white, black,
             yellow, green, purple; never the same); rating 'peers'|'admin'|'none'; mvp, assists, quick_signup (true/false). Numbers must be whole numbers. New settings go here, not as columns.
             match_minutes 2–120 (the length of one period).
players      + group_id → groups (default my_group(), never changes), is_admin bool,
             nickname, claimed_at, photo ≤ 300000 chars, positions text[] ⊆ {gk,def,mid,att},
             photo_v (generated: changes with the photo; the app lists players without photo
             and fetches each photo once per phone by id + photo_v)
player_codes player_id, code
ballots      voter_id, ranking uuid[]                         -- no access; functions only
nights       + group_id (default my_group()), unique (group_id, day), cancelled
attendance   + group_id (set by trigger from the night)
matches      (match_minutes, win_goals and rules {periods, break_minutes, extra_minutes, tie}: copied from the group
             when the match starts, never changed after; rules null = from before: one period, 2 min extra time, golden goal)
             + group_id (set by trigger from the night), period 1–4, break_since (half-time started),
             phase regular|break|extra|golden|penalties, winner a|b|draw
goals        + group_id (set by trigger from the match)
mvp_votes    match_id, voter_id, player_id                     -- no access; functions only
```

A trigger refuses attendance/matches/goals that mention a player of another group.

| table | select | insert/update/delete |
|---|---|---|
| groups | members of that group | update (name, weekday, kickoff, rules, venue, options) by its admins |
| players | members of that group | admins of that group (insert/update limited to profile columns + is_admin, claimed_at) |
| player_codes | admins of that group | update (code) by its admins |
| nights, attendance, matches, goals | members of that group | members of that group; cancelling a night: admins only |
| admins, ballots, mvp_votes | nobody | nobody |

## Live updates

No table is in the `supabase_realtime` publication (RLS by header can't be checked there).
Instead, a trigger on players/nights/attendance/matches/goals calls
`realtime.send({table}, 'change', 'g:<group id>', private => false)`: a content-free ping.
Phones listen on channel `g:<group id>` (broadcast, event `change`) and reload.

## Functions (all `security definer set search_path = ''`, executable by anon and authenticated)

- `schema_version()` → 7 (6: no seasons; 5: no levels/stars/one-tap; 4: no match rules or draws; 3: no `options`).
- `seasons` (id, group_id, name 1–30, starts_on, unique per group and day): members read, admins insert/update (name,
  starts_on)/delete. A season runs from its start day until the next one starts; games before the first are "earlier".
- Reading history: the API returns at most 1000 rows per request, so the app reads it page by page (`allRows`).
- `set_options(p_patch jsonb) → jsonb` — admins only. Merges the patch into the group's options (null = remove the key,
  back to the default) and keeps every other key. Use this, never a whole-object update.
- `admin_stars()` / `set_stars(p_player, p_stars)` — admins only: 1–5 stars per player (null removes), in `coach_ratings`
  (no table access for anyone). With options.rating = 'admin' they drive make_teams/suggest_rotation ((stars−1)×25, 50 if
  unrated); 'none' = everyone 50.
- `quick_roster(p_join, p_day) → jsonb` / `quick_signup(p_join, p_player, p_day, p_coming)` — anyone with the join code,
  only when options.quick_signup is on, only for the group's game day from yesterday to 8 days ahead (server date).
  Roster: `{id, name, weekday, kickoff, team_size, options, cancelled, players: [{id, name, emoji}], coming: [ids]}`.
- `create_group(p_group, p_name, p_emoji, p_photo, p_position, p_can_gk, p_nickname, p_positions, p_settings jsonb) → text` —
  new group with a new join code; the caller becomes its first player, admin and claimed. Returns his personal code.
  p_settings (all optional): weekday, kickoff, venue, team_size, match_minutes, win_goals, options (object).
  Errors: `group name required`, `name required`, `invalid settings`.
- `group_preview(p_join) → jsonb` — `{id, name, weekday, kickoff, venue, lang, open: [{id, name, emoji, photo}]}`
  (active, unclaimed players), or null.
- `join_team(p_join, p_name, …profile) → text` — errors in order: `invalid join code`, `name required`,
  `name taken` (active player of that group, case/space-insensitive), `too many players` (150 per group).
- `claim_player(p_join, p_player, …profile) → text` — only an active unclaimed player of that join code's group,
  else `already claimed`.
- `new_join_code() → text` — admins only; replaces the group's join code.
- `voter_by_code(p_code)` → `player_id, name, ranking, group_id, group_name, is_admin`.
- `submit_ballot(p_code, p_ranking)` — keeps only active players of the voter's group, not himself, no duplicates.
- `update_my_profile(p_code, …profile, p_positions, p_keep_photo default false)` — own emoji, photo, position,
  can_gk, positions, nickname only. p_keep_photo = leave the photo as it is.
- `admin_ratings()` — admins only, ranking of their group (0–100 score per active player).
- `make_teams(p_night, p_bench)` / `suggest_rotation(p_match)` (also returns `stays`: 'a'|'b'; after a draw the team on
  longer goes off, level = A stays) — night/match must be in the caller's group,
  else `not allowed`. Algorithms = `splitTeams` / `suggestRotation` in src/lib/teams.js; ratings from the
  group's ballots only (50 without votes).
- `vote_mvp(p_code, p_match, p_player)`, `mvp_tally()` (caller's group), `my_mvp_votes(p_code)`.

Profile field rules (create_group, join_team, claim_player, update_my_profile): `emoji` blank → keep
(`'⚽'` new); `position` null → keep (`'any'` new); `can_gk = coalesce(p_can_gk, false) or position = 'gk'`;
`nickname` trimmed, empty → null.

## Upgrading a version 2 database

Running schema.sql moves every row without a group into one new group named "כדורגל שכונה", keeping the old
join code and weekly schedule, then drops `settings` and `schedule`. That group has no admin until
supabase/make_admin.sql is run with the owner's player name.
