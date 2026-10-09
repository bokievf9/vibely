-- Promo codes with VIP perks (batch-5).
--
--   * promo_codes: a code (unique, case-insensitive), optional use limit and expiry, the perks it
--     grants, an optional gender restriction (allowed because gender is confirmed by the human
--     selfie check) and whether it needs an approved selfie.
--   * promo_redemptions: one row per code and user. When the code requires verification and the
--     user is not approved yet (onboarding), the row is a reservation (granted_at null) that takes
--     one of the uses at once; the perks are granted by a trigger when the selfie is approved.
--   * promo_attempts: every redeem_promo() call, for the 5-per-hour limit (guessing is slow).
--   * profiles.vip_until / vip_boost_until / vip_perks: the granted perks. Expiry is expression
--     based (is_vip() = vip_until > now()), so nothing has to run on a schedule.
--
-- Perks:
--   vip_days       VIP badge for N days (stacks: extends an active VIP)
--   boost_hours    the profile is shown first in Discover for N hours (get_swipe_candidates)
--   see_likes      "Who liked you" while VIP, even when the global free flag is off (app side)
--   queue_priority flag for the Blind Dating queue (read by the events queue: has_vip_perk)
--
-- redeem_promo() never raises for a user error: it returns {status:'error', error:<code>} so the
-- attempt row survives (a raise would roll it back). Codes: invalid, expired, used_up,
-- not_for_you, already_redeemed, too_many_attempts.
--
-- All tables are closed to clients; everything goes through the RPCs below. The admin RPCs
-- need the 'admin' role and log every change in moderation_actions (promo.*).

-- ---------------------------------------------------------------------------------------------
-- Profile columns. profiles is column-granted (20261008000004): clients get no access to these.
alter table public.profiles
  add column vip_until       timestamptz,
  add column vip_boost_until timestamptz,
  add column vip_perks       jsonb not null default '{}'::jsonb;

create index profiles_vip_boost_idx on public.profiles (vip_boost_until)
  where vip_boost_until is not null;

-- ---------------------------------------------------------------------------------------------
-- Code normalisation and benefits shape (used by the check constraint below)

-- Trim, drop inner whitespace, upper case. Mirrored in src/features/promo/schemas.ts.
create function public.normalize_promo_code(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(btrim(coalesce(p, '')), '\s+', '', 'g'));
$$;

-- Shape of promo_codes.benefits. A see_likes / queue_priority flag needs VIP days, because the
-- flags only count while is_vip().
create function public.promo_benefits_valid(b jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  days  int;
  hours int;
begin
  if b is null or jsonb_typeof(b) <> 'object' then
    return false;
  end if;
  if b - array['vip_days', 'boost_hours', 'see_likes', 'queue_priority'] <> '{}'::jsonb then
    return false;
  end if;
  if (b ? 'vip_days' and jsonb_typeof(b->'vip_days') <> 'number')
     or (b ? 'boost_hours' and jsonb_typeof(b->'boost_hours') <> 'number')
     or (b ? 'see_likes' and jsonb_typeof(b->'see_likes') <> 'boolean')
     or (b ? 'queue_priority' and jsonb_typeof(b->'queue_priority') <> 'boolean') then
    return false;
  end if;
  days  := coalesce((b->>'vip_days')::numeric, 0)::int;
  hours := coalesce((b->>'boost_hours')::numeric, 0)::int;
  if days < 0 or days > 3650 or hours < 0 or hours > 8760 then
    return false;
  end if;
  if (coalesce((b->>'see_likes')::boolean, false) or coalesce((b->>'queue_priority')::boolean, false))
     and days < 1 then
    return false;
  end if;
  return days > 0 or hours > 0;
exception when others then
  return false;
end;
$$;

revoke execute on function public.normalize_promo_code(text) from public, anon, authenticated;
revoke execute on function public.promo_benefits_valid(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Tables
create table public.promo_codes (
  id                 uuid primary key default gen_random_uuid(),
  -- Stored normalised (upper case, no spaces); compared case-insensitively (index below).
  code               text not null,
  -- null: unlimited.
  max_uses           int,
  current_uses       int not null default 0,
  expires_at         timestamptz,
  -- {vip_days, boost_hours, see_likes, queue_priority}
  benefits           jsonb not null default '{}'::jsonb,
  gender_restriction public.gender,
  requires_verified  boolean not null default true,
  is_active          boolean not null default true,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint promo_codes_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  constraint promo_codes_max_uses check (max_uses is null or max_uses > 0),
  constraint promo_codes_current_uses check (current_uses >= 0),
  constraint promo_codes_gender check (gender_restriction is null or gender_restriction in ('male', 'female')),
  constraint promo_codes_benefits check (public.promo_benefits_valid(benefits))
);

-- Case-insensitive uniqueness ("citext-like").
create unique index promo_codes_code_key on public.promo_codes (lower(code));

create table public.promo_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code_id     uuid not null references public.promo_codes (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  -- null: reserved, the perks are granted when the selfie check is approved.
  granted_at  timestamptz,
  -- The code's benefits at redemption time.
  perks       jsonb not null default '{}'::jsonb,
  unique (code_id, user_id)
);

create index promo_redemptions_pending_idx on public.promo_redemptions (user_id) where granted_at is null;
create index promo_redemptions_code_idx on public.promo_redemptions (code_id, redeemed_at desc);

create table public.promo_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index promo_attempts_user_idx on public.promo_attempts (user_id, created_at desc);

alter table public.promo_codes       enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.promo_attempts    enable row level security;
revoke all on public.promo_codes, public.promo_redemptions, public.promo_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Helpers

-- VIP right now? For the Blind Dating queue and anything else that needs one check.
create function public.is_vip(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.vip_until > now() from public.profiles p where p.id = p_user), false);
$$;

-- A perk flag ('see_likes', 'queue_priority') that is on and whose VIP has not expired.
create function public.has_vip_perk(p_user uuid, p_perk text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.vip_until > now() and coalesce((p.vip_perks ->> p_perk)::boolean, false)
     from public.profiles p where p.id = p_user),
    false);
