-- Photo messages. Private bucket, objects at "<match id>/<uuid>.webp".
-- Both participants of the match may upload to and read that folder (reads are needed to create
-- signed URLs with the user's own client). Nobody updates or deletes through the API: a deleted
-- message's photo is removed by the server with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- The match folder of a well-formed chat-media object name, or null.
create function public.chat_media_match(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

revoke execute on function public.chat_media_match(text) from public, anon;
grant execute on function public.chat_media_match(text) to authenticated;

create policy "chat-media: read participant" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_match_participant(public.chat_media_match(name))
  );

create policy "chat-media: upload participant" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_verified()
    and public.is_match_participant(public.chat_media_match(name))
  );
