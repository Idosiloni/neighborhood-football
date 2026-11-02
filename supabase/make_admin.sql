-- One time, right after running schema.sql version 3 on the database that already had players:
-- everyone moved into one group, which has no admin yet. Put your own player name below and run.
-- The result is your personal link: the old email login is gone, and this link is now what makes
-- you the admin. Open it on your phone and keep it somewhere safe (also in "אני" → "הקישור האישי שלך").
with me as (
  update public.players
  set is_admin = true
  where active and name = 'השם-שלך-כמו-באפליקציה'
    and group_id = (select id from public.groups order by created_at limit 1)
  returning id, name
)
select me.name, 'https://neighborhood-football.vercel.app/#/v/' || c.code as my_link
from me join public.player_codes c on c.player_id = me.id;
