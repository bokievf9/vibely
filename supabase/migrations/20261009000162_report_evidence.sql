-- Evidence for moderators handling a report (CLAUDE.md "Safety recording & data retention"):
-- the chat between the reporter and the reported person, its media, and their call recordings.
--
-- Rules, enforced here and not only in the panel:
--   * only while the report is open (unresolved),
--   * only the conversation of the two parties of that report (reporter and reports.subject_id),
--   * every access is logged in public.moderation_actions with its own action name:
--       evidence.transcript_open, evidence.media_open, call.recording_open (20261008000123).
--
-- Retention: while such a report is open, the purge jobs keep the chat, its media, deleted
-- messages and call recordings of the parties (match_under_open_report, call_under_open_report and
-- retention_message_deletions are extended to the new report targets). Unmatching or blocking
-- deletes the chat; when the pair is under an open report its messages are first copied into the
-- moderation archive (message_deletions, cause = 'unmatched') so the evidence survives.

-- The other participant, so archived rows stay attributable to the pair after the match is gone.
alter table public.message_deletions
  add column recipient_id uuid,
  add column cause text not null default 'deleted' check (cause in ('deleted', 'unmatched'));

update public.message_deletions d
set recipient_id = case when m.user_a = d.sender_id then m.user_b else m.user_a end
from public.matches m
where m.id = d.match_id and d.recipient_id is null;

create index message_deletions_pair_idx on public.message_deletions (sender_id, recipient_id);
create index message_deletions_match_idx on public.message_deletions (match_id);

-- Report types that concern a person (and so the chats and calls of the reporter with them).
-- Posts and comments are anonymous feed content and keep their own retention (20261008000102).
create function public.report_is_personal(t public.report_target)
returns boolean
language sql
immutable
set search_path = ''
as $$ select t in ('user', 'message', 'photo', 'call') $$;

-- Newest definition (was 20261008000111): any open personal report about either participant.
create or replace function public.match_under_open_report(p_match uuid)
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
      on r.resolved_at is null
     and public.report_is_personal(r.target_type)
     and r.subject_id in (m.user_a, m.user_b)
    where m.id = p_match
  );
$$;

-- Newest definition (was 20261008000123): one of the two has an open personal report about the
-- other (a user, message, photo or call report).
create or replace function public.call_under_open_report(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reports r
    where r.resolved_at is null
      and public.report_is_personal(r.target_type)
      and ((r.subject_id = a and r.reporter_id = b) or (r.subject_id = b and r.reporter_id = a))
  );
$$;