$$;

revoke execute on function public.is_vip(uuid) from public, anon;
revoke execute on function public.has_vip_perk(uuid, text) from public, anon;
grant execute on function public.is_vip(uuid) to authenticated;
grant execute on function public.has_vip_perk(uuid, text) to authenticated;

-- Applies a benefits object to a profile. VIP and boost extend what is still running (or start
-- now); the flags are unioned. Internal.
create function public.promo_grant(p_user uuid, p_benefits jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  days  int := coalesce((p_benefits ->> 'vip_days')::numeric, 0)::int;
  hours int := coalesce((p_benefits ->> 'boost_hours')::numeric, 0)::int;
  flags jsonb := jsonb_strip_nulls(jsonb_build_object(
    'see_likes',      case when coalesce((p_benefits ->> 'see_likes')::boolean, false) then true end,
    'queue_priority', case when coalesce((p_benefits ->> 'queue_priority')::boolean, false) then true end));
  r record;
begin
  update public.profiles
  set vip_until = case when days > 0
                       then greatest(coalesce(vip_until, now()), now()) + make_interval(days => days)
                       else vip_until end,
      vip_boost_until = case when hours > 0
                             then greatest(coalesce(vip_boost_until, now()), now()) + make_interval(hours => hours)
                             else vip_boost_until end,
      vip_perks = coalesce(vip_perks, '{}'::jsonb) || flags
  where id = p_user
  returning vip_until, vip_boost_until, vip_perks into r;
  return jsonb_build_object(
    'vip_until', r.vip_until,
    'boost_until', r.vip_boost_until,
    'perks', coalesce(r.vip_perks, '{}'::jsonb),
    'vip_days', days,
    'boost_hours', hours);
end;
$$;

revoke execute on function public.promo_grant(uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- redeem_promo(code): the one client entry point.
create function public.redeem_promo(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  norm     text := public.normalize_promo_code(p_code);
  c        public.promo_codes;
  prof     record;
  attempts int;
  pending  boolean;
  granted  jsonb;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  -- 5 calls per hour, successful or not. Older rows of this user are dropped on the way.
  delete from public.promo_attempts where user_id = me and created_at < now() - interval '1 hour';
  select count(*) into attempts from public.promo_attempts where user_id = me;
  if attempts >= 5 then
    return jsonb_build_object('status', 'error', 'error', 'too_many_attempts');
  end if;
  insert into public.promo_attempts (user_id) values (me);

  select id, gender, verification_status into prof from public.profiles where id = me;
  if prof.id is null or norm = '' then
    return jsonb_build_object('status', 'error', 'error', 'invalid');
  end if;

  -- Row lock: concurrent redemptions of one code are counted one after another.
  select * into c from public.promo_codes where lower(code) = lower(norm) for update;
  if c.id is null or not c.is_active then
    return jsonb_build_object('status', 'error', 'error', 'invalid');
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return jsonb_build_object('status', 'error', 'error', 'expired');
  end if;
  if exists (select 1 from public.promo_redemptions r where r.code_id = c.id and r.user_id = me) then
    return jsonb_build_object('status', 'error', 'error', 'already_redeemed');
  end if;
  if c.max_uses is not null and c.current_uses >= c.max_uses then
    return jsonb_build_object('status', 'error', 'error', 'used_up');
  end if;
  if c.gender_restriction is not null and prof.gender is distinct from c.gender_restriction then
    return jsonb_build_object('status', 'error', 'error', 'not_for_you');
  end if;

  update public.promo_codes set current_uses = current_uses + 1, updated_at = now() where id = c.id;

  -- Not approved yet (onboarding): the use is reserved, the perks wait for the selfie check.
  pending := c.requires_verified and prof.verification_status <> 'approved';
  if pending then
    insert into public.promo_redemptions (code_id, user_id, perks) values (c.id, me, c.benefits);
    return jsonb_build_object('status', 'pending', 'code', c.code, 'benefits', c.benefits);
  end if;

  granted := public.promo_grant(me, c.benefits);
  insert into public.promo_redemptions (code_id, user_id, granted_at, perks)
  values (c.id, me, now(), c.benefits);
  return jsonb_build_object('status', 'granted', 'code', c.code, 'benefits', c.benefits) || granted;
end;
$$;

revoke execute on function public.redeem_promo(text) from public, anon;
grant execute on function public.redeem_promo(text) to authenticated;

-- Reserved perks are granted when the selfie check approves the profile (the verification
-- trigger from 20261008000005 updates profiles.verification_status).
create function public.promo_activate_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, perks from public.promo_redemptions
    where user_id = new.id and granted_at is null
    order by redeemed_at
    for update
  loop
    perform public.promo_grant(new.id, r.perks);
    update public.promo_redemptions set granted_at = now() where id = r.id;
  end loop;
  return null;
end;
$$;

revoke execute on function public.promo_activate_pending() from public, anon, authenticated;

create trigger profiles_promo_activate
  after update of verification_status on public.profiles
  for each row
  when (new.verification_status = 'approved' and old.verification_status is distinct from 'approved')
  execute function public.promo_activate_pending();

-- ---------------------------------------------------------------------------------------------
-- Reads for the app

-- The caller's VIP state (Settings row, own profile). Null when the caller has no profile.
create function public.my_vip()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'is_vip', coalesce(p.vip_until > now(), false),
    'vip_until', p.vip_until,
    'boost_until', case when p.vip_boost_until > now() then p.vip_boost_until end,
    'perks', coalesce(p.vip_perks, '{}'::jsonb),
    'pending', (select count(*) from public.promo_redemptions r
                where r.user_id = p.id and r.granted_at is null))
  from public.profiles p
  where p.id = (select auth.uid());
$$;

-- Which of these people are VIP right now (badge on cards). Only ids the caller may see anyway.
create function public.vip_ids(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.id = any (p_ids[1:200])
    and p.vip_until > now()
    and (p.id = (select auth.uid()) or public.can_view_profile(p.id));
$$;

revoke execute on function public.my_vip() from public, anon;
revoke execute on function public.vip_ids(uuid[]) from public, anon;
grant execute on function public.my_vip() to authenticated;
grant execute on function public.vip_ids(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Boost: get_swipe_candidates copied from 20261009000200 (plans; pool from 20261009000151, columns
-- from 20261008000090). The only change is the first ORDER BY key: an active vip_boost_until
-- comes first, then the "Similar plans" key, then the usual order. Same signature, so the app's
-- PGRST202 fallback for p_similar_plans keeps working.
create or replace function public.get_swipe_candidates(
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
  order by coalesce(p.vip_boost_until > now(), false) desc, -- VIP boost (20261009000230)
           (my_plan is not null and pl.tag is not distinct from my_plan) desc,
           c.second_chance,
           p.last_active_at desc
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin (/admin/promo): admin role, every change logged.

create function public.admin_promo_stats(p_admin uuid)
returns table (
  id                 uuid,
  code               text,
  max_uses           int,
  current_uses       int,
  expires_at         timestamptz,
  benefits           jsonb,
  gender_restriction public.gender,
  requires_verified  boolean,
  is_active          boolean,
  created_by         uuid,
  created_at         timestamptz,
  updated_at         timestamptz,
  granted_count      bigint,
  pending_count      bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  return query
  select c.id, c.code, c.max_uses, c.current_uses, c.expires_at, c.benefits, c.gender_restriction,
    c.requires_verified, c.is_active, c.created_by, c.created_at, c.updated_at,
    (select count(*) from public.promo_redemptions r where r.code_id = c.id and r.granted_at is not null),
    (select count(*) from public.promo_redemptions r where r.code_id = c.id and r.granted_at is null)
  from public.promo_codes c
  order by c.created_at desc;
end;
$$;

create function public.admin_promo_redemptions(p_admin uuid, p_code uuid)
returns table (
  user_id      uuid,
  display_name text,
  username     text,
  phone        text,
  redeemed_at  timestamptz,
  granted_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  return query
  select r.user_id, p.display_name, p.username, u.phone::text, r.redeemed_at, r.granted_at
  from public.promo_redemptions r
  join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  where r.code_id = p_code
  order by r.redeemed_at desc
  limit 5000;
end;
$$;

-- Creates (p_id null) or edits a code. The code text is normalised; uniqueness is
-- case-insensitive (23505 on a clash).
create function public.admin_upsert_promo(
  p_admin             uuid,
  p_id                uuid,
  p_code              text,
  p_max_uses          int,
  p_expires_at        timestamptz,
  p_benefits          jsonb,
  p_gender            public.gender,
  p_requires_verified boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  norm text := public.normalize_promo_code(p_code);
  new_id uuid;
  summary text;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  if norm !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$' then
    raise exception 'Invalid code' using errcode = 'check_violation';
  end if;
  if not public.promo_benefits_valid(p_benefits) then
    raise exception 'Invalid benefits' using errcode = 'check_violation';
  end if;
  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'Invalid use limit' using errcode = 'check_violation';
  end if;
  if p_gender is not null and p_gender not in ('male', 'female') then
    raise exception 'Invalid gender restriction' using errcode = 'check_violation';
  end if;

  summary := norm
    || ' uses=' || coalesce(p_max_uses::text, 'unlimited')
    || ' expires=' || coalesce(p_expires_at::text, 'never')
    || ' benefits=' || p_benefits::text
    || ' gender=' || coalesce(p_gender::text, 'any')
    || ' verified=' || p_requires_verified::text;

  if p_id is null then
    insert into public.promo_codes
      (code, max_uses, expires_at, benefits, gender_restriction, requires_verified, created_by)
    values (norm, p_max_uses, p_expires_at, p_benefits, p_gender, p_requires_verified, p_admin)
    returning id into new_id;
    perform public.log_moderation(p_admin, 'promo.create', 'promo', new_id, summary);
    return new_id;
  end if;

  update public.promo_codes
  set code = norm, max_uses = p_max_uses, expires_at = p_expires_at, benefits = p_benefits,
      gender_restriction = p_gender, requires_verified = p_requires_verified, updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'Promo code not found' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, 'promo.update', 'promo', p_id, summary);
  return p_id;
end;
$$;

create function public.admin_set_promo_active(p_admin uuid, p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.promo_codes;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  update public.promo_codes
  set is_active = p_active, updated_at = now()
  where id = p_id and is_active is distinct from p_active
  returning * into c;
  if c.id is null then
    if not exists (select 1 from public.promo_codes where id = p_id) then
      raise exception 'Promo code not found' using errcode = 'no_data_found';
    end if;
    return;
  end if;
  perform public.log_moderation(p_admin,
    case when p_active then 'promo.activate' else 'promo.deactivate' end, 'promo', p_id, c.code);
end;
$$;

revoke execute on function public.admin_promo_stats(uuid) from public, anon, authenticated;
revoke execute on function public.admin_promo_redemptions(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_upsert_promo(uuid, uuid, text, int, timestamptz, jsonb, public.gender, boolean)
  from public, anon, authenticated;
revoke execute on function public.admin_set_promo_active(uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Example code for the launch campaign, inactive until the owner switches it on in /admin/promo.
insert into public.promo_codes
  (code, max_uses, benefits, gender_restriction, requires_verified, is_active)
values
  ('XMUM_FIRST_100', 100,
   '{"vip_days": 30, "boost_hours": 48, "see_likes": true, "queue_priority": true}'::jsonb,
   'female', true, false)
on conflict (lower(code)) do nothing;
