-- Moderator access to call recordings and the 90-day retention of calls (CLAUDE.md, docs/calls.md).

-- True while one of the two users has an open (unresolved) report about the other. Such calls are
-- evidence: moderators may open their recordings, and retention keeps them until the case closes.
create function public.call_under_open_report(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reports r
    where r.resolved_at is null
      and r.target_type = 'user'
      and ((r.target_id = a and r.reporter_id = b) or (r.target_id = b and r.reporter_id = a))
  );
$$;

-- Called by the admin panel (service role) right before it signs a short-lived URL: checks the
-- moderator and the open report, logs the access in moderation_actions, returns the object path.
create function public.admin_open_call_recording(p_admin uuid, p_call uuid, p_reason text default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  c public.calls;
begin
  perform public.assert_admin(p_admin);
  select * into c from public.calls where id = p_call;
  if not found or c.recording_path is null or c.recording_status <> 'ready' then
    raise exception 'No recording for this call' using errcode = 'no_data_found';
  end if;
  if not public.call_under_open_report(c.caller_id, c.callee_id) then
    raise exception 'Recordings can only be opened while handling an open report'
      using errcode = 'insufficient_privilege';
  end if;
  perform public.log_moderation(p_admin, 'call.recording_open', 'call', p_call, p_reason);
  return c.recording_path;
end;
$$;

-- Recordings past 90 days that are not evidence in an open case. The purge job
-- (POST /api/calls/purge) deletes the objects, then marks the rows with mark_call_recordings_purged.
-- The bucket lifecycle rule is the backstop if the job stops (docs/calls.md).
create function public.call_recordings_to_purge(p_limit int default 200)
returns table (call_id uuid, recording_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.recording_path
  from public.calls c
  where c.recording_path is not null
    and coalesce(c.ended_at, c.started_at) < now() - interval '90 days'
    and not public.call_under_open_report(c.caller_id, c.callee_id)
  order by c.started_at
  limit least(greatest(p_limit, 1), 1000);
$$;

create function public.mark_call_recordings_purged(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.calls
  set recording_path = null, recording_status = 'purged', egress_id = null
  where id = any(p_ids) and recording_path is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Deletes call history rows older than 90 days whose recording is already gone, except evidence.
create function public.purge_old_calls()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.expire_stale_calls();
  delete from public.calls c
  where coalesce(c.ended_at, c.started_at) < now() - interval '90 days'
    and c.recording_path is null
    and c.status not in ('ringing', 'active')
    and not public.call_under_open_report(c.caller_id, c.callee_id);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.call_under_open_report(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_open_call_recording(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.call_recordings_to_purge(int) from public, anon, authenticated;
revoke execute on function public.mark_call_recordings_purged(uuid[]) from public, anon, authenticated;
revoke execute on function public.purge_old_calls() from public, anon, authenticated;
grant execute on function public.admin_open_call_recording(uuid, uuid, text) to service_role;
grant execute on function public.call_recordings_to_purge(int) to service_role;
grant execute on function public.mark_call_recordings_purged(uuid[]) to service_role;
grant execute on function public.purge_old_calls() to service_role;

-- Daily at 03:47 Malaysia time (19:47 UTC), only where pg_cron exists (see 20261008000022).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-old-calls', '47 19 * * *', 'select public.purge_old_calls()');
  end if;
end;
$$;
