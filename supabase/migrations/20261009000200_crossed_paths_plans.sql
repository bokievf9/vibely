-- Crossed paths (opt-in, coarse, 48 h) and Plans (24 h intents).
--
-- Crossed paths privacy model:
--  * OFF by default. Only people who turned it on are pinged, matched or shown, and both people
--    must have it on.
--  * The client sends coordinates to ping_location(); they are coarsened in the same statement to a
--    geohash-6 cell (~1.2 x 0.6 km), the local day (Asia/Kuala_Lumpur), the hourly window and a
--    night flag. Raw coordinates are never stored anywhere in this feature.
--  * Pings are kept 48 hours, results (today/yesterday) up to 2 days, then purged by pg_cron.
--  * Cells with night pings (22:00-06:00, likely home) or most of a person's pings (likely home or
--    work) are ignored for matching.
--  * Clients can never read pings or the pair table; get_crossed_paths() returns only the caller's
--    own encounters as a count, a day (today/yesterday) and an area name. Never times, never cells.

-- ---------------------------------------------------------------------------------------------
-- Opt-in
-- ---------------------------------------------------------------------------------------------
create table public.crossed_paths_settings (
  user_id      uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  enabled_at   timestamptz not null default now(),
  last_ping_at timestamptz
);

alter table public.crossed_paths_settings enable row level security;
revoke all on public.crossed_paths_settings from anon, authenticated;
grant select (user_id, enabled_at) on public.crossed_paths_settings to authenticated;
create policy "crossed_paths_settings: own row" on public.crossed_paths_settings
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Coarse location history (server only)
-- ---------------------------------------------------------------------------------------------
create table public.user_location_pings (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  -- Geohash precision 6. Never coordinates.
  cell      text not null check (cell ~ '^[0-9b-hjkmnp-z]{6}$'),
  -- Local day in Asia/Kuala_Lumpur.
  day       date not null,
  -- Start of the hourly window (minutes and seconds dropped): needed for "2 distinct hours".
  seen_hour timestamptz not null check (seen_hour = date_trunc('hour', seen_hour)),
  -- 22:00-06:00 local time: such cells are treated as home and never matched.
  is_night  boolean not null,
  primary key (user_id, seen_hour, cell)
);

create index user_location_pings_match_idx on public.user_location_pings (seen_hour, cell);

alter table public.user_location_pings enable row level security;
-- No policies and no grants: clients can never read anyone's pings, not even their own.
revoke all on public.user_location_pings from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Neighbourhood names (our own list, no external geocoding, no street names)
-- ---------------------------------------------------------------------------------------------
create table public.areas (
  id       smallint generated always as identity primary key,
  name     text not null check (char_length(name) between 2 and 60),
  city     text not null check (char_length(city) between 2 and 60),
  point    extensions.geography(point, 4326) not null,
  radius_m int not null default 3000 check (radius_m between 500 and 20000),
  unique (name, city)
);

create index areas_point_idx on public.areas using gist (point);

alter table public.areas enable row level security;
revoke all on public.areas from anon, authenticated;

