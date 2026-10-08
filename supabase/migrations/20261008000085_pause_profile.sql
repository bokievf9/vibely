-- "Pause my profile" (Settings → Privacy).
--
-- `is_active` stays reserved for moderation (bans force it false) and is what can_view_profile
-- checks, so pausing must NOT flip it: the user's matches would lose their chat partner.
-- Instead `discoverable` hides the user only where strangers find people:
--   * Discover (get_swipe_candidates, below),
--   * "Who liked you" (get_incoming_likes, 20261008000088),
--   * the random-chat waiting queue (pausing leaves it; searching again is an explicit opt-in).
-- Matches, chats and a match's profile page keep working.
alter table public.profiles add column discoverable boolean not null default true;

grant select (discoverable) on public.profiles to authenticated;
grant update (discoverable) on public.profiles to authenticated;

-- Users no longer deactivate themselves (that is what `discoverable` is for): only the server
-- (bans, via profiles_enforce_ban / admin_set_ban) writes is_active.
revoke update (is_active) on public.profiles from authenticated;

create function public.profiles_pause_leaves_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.random_chat_queue where user_id = new.id;
  return new;
end;
$$;

create trigger profiles_pause_leaves_queue
  after update of discoverable on public.profiles
  for each row when (old.discoverable and not new.discoverable)
  execute function public.profiles_pause_leaves_queue();

revoke execute on function public.profiles_pause_leaves_queue() from public, anon, authenticated;

-- Same as 20261008000057 plus `and p.discoverable`. Same signature and return type.
create or replace function public.get_swipe_candidates(
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
  prompts           jsonb
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
    )
  from public.profiles p
  where p.id <> me.id
    and p.verification_status = 'approved'
    and p.is_active
    and p.discoverable
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

revoke execute on function public.get_swipe_candidates(public.gender[], int, int, int, int) from public, anon;
grant execute on function public.get_swipe_candidates(public.gender[], int, int, int, int) to authenticated;
