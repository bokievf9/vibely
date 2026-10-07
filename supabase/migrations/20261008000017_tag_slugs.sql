-- Tags are returned as slugs: the client translates them (en / ms / ru dictionaries).
create or replace function public.get_swipe_candidates(
  p_genders public.gender[],
  p_min_age int default 18,
  p_max_age int default 99,
  p_max_km  int default 50,
  p_limit   int default 20
)
returns table (
  id           uuid,
  display_name text,
  age          int,
  bio          text,
  city         text,
  distance_km  int,
  tags         text[],
  photos       jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where profiles.id = (select auth.uid());
  if me.id is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;

  p_min_age := greatest(18, p_min_age);
  p_max_age := least(99, greatest(p_min_age, p_max_age));
  p_max_km  := least(500, greatest(1, p_max_km));
  p_limit   := least(50, greatest(1, p_limit));

  return query
  select
    p.id,
    p.display_name,
    public.age_in_years(p.birth_date),
    p.bio,
    p.city,
    case when me.location is null or p.location is null then null
         else ceil(extensions.st_distance(me.location, p.location) / 1000)::int end,
    coalesce(
      (select array_agg(t.slug order by t.slug)
       from public.profile_tags pt join public.tags t on t.id = pt.tag_id
       where pt.profile_id = p.id),
      '{}'
    ),
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'path', ph.storage_path, 'width', ph.width, 'height', ph.height)
              order by ph.position)
       from public.profile_photos ph where ph.profile_id = p.id),
      '[]'::jsonb
    )
  from public.profiles p
  where p.id <> me.id
    and p.verification_status = 'approved'
    and p.is_active
    and p.gender = any (p_genders)
    and me.gender = any (p.interested_in)
    and public.age_in_years(p.birth_date) between p_min_age and p_max_age
    and (me.location is null or p.location is null
         or extensions.st_dwithin(me.location, p.location, p_max_km * 1000))
    and not exists (
      select 1 from public.swipes s where s.swiper_id = me.id and s.swiped_id = p.id
    )
    and not public.is_blocked_between(me.id, p.id)
  order by p.last_active_at desc
  limit p_limit;
end;
$$;

create or replace function public.get_random_session()
returns table (
  id               uuid,
  my_side          text,
  my_revealed      boolean,
  partner_revealed boolean,
  common_tags      text[],
  partner          jsonb,
  match_id         uuid,
  started_at       timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select rs.*,
           case when rs.user_a = (select auth.uid()) then 'a' else 'b' end as side,
           case when rs.user_a = (select auth.uid()) then rs.user_b else rs.user_a end as other
    from public.random_chat_sessions rs
    where rs.status = 'active' and (select auth.uid()) in (rs.user_a, rs.user_b)
    order by rs.started_at desc
    limit 1
  )
  select
    s.id,
    s.side,
    case s.side when 'a' then s.a_revealed else s.b_revealed end,
    case s.side when 'a' then s.b_revealed else s.a_revealed end,
    coalesce((
      select array_agg(t.slug order by t.slug)
      from public.profile_tags mine
      join public.profile_tags theirs on theirs.tag_id = mine.tag_id and theirs.profile_id = s.other
      join public.tags t on t.id = mine.tag_id
      where mine.profile_id = (select auth.uid())
    ), '{}'),
    case when s.a_revealed and s.b_revealed then (
      select jsonb_build_object(
        'id', p.id, 'display_name', p.display_name,
        'age', public.age_in_years(p.birth_date), 'bio', p.bio, 'city', p.city)
      from public.profiles p where p.id = s.other
    ) end,
    s.match_id,
    s.started_at
  from s;
$$;

