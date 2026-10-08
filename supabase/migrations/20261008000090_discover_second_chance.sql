-- Discover, when the deck runs out:
--  * "Second chance": people you passed more than 14 days ago come back. Likes are always excluded.
--  * count_swipe_candidates(): live counts for one-tap widening ("+25 km → N more people").
-- Both read the same pool, so the counts always match what the deck would show.

-- Internal: candidate ids for a user with the deck filters (already clamped by the caller).
-- Not SECURITY DEFINER and not callable by clients: only the definer RPCs below use it.
create function public.swipe_candidate_pool(
  p_me      uuid,
  p_genders public.gender[],
  p_min_age int,
  p_max_age int,
  p_max_km  int
)
returns table (id uuid, second_chance boolean)
language sql
stable
set search_path = ''
as $$
  select p.id, s.swiper_id is not null
  from public.profiles me
  join public.profiles p on p.id <> me.id
  left join public.swipes s on s.swiper_id = me.id and s.swiped_id = p.id
  where me.id = p_me
    and p.verification_status = 'approved'
    and p.is_active
    and p.gender = any (p_genders)
    and me.gender = any (p.interested_in)
    and public.age_in_years(p.birth_date) between p_min_age and p_max_age
    and (me.location is null or p.location is null
         or extensions.st_dwithin(me.location, p.location, p_max_km * 1000))
    and (s.swiper_id is null
         or (s.direction = 'pass' and s.created_at < now() - interval '14 days'))
    and not public.is_blocked_between(me.id, p.id);
$$;

revoke execute on function public.swipe_candidate_pool(uuid, public.gender[], int, int, int)
  from public, anon, authenticated;

-- Same columns as 20261008000057 plus `second_chance`; `location` is still never returned.
-- New people first, then second chances; most recently active first within each group.
drop function public.get_swipe_candidates(public.gender[], int, int, int, int);

create function public.get_swipe_candidates(
  p_genders public.gender[],
  p_min_age int default 18,
  p_max_age int default 99,
  p_max_km  int default 50,
  p_limit   int default 20
)
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
  second_chance     boolean
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
    c.second_chance
  from public.swipe_candidate_pool(me.id, p_genders, p_min_age, p_max_age, p_max_km) c
  join public.profiles p on p.id = c.id
  order by c.second_chance, p.last_active_at desc
  limit p_limit;
end;
$$;

revoke execute on function public.get_swipe_candidates(public.gender[], int, int, int, int) from public, anon;
grant execute on function public.get_swipe_candidates(public.gender[], int, int, int, int) to authenticated;

-- How many people the deck would show with these filters. Only a number (capped at 1000):
-- never ids, so it reveals nothing the deck itself would not.
create function public.count_swipe_candidates(
  p_genders public.gender[],
  p_min_age int default 18,
  p_max_age int default 99,
  p_max_km  int default 50
)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me_id uuid := (select auth.uid());
  n int;
begin
  if me_id is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;

  p_min_age := greatest(18, p_min_age);
  p_max_age := least(99, greatest(p_min_age, p_max_age));
  p_max_km  := least(500, greatest(1, p_max_km));

  select count(*)::int into n
  from (
    select 1
    from public.swipe_candidate_pool(me_id, p_genders, p_min_age, p_max_age, p_max_km)
    limit 1000
  ) c;
  return n;
end;
$$;

revoke execute on function public.count_swipe_candidates(public.gender[], int, int, int) from public, anon;
grant execute on function public.count_swipe_candidates(public.gender[], int, int, int) to authenticated;

-- Swiping a second-chance card again: the old pass (older than 14 days) is replaced by the new
-- swipe, so the primary key does not reject it and a like can still create a match.
-- Runs after swipes_rate_limit (triggers fire in name order), so a rate-limited swipe keeps the pass.
create function public.swipes_replace_stale_pass()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.swipes
  where swiper_id = new.swiper_id
    and swiped_id = new.swiped_id
    and direction = 'pass'
    and created_at < now() - interval '14 days';
  return new;
end;
$$;

revoke execute on function public.swipes_replace_stale_pass() from public, anon, authenticated;

create trigger swipes_replace_stale_pass
  before insert on public.swipes
  for each row execute function public.swipes_replace_stale_pass();
