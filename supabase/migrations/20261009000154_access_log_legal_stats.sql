-- Read-access logging, evidence hold, legal exports and panel statistics (batch-4, admin sanctions).

-- ---------------------------------------------------------------------------------------------
-- Read-access logging (CLAUDE.md: every access to private material is logged in
-- moderation_actions). The panel calls this right before it shows selfies or transcripts, or
-- exports the audit log. One row per target.
create function public.admin_log_access(
  p_admin uuid, p_action text, p_type text, p_targets uuid[], p_reason text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_action not in ('view.selfie', 'view.phone', 'view.transcript', 'export.audit_log') then
    raise exception 'Unknown access action %', p_action using errcode = 'check_violation';
  end if;
  perform public.assert_admin_role(p_admin,
    case p_action
      when 'export.audit_log' then 'admin'
      when 'view.selfie' then 'viewer'
      else 'moderator'
    end::public.admin_role);
  insert into public.moderation_actions (admin_id, action, target_type, target_id, reason)
  select p_admin, p_action, p_type, t, nullif(btrim(p_reason), '')
  from (select distinct unnest(p_targets) as t) x
  where t is not null;
end;
$$;

-- A user's phone number for the panel (moderator), logged as view.phone.
create function public.admin_get_phone(p_admin uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ph text;
begin
  perform public.admin_log_access(p_admin, 'view.phone', 'user', array[p_user], null);
  select phone into ph from auth.users where id = p_user;
  return ph;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Evidence hold: while set, nothing of this user is removed by the 90-day retention (legal
-- request, police case). Set and released by an admin; both logged.
alter table public.profiles
  add column evidence_hold_at     timestamptz,
  add column evidence_hold_reason text check (char_length(evidence_hold_reason) <= 500),
  add column evidence_hold_by     uuid references auth.users (id) on delete set null;

create index profiles_evidence_hold_idx on public.profiles (id) where evidence_hold_at is not null;

create function public.under_evidence_hold(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = p_user and evidence_hold_at is not null);
$$;

create function public.match_under_evidence_hold(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    join public.profiles p on p.id in (m.user_a, m.user_b) and p.evidence_hold_at is not null
    where m.id = p_match
  );
$$;

create function public.admin_set_evidence_hold(p_admin uuid, p_user uuid, p_on boolean, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  if p_on and nullif(btrim(p_reason), '') is null then
    raise exception 'Evidence hold needs a reason (case or request reference)' using errcode = 'check_violation';
  end if;
  update public.profiles
  set evidence_hold_at = case when p_on then coalesce(evidence_hold_at, now()) end,
      evidence_hold_reason = case when p_on then btrim(p_reason) end,
      evidence_hold_by = case when p_on then p_admin end
  where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, case when p_on then 'user.evidence_hold' else 'user.evidence_release' end,
    'user', p_user, p_reason);
end;
$$;

-- Purge functions: newest definitions copied, with the evidence hold added to their conditions.

-- From 20261008000102.
create or replace function public.purge_old_feed_content()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - interval '90 days';
  deleted_comments integer;
  deleted_posts integer;
begin
  delete from public.comments c
  where c.created_at < cutoff
    and not exists (
      select 1 from public.reports r
      where r.resolved_at is null
        and ((r.target_type = 'comment' and r.target_id = c.id)
          or (r.target_type = 'post' and r.target_id = c.post_id))
    )
    and not public.under_evidence_hold(c.author_id)
    and not exists (
      select 1 from public.posts p where p.id = c.post_id and public.under_evidence_hold(p.author_id)
    );
  get diagnostics deleted_comments = row_count;

  delete from public.posts p
  where p.created_at < cutoff
    and not exists (
      select 1 from public.reports r
      where r.resolved_at is null and r.target_type = 'post' and r.target_id = p.id
    )
    and not exists (
      select 1 from public.comments c
      join public.reports r
        on r.resolved_at is null and r.target_type = 'comment' and r.target_id = c.id
      where c.post_id = p.id
    )
    and not public.under_evidence_hold(p.author_id)
    -- A held user's comments would go with the post (cascade).
    and not exists (
      select 1 from public.comments c where c.post_id = p.id and public.under_evidence_hold(c.author_id)
    );
  get diagnostics deleted_posts = row_count;

  return deleted_comments + deleted_posts;
end;
$$;

-- From 20261008000111.
create or replace function public.retention_chat_media(p_limit int default 200)
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
    and not public.match_under_evidence_hold(m.match_id)
  order by m.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- From 20261008000111.
create or replace function public.retention_selfies(p_limit int default 200)
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
    and not exists (
      select 1 from public.profiles p
      where p.evidence_hold_at is not null and p.id::text = split_part(o.name, '/', 1)
    )
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- From 20261008000131.
create or replace function public.retention_message_deletions(p_limit int default 200)
returns table (message_id uuid, media_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.message_id, d.media_path
  from public.message_deletions d
  where d.deleted_at < now() - interval '90 days'
    and not public.match_under_open_report(d.match_id)
    and not exists (
      select 1 from public.reports r
      where r.target_type = 'user' and r.target_id = d.sender_id and r.resolved_at is null
    )
    and not public.match_under_evidence_hold(d.match_id)
    and not public.under_evidence_hold(d.sender_id)
  order by d.deleted_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- From 20261008000112.
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
    )
    and not exists (
      select 1 from public.random_chat_sessions s
      where s.id = m.session_id
        and (public.under_evidence_hold(s.user_a) or public.under_evidence_hold(s.user_b))
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
    )
    and not public.under_evidence_hold(s.user_a)
    and not public.under_evidence_hold(s.user_b);

  return deleted;
end;
$$;

-- From 20261008000123.
create or replace function public.call_recordings_to_purge(p_limit int default 200)
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
    and not public.under_evidence_hold(c.caller_id)
    and not public.under_evidence_hold(c.callee_id)
  order by c.started_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- From 20261008000123.
create or replace function public.purge_old_calls()
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
    and not public.call_under_open_report(c.caller_id, c.callee_id)
    and not public.under_evidence_hold(c.caller_id)
    and not public.under_evidence_hold(c.callee_id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Legal export (owner only): everything Vibely holds about one user, for a legal request. Message
-- and random chat contents are not included (metadata only); call recordings are referenced by
-- status, not by path. A request reference is required and logged.
create function public.admin_export_user(p_admin uuid, p_user uuid, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform public.assert_admin_role(p_admin, 'owner');
  if char_length(btrim(coalesce(p_reference, ''))) not between 3 and 200 then
    raise exception 'Request reference required (3..200 characters)' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'request_reference', btrim(p_reference),
    'user_id', p_user,
    'account', (select jsonb_build_object('phone', u.phone) from auth.users u where u.id = p_user),
    'profile', (select to_jsonb(p) - 'location' from public.profiles p where p.id = p_user),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.storage_path,
        'position', f.position, 'created_at', f.created_at) order by f.position)
      from public.profile_photos f where f.profile_id = p_user), '[]'),
    'verifications', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'status', v.status,
        'challenge', v.challenge, 'rejection_reason', v.rejection_reason, 'created_at', v.created_at,
        'reviewed_at', v.reviewed_at) order by v.created_at)
      from public.verification_requests v where v.user_id = p_user), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type,
        'target_id', r.target_id, 'reason', r.reason, 'created_at', r.created_at,
        'resolved_at', r.resolved_at, 'resolution', r.resolution) order by r.created_at)
      from public.reports r where r.reporter_id = p_user), '[]'),
    'reports_against', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type,
        'target_id', r.target_id, 'reporter_id', r.reporter_id, 'reason', r.reason,
        'created_at', r.created_at, 'resolved_at', r.resolved_at, 'resolution', r.resolution)
        order by r.created_at)
      from public.reports r
      where (r.target_type = 'user' and r.target_id = p_user)
         or (r.target_type = 'post' and r.target_id in (select id from public.posts where author_id = p_user))
         or (r.target_type = 'comment' and r.target_id in (select id from public.comments where author_id = p_user))
         or (r.target_type = 'random_session' and r.target_id in (
              select id from public.random_chat_sessions where p_user in (user_a, user_b)))), '[]'),
    'sanctions', jsonb_build_object(
      'warnings', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at)
        from public.user_warnings w where w.user_id = p_user), '[]'),
      'appeals', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at)
        from public.appeals a where a.user_id = p_user), '[]'),
      'phone_blocklist', coalesce((select jsonb_agg(jsonb_build_object('phone', b.phone,
          'reason', b.reason, 'created_at', b.created_at))
        from public.phone_blocklist b where b.user_id = p_user), '[]'),
      'moderation_actions', coalesce((select jsonb_agg(jsonb_build_object('action', m.action,
          'admin_id', m.admin_id, 'reason', m.reason, 'created_at', m.created_at) order by m.created_at)
        from public.moderation_actions m where m.target_id = p_user), '[]'),
      'notes', coalesce((select jsonb_agg(jsonb_build_object('author_id', n.author_id, 'body', n.body,
          'created_at', n.created_at) order by n.created_at)
        from public.user_notes n where n.user_id = p_user), '[]')
    ),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body,
        'is_hidden', p.is_hidden, 'created_at', p.created_at) order by p.created_at)
      from public.posts p where p.author_id = p_user), '[]'),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'post_id', c.post_id,
        'body', c.body, 'is_hidden', c.is_hidden, 'created_at', c.created_at) order by c.created_at)
      from public.comments c where c.author_id = p_user), '[]'),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'user_a', m.user_a,
        'user_b', m.user_b, 'source', m.source, 'created_at', m.created_at) order by m.created_at)
      from public.matches m where p_user in (m.user_a, m.user_b)), '[]'),
    'messages_metadata', coalesce((select jsonb_agg(jsonb_build_object('id', m.id,
        'match_id', m.match_id, 'sender_id', m.sender_id, 'created_at', m.created_at,
        'media_kind', m.media_kind, 'edited_at', m.edited_at, 'deleted_at', m.deleted_at,
        'read_at', m.read_at) order by m.created_at)
      from public.messages m
      join public.matches mt on mt.id = m.match_id
      where p_user in (mt.user_a, mt.user_b)), '[]'),
    'random_chats_metadata', coalesce((select jsonb_agg(jsonb_build_object('id', s.id,
        'user_a', s.user_a, 'user_b', s.user_b, 'status', s.status, 'started_at', s.started_at,
        'ended_at', s.ended_at,
        'messages', (select count(*) from public.random_chat_messages rm where rm.session_id = s.id))
        order by s.started_at)
      from public.random_chat_sessions s where p_user in (s.user_a, s.user_b)), '[]'),
    'calls_metadata', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'match_id', c.match_id,
        'caller_id', c.caller_id, 'callee_id', c.callee_id, 'kind', c.kind, 'status', c.status,
        'started_at', c.started_at, 'answered_at', c.answered_at, 'ended_at', c.ended_at,
        'recording_status', c.recording_status) order by c.started_at)
      from public.calls c where p_user in (c.caller_id, c.callee_id)), '[]')
  ) into out;

  perform public.log_moderation(p_admin, 'legal.export', 'user', p_user, btrim(p_reference));
  return out;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Statistics for /admin (viewer): daily trends for the last p_days days (Malaysia time), the