insert into public.areas (name, city, point, radius_m)
select v.name, v.city, extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography, v.r
from (values
  -- Kuala Lumpur
  ('KLCC', 'Kuala Lumpur', 3.1579, 101.7123, 1500),
  ('Bukit Bintang', 'Kuala Lumpur', 3.1466, 101.7101, 1500),
  ('Chinatown', 'Kuala Lumpur', 3.1430, 101.6970, 1200),
  ('Bangsar', 'Kuala Lumpur', 3.1300, 101.6710, 2500),
  ('Mid Valley', 'Kuala Lumpur', 3.1180, 101.6770, 1500),
  ('Brickfields', 'Kuala Lumpur', 3.1290, 101.6860, 1500),
  ('Chow Kit', 'Kuala Lumpur', 3.1650, 101.6980, 1500),
  ('Kampung Baru', 'Kuala Lumpur', 3.1650, 101.7060, 1200),
  ('Titiwangsa', 'Kuala Lumpur', 3.1770, 101.7050, 2000),
  ('Pudu', 'Kuala Lumpur', 3.1360, 101.7120, 1500),
  ('Mont Kiara', 'Kuala Lumpur', 3.1700, 101.6500, 2000),
  ('Sri Hartamas', 'Kuala Lumpur', 3.1610, 101.6530, 1500),
  ('Damansara Heights', 'Kuala Lumpur', 3.1520, 101.6620, 2000),
  ('TTDI', 'Kuala Lumpur', 3.1460, 101.6300, 2500),
  ('Desa ParkCity', 'Kuala Lumpur', 3.1860, 101.6300, 2000),
  ('Kepong', 'Kuala Lumpur', 3.2130, 101.6360, 3500),
  ('Segambut', 'Kuala Lumpur', 3.1850, 101.6650, 2000),
  ('Sentul', 'Kuala Lumpur', 3.1850, 101.6930, 2000),
  ('Setapak', 'Kuala Lumpur', 3.1990, 101.7180, 2500),
  ('Wangsa Maju', 'Kuala Lumpur', 3.2050, 101.7370, 2500),
  ('Cheras', 'Kuala Lumpur', 3.0850, 101.7450, 4000),
  ('Bandar Tun Razak', 'Kuala Lumpur', 3.0800, 101.7200, 2500),
  ('Taman Desa', 'Kuala Lumpur', 3.1000, 101.6850, 1500),
  ('Old Klang Road', 'Kuala Lumpur', 3.0980, 101.6700, 2000),
  ('Sri Petaling', 'Kuala Lumpur', 3.0700, 101.6880, 2000),
  ('Bukit Jalil', 'Kuala Lumpur', 3.0580, 101.6900, 2500),
  -- Selangor
  ('Ampang', 'Ampang Jaya', 3.1500, 101.7600, 3500),
  ('Petaling Jaya Old Town', 'Petaling Jaya', 3.0870, 101.6440, 2000),
  ('Section 14', 'Petaling Jaya', 3.1170, 101.6360, 1500),
  ('SS2', 'Petaling Jaya', 3.1180, 101.6220, 1500),
  ('Damansara Uptown', 'Petaling Jaya', 3.1360, 101.6200, 1500),
  ('Damansara Jaya', 'Petaling Jaya', 3.1290, 101.6110, 1200),
  ('Bandar Utama', 'Petaling Jaya', 3.1460, 101.6150, 2000),
  ('Mutiara Damansara', 'Petaling Jaya', 3.1580, 101.6100, 1500),
  ('Kota Damansara', 'Petaling Jaya', 3.1700, 101.5880, 2500),
  ('Ara Damansara', 'Petaling Jaya', 3.1200, 101.5800, 2000),
  ('Kelana Jaya', 'Petaling Jaya', 3.1050, 101.6000, 2000),
  ('SS15', 'Subang Jaya', 3.0760, 101.5880, 1500),
  ('Sunway', 'Subang Jaya', 3.0700, 101.6050, 2000),
  ('USJ', 'Subang Jaya', 3.0450, 101.5850, 3000),
  ('Subang', 'Subang Jaya', 3.1300, 101.5500, 3000),
  ('Shah Alam City Centre', 'Shah Alam', 3.0730, 101.5180, 3000),
  ('Section 7', 'Shah Alam', 3.0730, 101.4930, 2000),
  ('Setia Alam', 'Shah Alam', 3.1060, 101.4560, 3000),
  ('Kota Kemuning', 'Shah Alam', 3.0050, 101.5370, 3000),
  ('Klang', 'Klang', 3.0440, 101.4450, 5000),
  ('Puchong Jaya', 'Puchong', 3.0350, 101.6200, 2500),
  ('Bandar Puteri Puchong', 'Puchong', 3.0230, 101.6170, 2500),
  ('Seri Kembangan', 'Seri Kembangan', 3.0220, 101.7070, 3000),
  ('Cyberjaya', 'Cyberjaya', 2.9220, 101.6550, 4000),
  ('Putrajaya', 'Putrajaya', 2.9260, 101.6960, 5000),
  ('Kajang', 'Kajang', 2.9930, 101.7880, 4000),
  ('Bangi', 'Bangi', 2.9600, 101.7700, 4000),
  ('Selayang', 'Selayang', 3.2600, 101.6550, 3500),
  ('Rawang', 'Rawang', 3.3200, 101.5770, 5000),
  -- Penang
  ('George Town', 'Penang', 5.4140, 100.3290, 2000),
  ('Gurney', 'Penang', 5.4380, 100.3090, 1500),
  ('Tanjung Tokong', 'Penang', 5.4590, 100.3060, 2000),
  ('Tanjung Bungah', 'Penang', 5.4680, 100.2800, 2000),
  ('Batu Ferringhi', 'Penang', 5.4710, 100.2460, 2500),
  ('Air Itam', 'Penang', 5.4000, 100.2800, 2500),
  ('Jelutong', 'Penang', 5.3900, 100.3150, 2000),
  ('Gelugor', 'Penang', 5.3700, 100.3060, 2000),
  ('Bayan Lepas', 'Penang', 5.2950, 100.2600, 4000),
  ('Butterworth', 'Penang', 5.3990, 100.3630, 3500),
  ('Bukit Mertajam', 'Penang', 5.3630, 100.4610, 4000),
  -- Johor Bahru
  ('Johor Bahru City Centre', 'Johor Bahru', 1.4620, 103.7610, 2500),
  ('Taman Pelangi', 'Johor Bahru', 1.4840, 103.7730, 1500),
  ('Taman Molek', 'Johor Bahru', 1.5240, 103.7900, 2000),
  ('Tebrau', 'Johor Bahru', 1.5440, 103.7850, 2500),
  ('Mount Austin', 'Johor Bahru', 1.5600, 103.7800, 2500),
  ('Skudai', 'Johor Bahru', 1.5330, 103.6600, 4000),
  ('Bukit Indah', 'Johor Bahru', 1.4830, 103.6550, 2500),
  ('Iskandar Puteri', 'Johor Bahru', 1.4260, 103.6500, 4000),
  -- Ipoh
  ('Ipoh Old Town', 'Ipoh', 4.5975, 101.0790, 1500),
  ('Ipoh City Centre', 'Ipoh', 4.5975, 101.0901, 2000),
  ('Ipoh Garden', 'Ipoh', 4.6170, 101.1120, 2000),
  ('Bercham', 'Ipoh', 4.6400, 101.1300, 2500),
  ('Tambun', 'Ipoh', 4.6200, 101.1500, 2500),
  ('Menglembu', 'Ipoh', 4.5700, 101.0450, 2500),
  -- Melaka
  ('Jonker Street', 'Melaka', 2.1940, 102.2480, 1200),
  ('Melaka Raya', 'Melaka', 2.1870, 102.2560, 1500),
  ('Klebang', 'Melaka', 2.2170, 102.1980, 2500),
  ('Bukit Beruang', 'Melaka', 2.2470, 102.2800, 2500),
  ('Ayer Keroh', 'Melaka', 2.2660, 102.2830, 3000),
  -- Kota Kinabalu
  ('Kota Kinabalu City Centre', 'Kota Kinabalu', 5.9800, 116.0730, 2000),
  ('Tanjung Aru', 'Kota Kinabalu', 5.9500, 116.0450, 2500),
  ('Luyang', 'Kota Kinabalu', 5.9620, 116.0950, 2000),
  ('Likas', 'Kota Kinabalu', 6.0100, 116.1050, 2500),
  ('Inanam', 'Kota Kinabalu', 6.0050, 116.1300, 2500),
  ('Penampang', 'Kota Kinabalu', 5.9200, 116.1100, 3500),
  ('Sepanggar', 'Kota Kinabalu', 6.0800, 116.1300, 4000),
  -- Kuching
  ('Kuching Waterfront', 'Kuching', 1.5580, 110.3460, 1500),
  ('Padungan', 'Kuching', 1.5530, 110.3600, 1500),
  ('Petra Jaya', 'Kuching', 1.5800, 110.3400, 3000),
  ('Stutong', 'Kuching', 1.5250, 110.3720, 2000),
  ('Tabuan Jaya', 'Kuching', 1.5300, 110.3850, 2000),
  ('Batu Kawa', 'Kuching', 1.5150, 110.2900, 3500),
  ('Kota Samarahan', 'Kuching', 1.4600, 110.4900, 5000)
) as v (name, city, lat, lng, r);

