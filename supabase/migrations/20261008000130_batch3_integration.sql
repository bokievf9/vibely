-- Integration of the batch-3 branches (settings + discover):
-- 1. Paused profiles (profiles.discoverable = false, 085) must stay out of the Discover pool that
--    090 introduced (deck, "+N more" counts) and must not trigger "new people nearby" alerts (091).
-- 2. "New people nearby" pushes get their own notification preference.
create or replace function public.swipe_candidate_pool(
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
    and p.discoverable
    and p.gender = any (p_genders)
    and me.gender = any (p.interested_in)
    and public.age_in_years(p.birth_date) between p_min_age and p_max_age
    and (me.location is null or p.location is null
         or extensions.st_dwithin(me.location, p.location, p_max_km * 1000))
    and (s.swiper_id is null
         or (s.direction = 'pass' and s.created_at < now() - interval '14 days'))
    and not public.is_blocked_between(me.id, p.id);
$$;

create or replace function public.new_people_alert_recipients(p_profile uuid)
returns setof uuid
language sql
volatile
security definer
set search_path = ''
as $$
  with picked as (
    select a.user_id
    from public.profiles np
    join public.new_people_alerts a on a.user_id <> np.id
    join public.profiles u on u.id = a.user_id
    where np.id = p_profile
      and np.verification_status = 'approved' and np.is_active and np.discoverable
      and u.verification_status = 'approved' and u.is_active
      and np.gender = any (a.genders)
      and u.gender = any (np.interested_in)
      and public.age_in_years(np.birth_date) between a.min_age and a.max_age
      and (u.location is null or np.location is null
           or extensions.st_dwithin(u.location, np.location, a.max_km * 1000))
      and (a.last_notified_at is null or a.last_notified_at < now() - interval '12 hours')
      and not exists (
        select 1 from public.swipes s where s.swiper_id = u.id and s.swiped_id = np.id
      )
      and not public.is_blocked_between(u.id, np.id)
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = u.id)
    order by u.last_active_at desc
    limit 50
  )
  update public.new_people_alerts a
  set last_notified_at = now()
  from picked
  where a.user_id = picked.user_id
  returning a.user_id;
$$;

alter table public.notification_prefs add column new_people boolean not null default true;
grant insert (new_people), update (new_people) on public.notification_prefs to authenticated;