-- Newest definition (was 20261008000131): also records the recipient.
create or replace function public.delete_message(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  select id into found_id
  from public.messages
  where id = p_id
    and sender_id = (select auth.uid())
    and deleted_at is null
    and public.is_match_participant(match_id)
  for update;
  if found_id is null then
    raise exception 'message not deletable' using errcode = '42501';
  end if;
  -- Safety protocol (CLAUDE.md): "delete for everyone" hides the message from both participants
  -- right away, but its content stays available to moderators for up to 90 days.
  insert into public.message_deletions
    (message_id, match_id, sender_id, recipient_id, body, media_kind, media_path, media_mime, sent_at)
  select m.id, m.match_id, m.sender_id,
    case when x.user_a = m.sender_id then x.user_b else x.user_a end,
    m.body, m.media_kind, m.media_path, m.media_mime, m.created_at
  from public.messages m
  join public.matches x on x.id = m.match_id
  where m.id = p_id;
  update public.messages
  set body = null, image_path = null, image_width = null, image_height = null,
      media_kind = null, media_path = null, media_mime = null, media_duration_ms = null,
      waveform = null, media_expired_at = null, deleted_at = now()
  where id = p_id;
  -- The file is kept (archived above); nothing for the caller to delete.
  return null;
end;
$$;

-- Unmatch / block deletes the match and (by cascade) its messages. Under an open report (or an
-- evidence hold, 20261009000154) the chat is evidence: archive it first. Messages already deleted for everyone are archived already.
create function public.matches_archive_reported_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.match_under_open_report(old.id) or public.match_under_evidence_hold(old.id) then
    insert into public.message_deletions
      (message_id, match_id, sender_id, recipient_id, body, media_kind, media_path, media_mime,
       sent_at, cause)
    select m.id, m.match_id, m.sender_id,
      case when old.user_a = m.sender_id then old.user_b else old.user_a end,
      m.body, m.media_kind, m.media_path, m.media_mime, m.created_at, 'unmatched'
    from public.messages m
    where m.match_id = old.id and m.deleted_at is null
    on conflict (message_id) do nothing;
  end if;
  return old;
end;
$$;

create trigger matches_archive_reported_chat
  before delete on public.matches
  for each row execute function public.matches_archive_reported_chat();

revoke execute on function public.matches_archive_reported_chat() from public, anon, authenticated;

-- Newest definition (was 20261009000154, which added the evidence hold): kept while the match,
-- the sender or the recipient is under an open personal report or an evidence hold.
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
      where r.resolved_at is null
        and public.report_is_personal(r.target_type)
        and r.subject_id in (d.sender_id, d.recipient_id)
    )
    and not public.match_under_evidence_hold(d.match_id)
    and not public.under_evidence_hold(d.sender_id)
    and (d.recipient_id is null or not public.under_evidence_hold(d.recipient_id))
  order by d.deleted_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- Newest definition (was 20261009000154, which added the evidence hold): any open personal report
-- about the selfie's owner, or an evidence hold.
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
      where r.resolved_at is null
        and public.report_is_personal(r.target_type)
        and r.subject_id::text = split_part(o.name, '/', 1)
    )
    and not exists (
      select 1 from public.profiles p
      where p.evidence_hold_at is not null and p.id::text = split_part(o.name, '/', 1)
    )
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- The reported person of p_reporter's open report on this target, or an error: evidence is only
-- available while that report is open, and only for personal reports.
create function public.evidence_case_subject(
  p_type public.report_target, p_target uuid, p_reporter uuid
)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  subject uuid;
begin
  if not public.report_is_personal(p_type) then
    raise exception 'No chat evidence for this report type' using errcode = 'check_violation';
  end if;
  select r.subject_id into subject from public.reports r
  where r.target_type = p_type and r.target_id = p_target and r.reporter_id = p_reporter
    and r.resolved_at is null and r.subject_id is not null;
  if subject is null then
    raise exception 'Evidence is available only while handling an open report'
      using errcode = 'insufficient_privilege';
  end if;
  return subject;
end;
$$;

