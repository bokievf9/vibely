-- Photo order: position 0 is the main photo (avatar). Users reorder their photos atomically and
-- positions stay contiguous (0..n-1) after a deletion.

-- A deferrable unique constraint is checked at the end of each statement instead of per row, so a
-- single UPDATE can swap or rotate positions. (Still INITIALLY IMMEDIATE: no transaction-wide
-- deferral. No code upserts on (profile_id, position), so losing ON CONFLICT arbitration is fine.)
alter table public.profile_photos drop constraint profile_photos_profile_id_position_key;
alter table public.profile_photos
  add constraint profile_photos_profile_id_position_key
  unique (profile_id, position) deferrable initially immediate;

-- Rewrites the caller's photo positions in the given order: p_ids must list every one of the
-- caller's photos exactly once. Other users' photos can never be touched.
create function public.reorder_profile_photos(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    uuid := (select auth.uid());
  owned int;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Serialises concurrent reorders/deletes of the same user's photos.
  perform 1 from public.profile_photos where profile_id = me for update;
  select count(*) into owned from public.profile_photos where profile_id = me;

  if p_ids is null
     or cardinality(p_ids) <> owned
     or (select count(distinct x) from unnest(p_ids) x) <> owned
     or exists (
       select 1 from unnest(p_ids) x
       where not exists (
         select 1 from public.profile_photos ph where ph.id = x and ph.profile_id = me
       )
     )
  then
    raise exception 'Photo list mismatch' using errcode = 'invalid_parameter_value';
  end if;

  update public.profile_photos ph
  set position = (o.ord - 1)::smallint
  from unnest(p_ids) with ordinality as o(id, ord)
  where ph.id = o.id and ph.profile_id = me and ph.position <> o.ord - 1;
end;
$$;

revoke execute on function public.reorder_profile_photos(uuid[]) from public, anon;
grant execute on function public.reorder_profile_photos(uuid[]) to authenticated;

-- After any deletion (own, admin moderation, account removal) the remaining photos are renumbered
-- 0..n-1 keeping their order, so the next photo becomes the main one.
create function public.profile_photos_compact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profile_photos ph
  set position = (r.rn - 1)::smallint
  from (
    select id, row_number() over (order by position) as rn
    from public.profile_photos
    where profile_id = old.profile_id
  ) r
  where ph.id = r.id and ph.position <> r.rn - 1;
  return null;
end;
$$;

revoke execute on function public.profile_photos_compact() from public, anon, authenticated;

create trigger profile_photos_compact
  after delete on public.profile_photos
  for each row execute function public.profile_photos_compact();

-- Existing gaps are closed once.
update public.profile_photos ph
set position = (r.rn - 1)::smallint
from (
  select id, row_number() over (partition by profile_id order by position) as rn
  from public.profile_photos
) r
where ph.id = r.id and ph.position <> r.rn - 1;
