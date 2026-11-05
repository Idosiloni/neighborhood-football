-- Phone notifications, once per Supabase project (after schema.sql version 9 and deploying the
-- "push" function with --no-verify-jwt). Replace PROJECT_REF with the project's ref first.
-- Every 5 minutes the database calls the function, which queues the day-before reminders that are
-- due and sends whatever waits. Calling it needs no key: it can only send what is already queued.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'push-notifications',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://PROJECT_REF.supabase.co/functions/v1/push',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb) $$
);

select jobname, schedule, active from cron.job where jobname = 'push-notifications';