-- Nearest named area whose radius covers the cell centre; otherwise only the city of the nearest
-- area within 30 km; otherwise nothing (the app then says "nearby").
create function public.area_for_cell(p_cell text)
returns table (area text, city text)
language sql
stable
set search_path = ''
as $$
  with c as (
    select extensions.st_pointfromgeohash(p_cell)::extensions.geography as g
  ), nearest as (
    select a.name, a.city, a.radius_m, extensions.st_distance(a.point, c.g) as d
    from public.areas a, c
    where extensions.st_dwithin(a.point, c.g, 30000)
    order by a.point operator(extensions.<->) c.g
    limit 5
  )
  select
    (select n.name from nearest n where n.d <= n.radius_m order by n.d limit 1),
    (select n.city from nearest n order by n.d limit 1);
$$;

revoke execute on function public.area_for_cell(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Results
-- ---------------------------------------------------------------------------------------------
create table public.crossed_paths (
  user_a      uuid not null references public.profiles (id) on delete cascade,
  user_b      uuid not null references public.profiles (id) on delete cascade,
  -- Local day (Asia/Kuala_Lumpur). The app only says "today" or "yesterday".
  day         date not null,
  crossings   int not null check (crossings > 0),
  area        text,
  city        text,
  computed_at timestamptz not null default now(),
  primary key (user_a, user_b, day),
  check (user_a < user_b)
);

create index crossed_paths_b_idx on public.crossed_paths (user_b, day);

alter table public.crossed_paths enable row level security;
revoke all on public.crossed_paths from anon, authenticated;

create table public.crossed_path_hides (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  hidden_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, hidden_id),
  check (user_id <> hidden_id)
);

