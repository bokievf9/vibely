-- "Who liked you". public.swipes stays closed ("swipes: own": you see only your own swipes);
-- incoming likes are exposed only through these two RPCs, which return people who
--   * liked the caller,
--   * the caller has not swiped yet and is not already matched with (e.g. via random chat),
--   * are approved, active (not banned), discoverable (not paused) and not blocked either way.
-- Card data mirrors get_swipe_candidates (rounded distance only, never `location`).
-- Whether this list is free or premium is decided in the app (LIKES_VISIBLE_FREE); the count is
-- always available for the Discover badge.
create function public.incoming_like_ids()
returns table (id uuid, liked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;

  return query
  select s.swiper_id, s.created_at
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  where s.swiped_id = me
    and s.direction = 'like'
    and p.verification_status = 'approved'
    and p.is_active
    and p.discoverable
    and not exists (
      select 1 from public.swipes mine where mine.swiper_id = me and mine.swiped_id = s.swiper_id
    )
    and not exists (
      select 1 from public.matches m
      where m.user_a = least(me, s.swiper_id) and m.user_b = greatest(me, s.swiper_id)
    )
    and not public.is_blocked_between(me, s.swiper_id);
end;
$$;

-- Internal building block: not callable by clients (they use the two functions below).
revoke execute on function public.incoming_like_ids() from public, anon, authenticated;

create function public.count_incoming_likes()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.incoming_like_ids();
$$;

create function public.get_incoming_likes(p_limit int default 50)
returns table (
  id                uuid,
  display_name      text,
  age               int,
  bio               text,
  city              text,
  distance_km       int,
  tags              text[],
  photos            jsonb,
  relationship_goal public.relationship_goal,
  height_cm         smallint,
  job_title         text,
  education         public.education_level,
  languages         public.spoken_language[],
  religion          public.religion,
  smoking           public.habit_frequency,
  drinking          public.habit_frequency,
  pets              public.pets_status,
  children          public.children_plan,
  prompts           jsonb,
  liked_at          timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
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
    ),
    p.relationship_goal,
    p.height_cm,
    p.job_title,
    p.education,
    p.languages,
    p.religion,
    p.smoking,
    p.drinking,
    p.pets,
    p.children,
    coalesce(
      (select jsonb_agg(jsonb_build_object('key', pp.prompt_key, 'answer', pp.answer)
              order by pp.position)
       from public.profile_prompts pp where pp.profile_id = p.id),
      '[]'::jsonb
    ),
    l.liked_at
  from public.incoming_like_ids() l
  join public.profiles p on p.id = l.id
  join public.profiles me on me.id = (select auth.uid())
  order by l.liked_at desc
  limit least(100, greatest(1, coalesce(p_limit, 50)));
$$;

revoke execute on function public.count_incoming_likes() from public, anon;
revoke execute on function public.get_incoming_likes(int) from public, anon;
grant execute on function public.count_incoming_likes() to authenticated;
grant execute on function public.get_incoming_likes(int) to authenticated;
