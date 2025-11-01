-- Enable pg_cron for scheduled cleanup (idempotent)
create extension if not exists pg_cron;

-- Function to hard-delete expired stories and their related rows
create or replace function public.purge_expired_stories()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove dependent rows first in case some FKs were created without ON DELETE CASCADE
  delete from public.story_comments
  where story_id in (select id from public.stories where expires_at <= now());

  delete from public.story_views
  where story_id in (select id from public.stories where expires_at <= now());

  -- If you have story_likes, purge them too (only if the table exists)
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'story_likes'
  ) then
    delete from public.story_likes
    where story_id in (select id from public.stories where expires_at <= now());
  end if;

  -- Finally, delete the expired stories themselves
  delete from public.stories where expires_at <= now();
end;
$$;

-- Schedule hourly cleanup (idempotent):
do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'purge_expired_stories_hourly'
  ) then
    perform cron.schedule('purge_expired_stories_hourly', '@hourly', 'select public.purge_expired_stories();');
  end if;
end
$$;