alter table public.crossed_path_hides enable row level security;
revoke all on public.crossed_path_hides from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Client RPCs
-- ---------------------------------------------------------------------------------------------

-- Turning it off deletes everything this feature holds about the caller (pings and encounters).
create function public.set_crossed_paths(p_enabled boolean)
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
  if p_enabled then
    insert into public.crossed_paths_settings (user_id) values (me) on conflict do nothing;
  else
    delete from public.crossed_paths_settings where user_id = me;
    delete from public.user_location_pings where user_id = me;
    delete from public.crossed_paths where user_a = me or user_b = me;
  end if;
  return p_enabled;
end;
$$;

-- Foreground ping. Returns true when a coarse ping was stored. Coordinates are only used to compute
-- the cell in this statement and are never written anywhere.
create function public.ping_location(p_lat double precision, p_lng double precision)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  local_ts timestamp := now() at time zone 'Asia/Kuala_Lumpur';
  last_at timestamptz;
  local_hour int := extract(hour from local_ts);
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  select s.last_ping_at into last_at
  from public.crossed_paths_settings s where s.user_id = me
  for update;
  if not found then
    return false; -- Not opted in: nothing is stored.
  end if;
  -- The app pings at most every 10 minutes; a minute of slack for clock and network jitter.
  if last_at is not null and last_at > now() - interval '9 minutes' then
    return false;
  end if;
  if p_lat is null or p_lng is null or p_lat = 'NaN' or p_lng = 'NaN' then
    return false;
  end if;
  -- Malaysia only (rough bounding box). Elsewhere nothing is stored.
  if p_lat not between 0.8 and 7.6 or p_lng not between 99.5 and 119.5 then
    return false;
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = me and p.discoverable and not p.shadow_banned
  ) then
    return false;
  end if;

  insert into public.user_location_pings (user_id, cell, day, seen_hour, is_night)
  values (
    me,
    extensions.st_geohash(extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326), 6),
    local_ts::date,
    date_trunc('hour', now()),
    local_hour >= 22 or local_hour < 6
  )
  on conflict do nothing;
  update public.crossed_paths_settings set last_ping_at = now() where user_id = me;
  return true;
end;
$$;

