-- Photo moderation (/admin/photos). Deletes the profile_photos row, logs the decision and returns
-- the storage path so the admin panel can remove the object from the `profile-photos` bucket.
create function public.admin_delete_photo(p_admin uuid, p_photo uuid, p_reason text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  removed public.profile_photos;
begin
  perform public.assert_admin(p_admin);
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Reason required' using errcode = 'check_violation';
  end if;

  delete from public.profile_photos where id = p_photo returning * into removed;
  if removed.id is null then
    raise exception 'Photo not found' using errcode = 'no_data_found';
  end if;

  -- Logged against the user, so it shows up next to their other moderation history.
  perform public.log_moderation(p_admin, 'photo.delete', 'user', removed.profile_id, p_reason);
  return removed.storage_path;
end;
$$;

revoke execute on function public.admin_delete_photo(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_delete_photo(uuid, uuid, text) to service_role;

-- Recent uploads first (the admin review grid filters by created_at).
create index profile_photos_created_idx on public.profile_photos (created_at desc);
