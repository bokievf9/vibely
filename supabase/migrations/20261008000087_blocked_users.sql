-- Settings → Blocked users. Blocked profiles are invisible through can_view_profile, so the list
-- needs a SECURITY DEFINER read. It returns only people the caller has blocked, and only what the
-- list shows: name and the first photo (path + size, signed server-side). Never location, never
-- anything about who blocked the caller.
-- Unblocking is a plain DELETE on public.blocks ("blocks: remove own").
create function public.get_blocked_users()
returns table (
  id           uuid,
  display_name text,
  photo        jsonb,
  blocked_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
     from public.profile_photos ph
     where ph.profile_id = p.id
     order by ph.position
     limit 1),
    b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc
  limit 500;
$$;

revoke execute on function public.get_blocked_users() from public, anon;
grant execute on function public.get_blocked_users() to authenticated;