-- The caller's encounters: one row per person (their most recent day), only today or yesterday,
-- re-checked against blocks, bans, pauses, hides, opt-in and mutual interest at read time.
create function public.get_crossed_paths()
returns table (
  id           uuid,
  display_name text,
  age          int,
  photo        jsonb,
  crossings    int,
  is_today     boolean,
  area         text,
  city         text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  select * into me from public.profiles where profiles.id = (select auth.uid());
  if me.id is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.crossed_paths_settings s where s.user_id = me.id) then
    return;
  end if;

  return query
  select distinct on (p.id)
    p.id,
    p.display_name,
    public.age_in_years(p.birth_date),
    (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
     from public.profile_photos ph where ph.profile_id = p.id order by ph.position limit 1),
    cp.crossings,
    cp.day = today,
    cp.area,
    cp.city
  from public.crossed_paths cp
  join public.profiles p
    on p.id = case when cp.user_a = me.id then cp.user_b else cp.user_a end
  join public.crossed_paths_settings s on s.user_id = p.id
  where (cp.user_a = me.id or cp.user_b = me.id)
    and cp.day between today - 1 and today
    and p.verification_status = 'approved'
    and p.is_active
    and p.banned_at is null
    and p.discoverable
    and not p.shadow_banned
    and p.gender = any (me.interested_in)
    and me.gender = any (p.interested_in)
    and not public.is_blocked_between(me.id, p.id)
    and not exists (
      select 1 from public.crossed_path_hides h where h.user_id = me.id and h.hidden_id = p.id
    )
  order by p.id, cp.day desc;
end;
$$;

create function public.hide_crossed_path(p_user uuid)
returns void
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
  if p_user is null or p_user = me then
    raise exception 'Invalid user' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.crossed_path_hides (user_id, hidden_id)
  select me, p.id from public.profiles p where p.id = p_user
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Server jobs
-- ---------------------------------------------------------------------------------------------

-- Retention: pings 48 hours; encounters older than yesterday (local) are no longer shown;
-- expired plans are deleted (they already stopped showing at expires_at).
create function public.purge_crossed_paths()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.user_location_pings where seen_hour < now() - interval '48 hours';
  delete from public.crossed_paths
  where day < (now() at time zone 'Asia/Kuala_Lumpur')::date - 1;
  delete from public.user_plans where expires_at <= now();
end;
$$;

-- Hourly. Pairs of opted-in, eligible, mutually interested, unblocked people who were in the same
-- cell in the same hourly window at least twice in the last 24 hours (2 distinct hours, or 2
-- distinct cells). Only windows that ended at least 3 hours ago count, so nothing is ever shown
-- live. Night cells and each person's dominant cell (home or work) are ignored.
create function public.compute_crossed_paths()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  perform public.purge_crossed_paths();

  with eligible as (
    select p.id, p.gender, p.interested_in
    from public.crossed_paths_settings s
    join public.profiles p on p.id = s.user_id
    where p.verification_status = 'approved'
      and p.is_active
      and p.banned_at is null
      and p.discoverable
      and not p.shadow_banned
  ), stats as (
    select l.user_id, l.cell, count(*) as hits, bool_or(l.is_night) as night,
           sum(count(*)) over (partition by l.user_id) as total
    from public.user_location_pings l
    join eligible e on e.id = l.user_id
    group by l.user_id, l.cell
  ), usable as (
    -- Not home (no night ping there), not dominant (at least 3 hours and more than half of all).
    select user_id, cell from stats
    where not night and not (hits >= 3 and hits * 2 > total)
  ), events as (
    select l.user_id, l.cell, l.seen_hour, l.day
    from public.user_location_pings l
    join usable u on u.user_id = l.user_id and u.cell = l.cell
    where l.seen_hour >= now() - interval '24 hours'
      and l.seen_hour + interval '1 hour' <= now() - interval '3 hours'
  ), together as (
    select a.user_id as user_a, b.user_id as user_b, a.cell, a.seen_hour, a.day
    from events a
    join events b on b.cell = a.cell and b.seen_hour = a.seen_hour and a.user_id < b.user_id
    join eligible ea on ea.id = a.user_id
    join eligible eb on eb.id = b.user_id
    where ea.gender = any (eb.interested_in)
      and eb.gender = any (ea.interested_in)
      and not public.is_blocked_between(a.user_id, b.user_id)
  ), pairs as (
    select user_a, user_b from together
    group by user_a, user_b
    having count(distinct seen_hour) >= 2 or count(distinct cell) >= 2
  ), per_day as (
    select t.user_a, t.user_b, t.day, count(*)::int as crossings,
           mode() within group (order by t.cell) as cell
    from together t
    join pairs using (user_a, user_b)
    group by t.user_a, t.user_b, t.day
  )
  insert into public.crossed_paths as cp (user_a, user_b, day, crossings, area, city)
  select d.user_a, d.user_b, d.day, d.crossings, a.area, a.city
  from per_day d
  cross join lateral public.area_for_cell(d.cell) a
  on conflict (user_a, user_b, day) do update
    set crossings = greatest(cp.crossings, excluded.crossings),
        area = excluded.area,
        city = excluded.city,
        computed_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Plans (24 h intents, preset tags only)
