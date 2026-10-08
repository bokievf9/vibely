-- Voice messages and video "circles" next to photos: the image columns of 20261008000060 are
-- generalised into media_* columns.
--
--   media_kind         'image' | 'voice' | 'video'
--   media_path         chat-media object "<match_id>/<uuid>.<ext>" (webp | webm | m4a | mp4)
--   media_mime         image/webp, audio/webm, audio/mp4 (iOS), video/webm, video/mp4 (iOS)
--   media_duration_ms  voice ≤ 120 s, video ≤ 60 s (+1 s slack for the recorder's last chunk)
--   waveform           voice only: ~48 peaks 0..100 computed by the browser
--   media_expired_at   set by the retention job (20261008000111) when the file was purged after
--                      90 days: the row keeps its kind/duration/size as an "expired" placeholder
--
-- Backward compatible: image_path/width/height stay. Old clients that insert image_path only are
-- mapped onto media_* by the insert trigger, and image_path keeps mirroring media_path for images,
-- so code reading image_path keeps working until it is dropped in a later migration.
alter table public.messages
  add column media_kind        text,
  add column media_path        text,
  add column media_mime        text,
  add column media_duration_ms int,
  add column waveform          smallint[],
  add column media_expired_at  timestamptz;

update public.messages
set media_kind = 'image', media_path = image_path, media_mime = 'image/webp'
where image_path is not null;

alter table public.messages drop constraint messages_content;

alter table public.messages
  add constraint messages_media_kind check (media_kind in ('image', 'voice', 'video')),
  -- Per-kind shape. A media message has its file or is expired; deleted ones have no media at all.
  add constraint messages_media_fields check (
    case
      when media_kind is null then
        media_path is null and media_mime is null and media_duration_ms is null
        and waveform is null and media_expired_at is null
      when media_kind = 'image' then
        media_mime is not distinct from 'image/webp' and media_duration_ms is null and waveform is null
        and image_width is not null and image_height is not null
      when media_kind = 'voice' then
        coalesce(media_mime, '') in ('audio/webm', 'audio/mp4') and coalesce(media_duration_ms, 0) between 1 and 121000
        and image_width is null
      else
        coalesce(media_mime, '') in ('video/webm', 'video/mp4') and coalesce(media_duration_ms, 0) between 1 and 61000
        and waveform is null and image_width is null
    end
    and (media_kind is null or media_path is not null or media_expired_at is not null)
  ),
  -- The file lives in this match's folder and its extension matches the MIME type.
  add constraint messages_media_path check (
    media_path is null
    or media_path ~ (
      '^' || match_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.'
      || case media_mime
           when 'image/webp' then 'webp'
           when 'audio/webm' then 'webm'
           when 'audio/mp4' then 'm4a'
           when 'video/webm' then 'webm'
           when 'video/mp4' then 'mp4'
           else '!'
         end
      || '$'
    )
  ),
  add constraint messages_waveform check (
    waveform is null
    or (
      media_kind = 'voice'
      and array_ndims(waveform) = 1
      and cardinality(waveform) between 1 and 64
      and 0 <= all (waveform)
      and 100 >= all (waveform)
    )
  ),
  -- Legacy mirror for code that still reads image_path.
  add constraint messages_image_legacy check (
    image_path is not distinct from (case when media_kind = 'image' then media_path end)
  ),
  add constraint messages_content check (
    case
      when deleted_at is null then
        body is not null or media_path is not null or media_expired_at is not null
      else body is null and media_path is null and image_path is null
    end
  );

-- One file per message: deleting or expiring one message never breaks another.
create unique index messages_media_path_key on public.messages (media_path)
  where media_path is not null;
-- Retention scan (oldest live media first).
create index messages_media_created_idx on public.messages (created_at)
  where media_path is not null;

create or replace function public.messages_check_insert()
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
  -- Clients from before this migration send a photo as image_path only.
  if new.media_path is null and new.image_path is not null then
    new.media_kind := 'image';
    new.media_path := new.image_path;
    new.media_mime := 'image/webp';
  end if;
  new.image_path := case when new.media_kind = 'image' then new.media_path end;
  if new.media_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'chat-media' and name = new.media_path
  ) then
    raise exception 'media not uploaded' using errcode = '23514';
  end if;
  new.edited_at := null;
  new.deleted_at := null;
  new.media_expired_at := null;
  return new;
end;
$$;

grant insert (media_kind, media_path, media_mime, media_duration_ms, waveform)
  on public.messages to authenticated;

-- Same contract as before (returns the file path for the server to remove), now for any media.
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
  update public.messages
  set body = null, image_path = null, image_width = null, image_height = null,
      media_kind = null, media_path = null, media_mime = null, media_duration_ms = null,
      waveform = null, media_expired_at = null, deleted_at = now()
  where id = p_id;
  return old_path;
end;
$$;

-- Bucket: photos (webp), voice (webm/opus or mp4/aac on iOS), video circles (webm or mp4).
-- The per-file limit covers a 60 s circle at ~500 kbps with headroom; clients keep files small.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/webp', 'audio/webm', 'audio/mp4', 'video/webm', 'video/mp4']
where id = 'chat-media';

-- Storage RLS (participants only) is unchanged; it just accepts the new extensions.
create or replace function public.chat_media_match(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|webm|m4a|mp4)$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;
