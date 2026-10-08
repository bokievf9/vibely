-- Random chat retention (see the Privacy Policy): transcripts are kept for 30 days, unless the
-- session was reported, in which case moderators need them as evidence.
create index random_messages_created_idx on public.random_chat_messages (created_at);
create index random_sessions_ended_idx on public.random_chat_sessions (ended_at)
  where status = 'ended';

-- Returns the number of deleted messages. Matches created by a reveal are kept.
create function public.purge_old_random_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.random_chat_messages m
  where m.created_at < now() - interval '30 days'
    and not exists (
      select 1 from public.reports r
      where r.target_type = 'random_session' and r.target_id = m.session_id
    );
  get diagnostics deleted = row_count;

  delete from public.random_chat_sessions s
  where s.status = 'ended'
    and coalesce(s.ended_at, s.started_at) < now() - interval '30 days'
    and not exists (
      select 1 from public.reports r
      where r.target_type = 'random_session' and r.target_id = s.id
    );

  return deleted;
end;
$$;

revoke execute on function public.purge_old_random_messages() from public, anon, authenticated;

-- Daily at 03:17 Malaysia time (19:17 UTC), only where pg_cron is available (Supabase has it,
-- the local test database doesn't). cron.schedule with a job name replaces an existing job.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'purge-old-random-messages',
      '17 19 * * *',
      'select public.purge_old_random_messages()'
    );
  end if;
end;
$$;