-- ---------------------------------------------------------------------------------------------
create table public.user_plans (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  tag        text not null check (tag in (
    'coffee', 'football', 'mamak', 'morning-run', 'gym', 'movie', 'karaoke', 'hiking', 'study',
    'new-cafe', 'night-market', 'badminton', 'beach', 'gaming', 'concert', 'art-gallery',
    'food-hunt', 'chatting'
  )),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index user_plans_tag_idx on public.user_plans (tag, expires_at);

alter table public.user_plans enable row level security;
revoke all on public.user_plans from anon, authenticated;
grant select (user_id, tag, expires_at) on public.user_plans to authenticated;
-- Own plan always; others' active plans when their profile is visible (verified, unblocked).
create policy "user_plans: own or visible active" on public.user_plans
  for select to authenticated using (
    user_id = (select auth.uid())
    or (expires_at > now() and public.can_view_profile(user_id))
  );

create function public.set_plan(p_tag text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  until timestamptz;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.user_plans (user_id, tag) values (me, p_tag)
  on conflict (user_id) do update
    set tag = excluded.tag, created_at = now(), expires_at = now() + interval '24 hours'
  returning expires_at into until;
  return until;
end;
$$;

create function public.clear_plan()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.user_plans where user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------------------------
-- Discover: same pool and columns as 20261008000090 (pool from 20261009000151), plus the
-- candidate's active plan and an optional "Similar plans" sort: people with the caller's active
-- plan first (still inside the distance filter), then the usual order.
-- ---------------------------------------------------------------------------------------------
drop function public.get_swipe_candidates(public.gender[], int, int, int, int);

create function public.get_swipe_candidates(
  p_genders       public.gender[],
  p_min_age       int default 18,
  p_max_age       int default 99,
  p_max_km        int default 50,
  p_limit         int default 20,
  p_similar_plans boolean default false
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
  second_chance     boolean,
  plan              text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  my_plan text;
begin
  select * into me from public.profiles where profiles.id = (select auth.uid());
  if me.id is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;

  p_min_age := greatest(18, p_min_age);
  p_max_age := least(99, greatest(p_min_age, p_max_age));
  p_max_km  := least(500, greatest(1, p_max_km));
  p_limit   := least(50, greatest(1, p_limit));
  if coalesce(p_similar_plans, false) then
    select up.tag into my_plan from public.user_plans up
    where up.user_id = me.id and up.expires_at > now();
  end if;

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
    c.second_chance,
    pl.tag
  from public.swipe_candidate_pool(me.id, p_genders, p_min_age, p_max_age, p_max_km) c
  join public.profiles p on p.id = c.id
  left join public.user_plans pl on pl.user_id = p.id and pl.expires_at > now()
  order by (my_plan is not null and pl.tag is not distinct from my_plan) desc,
           c.second_chance,
           p.last_active_at desc
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'set_crossed_paths(boolean)',
    'ping_location(double precision, double precision)',
    'get_crossed_paths()',
    'hide_crossed_path(uuid)',
    'set_plan(text)',
    'clear_plan()',
    'get_swipe_candidates(public.gender[], int, int, int, int, boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  foreach fn in array array['compute_crossed_paths()', 'purge_crossed_paths()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- Hourly where pg_cron exists (Supabase; not the local test database): compute (which purges
-- first), and a separate purge so retention holds even if the compute ever fails.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('compute-crossed-paths', '7 * * * *',
      'select public.compute_crossed_paths()');
    perform cron.schedule('purge-crossed-paths-plans', '37 * * * *',
      'select public.purge_crossed_paths()');
  end if;
end;
$$;
