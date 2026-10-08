-- "Notify me about new people": an opt-in, owner-only alert with the deck filters it was saved with
-- (the deck keeps its filters on the device, so the server needs its own copy to match against).
-- When a moderator approves a selfie, new_people_alert_recipients() picks who to notify.
create table public.new_people_alerts (
  user_id          uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  genders          public.gender[] not null check (cardinality(genders) between 1 and 3),
  min_age          smallint not null check (min_age between 18 and 99),
  max_age          smallint not null check (max_age between 18 and 99 and max_age >= min_age),
  max_km           smallint not null check (max_km between 1 and 500),
  last_notified_at timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.new_people_alerts enable row level security;
revoke all on public.new_people_alerts from anon, authenticated;
grant select on public.new_people_alerts to authenticated;

create policy "new_people_alerts: own" on public.new_people_alerts
  for select to authenticated using (user_id = (select auth.uid()));

-- Turns the alert on (saving the current filters) or off. Verified users only.
create function public.set_new_people_alert(
  p_enabled boolean,
  p_genders public.gender[] default null,
  p_min_age int default 18,
  p_max_age int default 99,
  p_max_km  int default 50
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if not p_enabled then
    delete from public.new_people_alerts where user_id = me;
    return false;
  end if;

  p_min_age := least(99, greatest(18, p_min_age));
  p_max_age := least(99, greatest(p_min_age, p_max_age));
  insert into public.new_people_alerts (user_id, genders, min_age, max_age, max_km)
  values (me, p_genders, p_min_age, p_max_age, least(500, greatest(1, p_max_km)))
  on conflict (user_id) do update
    set genders = excluded.genders, min_age = excluded.min_age,
        max_age = excluded.max_age, max_km = excluded.max_km;
  return true;
end;
$$;

revoke execute on function public.set_new_people_alert(boolean, public.gender[], int, int, int) from public, anon;
grant execute on function public.set_new_people_alert(boolean, public.gender[], int, int, int) to authenticated;

-- Server only (service_role): up to 50 opted-in users with a push subscription whose saved filters
-- include the newly approved profile, who would also be shown to it (mutual interest), have not
-- swiped it and are not blocked either way. At most one alert per user per 12 hours: the chosen
-- users are stamped here, atomically. `religion` is never used (PDPA, see 20261008000055).
create function public.new_people_alert_recipients(p_profile uuid)
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
      and np.verification_status = 'approved' and np.is_active
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

revoke execute on function public.new_people_alert_recipients(uuid) from public, anon, authenticated;
grant execute on function public.new_people_alert_recipients(uuid) to service_role;
