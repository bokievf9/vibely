-- Both buckets are private. Objects are stored under "<user id>/<file>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('selfies', 'selfies', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
-- `selfies` may already exist from the draft setup: enforce our settings.
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Profile photos: owners manage their folder; anyone allowed to view the profile can read
-- (needed to create signed URLs with the user's own client).
create policy "profile-photos: read visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and public.can_view_profile(((storage.foldername(name))[1])::uuid)
  );
create policy "profile-photos: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "profile-photos: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile-photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Selfies: upload-only for users. Moderators read them with the service role.
create policy "selfies: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'selfies'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
