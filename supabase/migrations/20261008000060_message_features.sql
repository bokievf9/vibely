-- Telegram-like match chat: replies, edits, deletes ("for everyone") and photo messages.
--
--   reply_to      quoted message of the same match (enforced by a trigger); set null if it goes
--   edited_at     set by edit_message() (own text messages, within 15 minutes)
--   deleted_at    set by delete_message(): body and image are wiped, only the stub stays
--   image_*       photo message: chat-media object "<match_id>/<uuid>.webp" (see 20261008000062)
--
-- Clients still INSERT directly (rate limit trigger + RLS), but body/edited_at/deleted_at can only
-- change through the two SECURITY DEFINER RPCs; recipients keep updating read_at only.
alter table public.messages
  add column reply_to     uuid references public.messages (id) on delete set null,
  add column edited_at    timestamptz,
  add column deleted_at   timestamptz,
  add column image_path   text,
  add column image_width  int,
  add column image_height int;

alter table public.messages alter column body drop not null;
alter table public.messages drop constraint messages_body_check;

alter table public.messages
  add constraint messages_body_length check (body is null or char_length(body) between 1 and 2000),
  add constraint messages_image_path check (
    image_path is null
    or image_path ~ ('^' || match_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
  ),
  add constraint messages_image_size check (
    (image_path is null and image_width is null and image_height is null)
    or (image_width between 1 and 10000 and image_height between 1 and 10000)
  ),
  -- A live message has text or a photo; a deleted one keeps neither.
  add constraint messages_content check (
    case when deleted_at is null then body is not null or image_path is not null
    else body is null and image_path is null end
  ),
  add constraint messages_reply_not_self check (reply_to is null or reply_to <> id);

create index messages_reply_to_idx on public.messages (reply_to) where reply_to is not null;

-- Replies stay inside the match; photos must already be uploaded to that match's folder.
create function public.messages_check_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Fail before the lookups below, so they can't be used to probe other matches.
  if not exists (
    select 1 from public.matches where id = new.match_id and new.sender_id in (user_a, user_b)
  ) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if new.reply_to is not null and not exists (
    select 1 from public.messages where id = new.reply_to and match_id = new.match_id
  ) then
    raise exception 'reply_to must be a message of the same match' using errcode = '23514';
  end if;
  if new.image_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'chat-media' and name = new.image_path
  ) then
    raise exception 'image not uploaded' using errcode = '23514';
  end if;
  new.edited_at := null;
  new.deleted_at := null;
  return new;
end;
$$;

revoke execute on function public.messages_check_insert() from public, anon, authenticated;

create trigger messages_check_insert
  before insert on public.messages
  for each row execute function public.messages_check_insert();

revoke insert on public.messages from authenticated;
grant insert (match_id, body, reply_to, image_path, image_width, image_height)
  on public.messages to authenticated;

-- Edits the text of the caller's own message (also a photo caption) within 15 minutes.
-- p_body is already sanitized by the server action; blank text is rejected.
create function public.edit_message(p_id uuid, p_body text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  body_trim text := nullif(btrim(p_body), '');
  edited    timestamptz;
begin
  if body_trim is null or char_length(body_trim) > 2000 then
    raise exception 'invalid body' using errcode = '22023';
  end if;
  update public.messages
  set body = body_trim, edited_at = now()
  where id = p_id
    and sender_id = (select auth.uid())
    and deleted_at is null
    and created_at > now() - interval '15 minutes'
    and public.is_verified()
    and public.is_match_participant(match_id)
  returning edited_at into edited;
  if edited is null then
    raise exception 'message not editable' using errcode = '42501';
  end if;
  return edited;
end;
$$;

-- Deletes the caller's own message for both sides: content and reactions go, the row stays as a
-- "Message deleted" stub so replies and read receipts keep pointing somewhere. Returns the photo
-- path (if any) so the server can remove the object from storage with the service role.
create function public.delete_message(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_path text;
  found_id uuid;
begin
  select id, image_path into found_id, old_path
  from public.messages
  where id = p_id
    and sender_id = (select auth.uid())
    and deleted_at is null
    and public.is_match_participant(match_id)
  for update;
  if found_id is null then
    raise exception 'message not deletable' using errcode = '42501';
  end if;
  update public.messages
  set body = null, image_path = null, image_width = null, image_height = null,
      deleted_at = now()
  where id = p_id;
  return old_path;
end;
$$;

revoke execute on function public.edit_message(uuid, text) from public, anon;
revoke execute on function public.delete_message(uuid) from public, anon;
grant execute on function public.edit_message(uuid, text) to authenticated;
grant execute on function public.delete_message(uuid) to authenticated;

-- Deleted messages no longer count as unread.
create or replace function public.unread_message_count()
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.messages m
  where m.read_at is null
    and m.deleted_at is null
    and m.sender_id <> (select auth.uid())
    and public.is_match_participant(m.match_id)
    and public.can_view_profile(m.sender_id);
$$;
