-- Photo moderation queue (/admin/photos): every recent profile photo, verified or not, waits for a
-- moderator's look. Approving records a review; deleting goes through admin_delete_photo
-- (20261008000032), which removes the row (and so its review). Both are logged per photo.
create table public.photo_reviews (
  photo_id    uuid primary key references public.profile_photos (id) on delete cascade,
  reviewed_by uuid references auth.users (id) on delete set null,
  decision    text not null check (decision in ('approve')),
  reviewed_at timestamptz not null default now()
);

alter table public.photo_reviews enable row level security;
revoke all on public.photo_reviews from anon, authenticated;

-- Photos of the last p_days days. p_scope: 'pending' (not reviewed yet), 'verified' (owner is
-- verified), 'unverified' (owner is not verified), 'all'. Newest first.
create function public.admin_photo_queue(
  p_admin  uuid,
  p_scope  text default 'pending',
  p_days   int default 7,
  p_limit  int default 60,
  p_offset int default 0
)
returns table (
  id                  uuid,
  profile_id          uuid,
  storage_path        text,
  width               int,
  height              int,
  created_at          timestamptz,
  display_name        text,
  verification_status public.verification_status,
  reviewed            boolean,
  open_reports        int,
  total               bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_admin(p_admin);
  if p_scope not in ('pending', 'verified', 'unverified', 'all') then
    raise exception 'Unknown scope %', p_scope using errcode = 'check_violation';
  end if;
  return query
  select ph.id, ph.profile_id, ph.storage_path, ph.width, ph.height, ph.created_at,
    p.display_name, p.verification_status, rv.photo_id is not null,
    (select count(*)::int from public.reports r
     where r.target_type = 'photo' and r.target_id = ph.id and r.resolved_at is null),
    count(*) over ()
  from public.profile_photos ph
  join public.profiles p on p.id = ph.profile_id
  left join public.photo_reviews rv on rv.photo_id = ph.id
  where ph.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
    and case p_scope
      when 'pending' then rv.photo_id is null
      when 'verified' then p.verification_status = 'approved'
      when 'unverified' then p.verification_status <> 'approved'
      else true
    end
  order by ph.created_at desc, ph.id
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Marks photos as reviewed and fine. Returns how many were newly approved; each is logged.
create function public.admin_approve_photos(p_admin uuid, p_photos uuid[])
returns int
language plpgsql
set search_path = ''
as $$
declare
  ph record;
  n int := 0;
begin
  perform public.assert_admin(p_admin);
  if cardinality(p_photos) > 200 then
    raise exception 'At most 200 photos at once' using errcode = 'check_violation';
  end if;
  for ph in
    insert into public.photo_reviews (photo_id, reviewed_by, decision)
    select p.id, p_admin, 'approve' from public.profile_photos p where p.id = any (p_photos)
    on conflict (photo_id) do nothing
    returning photo_id
  loop
    perform public.log_moderation(p_admin, 'photo.approve', 'photo', ph.photo_id, null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Bulk delete: one admin_delete_photo per photo (each logged). Returns the storage paths of the
-- photos removed so the panel deletes the files; photos already gone are skipped.
create function public.admin_delete_photos(p_admin uuid, p_photos uuid[], p_reason text)
returns setof text
language plpgsql
set search_path = ''
as $$
declare
  pid uuid;
begin
  perform public.assert_admin(p_admin);
  if cardinality(p_photos) > 200 then
    raise exception 'At most 200 photos at once' using errcode = 'check_violation';
  end if;
  foreach pid in array p_photos loop
    if exists (select 1 from public.profile_photos where id = pid) then
      return next public.admin_delete_photo(p_admin, pid, p_reason);
    end if;
  end loop;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_photo_queue(uuid, text, int, int, int)',
    'admin_approve_photos(uuid, uuid[])',
    'admin_delete_photos(uuid, uuid[], text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