-- median time to resolve a report, and per-moderator throughput.
create function public.admin_stats(p_admin uuid, p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  days int := least(90, greatest(1, coalesce(p_days, 7)));
  tz text := 'Asia/Kuala_Lumpur';
  since timestamptz;
  out jsonb;
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  since := ((now() at time zone tz)::date - (days - 1))::timestamp at time zone tz;

  with d as (
    select generate_series((now() at time zone tz)::date - (days - 1), (now() at time zone tz)::date,
      interval '1 day')::date as day
  )
  select jsonb_build_object(
    'days', days,
    'series', (select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'reports_opened', (select count(*) from public.reports r
          where (r.created_at at time zone tz)::date = d.day),
        'reports_resolved', (select count(*) from public.reports r
          where r.resolved_at is not null and (r.resolved_at at time zone tz)::date = d.day),
        'verifications', (select count(*) from public.verification_requests v
          where v.reviewed_at is not null and (v.reviewed_at at time zone tz)::date = d.day),
        'bans', (select count(*) from public.moderation_actions m
          where m.action in ('user.ban', 'user.temp_ban') and (m.created_at at time zone tz)::date = d.day)
      ) order by d.day) from d),
    'median_resolve_hours', (select round((extract(epoch from percentile_cont(0.5) within group (
        order by r.resolved_at - r.created_at)) / 3600)::numeric, 1)
      from public.reports r where r.resolved_at >= since),
    'moderators', coalesce((select jsonb_agg(x order by x.total desc) from (
      select m.admin_id,
        (select p.display_name from public.profiles p where p.id = m.admin_id) as name,
        count(*) filter (where m.action not like 'view.%' and m.action not like 'export.%') as total,
        count(*) filter (where m.action = 'reports.resolve') as reports,
        count(*) filter (where m.action like 'verification.%') as verifications,
        count(*) filter (where m.action in ('user.ban', 'user.temp_ban', 'user.mute', 'user.warn')) as sanctions
      from public.moderation_actions m
      where m.admin_id is not null and m.created_at >= since
      group by m.admin_id
    ) x where x.total > 0), '[]')
  ) into out;
  return out;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_log_access(uuid, text, text, uuid[], text)',
    'admin_get_phone(uuid, uuid)',
    'under_evidence_hold(uuid)',
    'match_under_evidence_hold(uuid)',
    'admin_set_evidence_hold(uuid, uuid, boolean, text)',
    'admin_export_user(uuid, uuid, text)',
    'admin_stats(uuid, int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
