-- Retention (CLAUDE.md "Safety recording & data retention"): chat media and verification selfies
-- are kept for up to 90 days, longer only while an open report concerns the people involved.
--
-- Storage objects can't be deleted from SQL on Supabase (the Storage API owns the files), so the
-- server job POST /api/cron/retention (daily, .github/workflows/retention.yml) asks these
-- functions what is due, removes the files with the service role and then calls
-- retention_mark_chat_media_expired() for the messages whose file is really gone.
-- All functions are service-role only.

-- True while an unresolved report targets either participant of the match.
create function public.match_under_open_report(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    join public.reports r
      on r.target_type = 'user' and r.target_id in (m.user_a, m.user_b) and r.resolved_at is null
    where m.id = p_match
  );
$$;

-- Live media files older than 90 days, oldest first.
create function public.retention_chat_media(p_limit int default 200)
returns table (message_id uuid, path text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.media_path
  from public.messages m
  where m.media_path is not null
    and m.created_at < now() - interval '90 days'
    and not public.match_under_open_report(m.match_id)
  order by m.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- Turns messages whose file has been removed into "expired" placeholders: kind, duration and size
-- stay, the path and waveform go. Rows whose file still exists are left alone, so a failed
-- removal is simply retried on the next run. Returns the number of messages updated.
create function public.retention_mark_chat_media_expired(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.messages m
  set media_path = null, image_path = null, waveform = null, media_expired_at = now()
  where m.id = any (p_ids)
    and m.media_path is not null
    and m.created_at < now() - interval '90 days'
    and not exists (
      select 1 from storage.objects o where o.bucket_id = 'chat-media' and o.name = m.media_path
    );
  get diagnostics updated = row_count;
  return updated;
end;
$$;

-- chat-media files no message points to (upload whose send failed, unmatched chats), after a day.
create function public.retention_orphan_chat_media(p_limit int default 200)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chat-media'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.messages m where m.media_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- Verification selfies older than 90 days, except for a request still waiting for review and for
-- users under an open report. Objects are "<user id>/<file>".
create function public.retention_selfies(p_limit int default 200)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'selfies'
    and o.created_at < now() - interval '90 days'
    and not exists (
      select 1 from public.verification_requests v
      where v.selfie_path = o.name and v.status = 'pending'
    )
    and not exists (
      select 1 from public.reports r
      where r.target_type = 'user'
        and r.resolved_at is null
        and r.target_id::text = split_part(o.name, '/', 1)
    )
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke execute on function public.match_under_open_report(uuid) from public, anon, authenticated;
revoke execute on function public.retention_chat_media(int) from public, anon, authenticated;
revoke execute on function public.retention_mark_chat_media_expired(uuid[])
  from public, anon, authenticated;
revoke execute on function public.retention_orphan_chat_media(int) from public, anon, authenticated;
revoke execute on function public.retention_selfies(int) from public, anon, authenticated;

grant execute on function public.match_under_open_report(uuid) to service_role;
grant execute on function public.retention_chat_media(int) to service_role;
grant execute on function public.retention_mark_chat_media_expired(uuid[]) to service_role;
grant execute on function public.retention_orphan_chat_media(int) to service_role;
grant execute on function public.retention_selfies(int) to service_role;
