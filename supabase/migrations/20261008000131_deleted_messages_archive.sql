-- Safety protocol: "delete for everyone" no longer destroys content immediately.
-- The deleted message's text/media reference moves to a moderation-only archive (no client access),
-- the file stays in chat-media, and both are purged after 90 days unless a report is open.
create table public.message_deletions (
  message_id uuid primary key,
  match_id   uuid not null,
  sender_id  uuid not null,
  body       text,
  media_kind text,
  media_path text,
  media_mime text,
  sent_at    timestamptz not null,
  deleted_at timestamptz not null default now()
);

create index message_deletions_deleted_idx on public.message_deletions (deleted_at);
create index message_deletions_media_idx on public.message_deletions (media_path) where media_path is not null;

alter table public.message_deletions enable row level security;
revoke all on public.message_deletions from anon, authenticated;

create or replace function public.delete_message(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_path text;
  found_id uuid;
begin
  select id, media_path into found_id, old_path
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
    (message_id, match_id, sender_id, body, media_kind, media_path, media_mime, sent_at)
  select id, match_id, sender_id, body, media_kind, media_path, media_mime, created_at
  from public.messages where id = p_id;
  update public.messages
  set body = null, image_path = null, image_width = null, image_height = null,
      media_kind = null, media_path = null, media_mime = null, media_duration_ms = null,
      waveform = null, media_expired_at = null, deleted_at = now()
  where id = p_id;
  -- The file is kept (archived above); nothing for the caller to delete.
  return null;
end;
$$;

create or replace function public.retention_orphan_chat_media(p_limit int default 200)
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
    and not exists (select 1 from public.message_deletions d where d.media_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- Archived deletions older than 90 days (unless the match or the sender is under an open report).
create function public.retention_message_deletions(p_limit int default 200)
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
  order by d.deleted_at
  limit least(greatest(p_limit, 1), 1000);
$$;

create function public.retention_drop_message_deletions(p_ids uuid[])
returns int
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.message_deletions where message_id = any (p_ids) returning 1
  )
  select count(*)::int from gone;
$$;

revoke execute on function public.retention_message_deletions(int) from public, anon, authenticated;
revoke execute on function public.retention_drop_message_deletions(uuid[]) from public, anon, authenticated;
grant execute on function public.retention_message_deletions(int) to service_role;
grant execute on function public.retention_drop_message_deletions(uuid[]) to service_role;
