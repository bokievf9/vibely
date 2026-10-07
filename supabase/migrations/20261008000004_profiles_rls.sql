-- Caller is a verified, active user. Gate for swiping, posting and the randomizer.
create function public.is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and verification_status = 'approved' and is_active
  );
$$;

revoke execute on function public.is_verified() from public, anon;
grant execute on function public.is_verified() to authenticated;

alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.tags enable row level security;
alter table public.profile_tags enable row level security;

revoke all on public.profiles, public.profile_photos, public.tags, public.profile_tags from anon, authenticated;

-- `location` is never readable by clients (stalking risk): distance is computed in RPCs.
-- `verification_status` is never writable by clients: only the verification flow changes it.
-- `birth_date` and `gender` are fixed after onboarding.
grant select (
  id, display_name, birth_date, gender, interested_in, bio, city,
  verification_status, is_active, last_active_at, created_at, updated_at
) on public.profiles to authenticated;
grant insert (display_name, birth_date, gender, interested_in, bio, location, city)
  on public.profiles to authenticated;
grant update (display_name, interested_in, bio, location, city, is_active, last_active_at)
  on public.profiles to authenticated;

grant select, delete on public.profile_photos to authenticated;
grant insert (storage_path, width, height, position) on public.profile_photos to authenticated;
grant update (position) on public.profile_photos to authenticated;

grant select on public.tags to authenticated;
grant select, delete on public.profile_tags to authenticated;
grant insert (tag_id) on public.profile_tags to authenticated;

-- A profile is visible to its owner, and to verified users when it is approved, active and unblocked.
create function public.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = (select auth.uid())
    or (
      public.is_verified()
      and exists (
        select 1 from public.profiles
        where id = target and verification_status = 'approved' and is_active
      )
      and not public.is_blocked_between((select auth.uid()), target)
    );
$$;

revoke execute on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.can_view_profile(uuid) to authenticated;

create policy "profiles: visible" on public.profiles
  for select to authenticated using (public.can_view_profile(id));
create policy "profiles: create own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "photos: visible" on public.profile_photos
  for select to authenticated using (public.can_view_profile(profile_id));
create policy "photos: create own" on public.profile_photos
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );
create policy "photos: update own" on public.profile_photos
  for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "photos: delete own" on public.profile_photos
  for delete to authenticated using (profile_id = (select auth.uid()));

create policy "tags: readable" on public.tags
  for select to authenticated using (true);

create policy "profile_tags: visible" on public.profile_tags
  for select to authenticated using (public.can_view_profile(profile_id));
create policy "profile_tags: create own" on public.profile_tags
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "profile_tags: delete own" on public.profile_tags
  for delete to authenticated using (profile_id = (select auth.uid()));