-- Every message between the reporter and the reported person: the live chat (deleted-for-everyone
-- messages restored from the archive and marked) plus archived messages of a chat that no longer
-- exists. Message reports: up to p_limit messages around the reported one; otherwise the latest.
-- Media is never returned here, only whether there is a file (open it with admin_open_chat_media).
create function public.admin_open_chat_transcript(
  p_admin    uuid,
  p_type     public.report_target,
  p_target   uuid,
  p_reporter uuid,
  p_limit    int default 300
)
returns table (
  message_id        uuid,
  sender_id         uuid,
  body              text,
  media_kind        text,
  has_media         boolean,
  media_duration_ms int,
  created_at        timestamptz,
  edited_at         timestamptz,
  deleted           boolean,
  unmatched         boolean,
  reported          boolean
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  subject  uuid;
  v_match  uuid;
  anchor   timestamptz;
  half     int := least(greatest(coalesce(p_limit, 300), 2), 300) / 2;
begin
  perform public.assert_admin(p_admin);
  subject := public.evidence_case_subject(p_type, p_target, p_reporter);
  select m.id into v_match from public.matches m
  where m.user_a = least(subject, p_reporter) and m.user_b = greatest(subject, p_reporter);

  if p_type = 'message' then
    select coalesce(
      (select m.created_at from public.messages m where m.id = p_target),
      (select d.sent_at from public.message_deletions d where d.message_id = p_target))
    into anchor;
  end if;

  perform public.log_moderation(p_admin, 'evidence.transcript_open', p_type::text, p_target,
    format('reporter %s, reported %s', p_reporter, subject));

  return query
  with chat as (
    select m.id, m.sender_id, coalesce(d.body, m.body) as body,
      coalesce(d.media_kind, m.media_kind) as media_kind,
      coalesce(d.media_path, m.media_path) is not null as has_media,
      m.media_duration_ms, m.created_at, m.edited_at,
      m.deleted_at is not null as deleted, false as unmatched
    from public.messages m
    left join public.message_deletions d on d.message_id = m.id
    where m.match_id = v_match
    union all
    select d.message_id, d.sender_id, d.body, d.media_kind, d.media_path is not null, null::int,
      d.sent_at, null::timestamptz, d.cause = 'deleted', d.cause = 'unmatched'
    from public.message_deletions d
    where ((d.sender_id = subject and d.recipient_id = p_reporter)
        or (d.sender_id = p_reporter and d.recipient_id = subject))
      and not exists (select 1 from public.messages m where m.id = d.message_id)
  ),
  picked as (
    (select * from chat c where anchor is null or c.created_at <= anchor
     order by c.created_at desc, c.id desc
     limit case when anchor is null then half * 2 else half end)
    union all
    (select * from chat c where anchor is not null and c.created_at > anchor
     order by c.created_at, c.id
     limit half)
  )
  select p.id, p.sender_id, p.body, p.media_kind, p.has_media, p.media_duration_ms, p.created_at,
    p.edited_at, p.deleted, p.unmatched, p_type = 'message' and p.id = p_target
  from picked p
  order by p.created_at, p.id;
end;
$$;

-- The chat-media path of one message of that conversation (live or archived), for a short-lived
-- signed URL made by the admin panel right after this call.
create function public.admin_open_chat_media(
  p_admin    uuid,
  p_type     public.report_target,
  p_target   uuid,
  p_reporter uuid,
  p_message  uuid
)
returns table (path text, media_kind text, media_mime text)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  subject uuid;
  found_path text;
  found_kind text;
  found_mime text;
begin
  perform public.assert_admin(p_admin);
  subject := public.evidence_case_subject(p_type, p_target, p_reporter);

  select coalesce(d.media_path, m.media_path), coalesce(d.media_kind, m.media_kind),
    coalesce(d.media_mime, m.media_mime)
  into found_path, found_kind, found_mime
  from public.messages m
  join public.matches x on x.id = m.match_id
  left join public.message_deletions d on d.message_id = m.id
  where m.id = p_message
    and x.user_a = least(subject, p_reporter) and x.user_b = greatest(subject, p_reporter);

  if not found then
    select d.media_path, d.media_kind, d.media_mime into found_path, found_kind, found_mime
    from public.message_deletions d
    where d.message_id = p_message
      and ((d.sender_id = subject and d.recipient_id = p_reporter)
        or (d.sender_id = p_reporter and d.recipient_id = subject));
  end if;

  if found_path is null then
    raise exception 'No media for this message (expired or not part of the case)'
      using errcode = 'no_data_found';
  end if;

  perform public.log_moderation(p_admin, 'evidence.media_open', 'message', p_message,
    format('case %s:%s, reporter %s', p_type, p_target, p_reporter));
  return query select found_path, found_kind, found_mime;
end;
$$;

revoke execute on function public.evidence_case_subject(public.report_target, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.admin_open_chat_transcript(uuid, public.report_target, uuid, uuid, int)
  from public, anon, authenticated;
revoke execute on function public.admin_open_chat_media(uuid, public.report_target, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.evidence_case_subject(public.report_target, uuid, uuid) to service_role;
grant execute on function public.admin_open_chat_transcript(uuid, public.report_target, uuid, uuid, int)
  to service_role;
grant execute on function public.admin_open_chat_media(uuid, public.report_target, uuid, uuid, uuid)
  to service_role;
