-- Random chat transcripts: 30 → 90 days, in line with the project retention protocol. A session
-- under an open (unresolved) report is kept until the report is resolved; the pg_cron job of
-- 20261008000022 keeps calling this function daily.
create or replace function public.purge_old_random_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.random_chat_messages m
  where m.created_at < now() - interval '90 days'
    and not exists (
      select 1 from public.reports r
      where r.target_type = 'random_session'
        and r.target_id = m.session_id
        and r.resolved_at is null
    );
  get diagnostics deleted = row_count;

  delete from public.random_chat_sessions s
  where s.status = 'ended'
    and coalesce(s.ended_at, s.started_at) < now() - interval '90 days'
    and not exists (
      select 1 from public.reports r
      where r.target_type = 'random_session'
        and r.target_id = s.id
        and r.resolved_at is null
    );

  return deleted;
end;
$$;

revoke execute on function public.purge_old_random_messages() from public, anon, authenticated;
