-- Plans: free < plus < vip (owner decision 2026-10-09).
--
--   * plan_grants: who has which paid level, from which source, for how long. A user's plan is the
--     highest active grant (not revoked, started, not ended); without one the plan is 'free'.
--     Grants stack: a new grant starts when the user's last active grant of the same or a higher
--     level ends. Clients only read their own rows; grants come from promo codes, the matchmaker
--     reward, the admin panel and (later) purchases.
--   * features / plan_limits: the matrix (which level unlocks what, and the quotas per level).
--     Everything is data and editable in /admin/plans; the seeds below are the owner's matrix.
--   * Staff (any row in public.admins, whatever the role) get everything with no limits.
--   * A disabled feature is blocked for everyone except staff.
--   * Limits apply to NEW actions only: nothing already sent, posted or liked is removed after a
--     downgrade. Incognito stays stored but counts as off while the user's plan lacks it.
--   * One stable SQLSTATE for every gate: VP402, detail = feature key, hint = 'feature' (the plan
--     does not include it), 'limit' (the quota of the period is used up) or 'partner' (the other
--     person's plan does not include it, calls only). The app maps it to <UpgradeCard>.
--   * Quota windows are rolling: day = 24 hours, week = 7 days, month = 30 days.
--
-- The 24-hour "Plans" (intents, 20261009000200) are removed: statuses replace them. user_plans,
-- set_plan and clear_plan are dropped; Discover's "Similar plans" sort now uses the preset tag
-- (plan_tag) of the active statuses (20261009000271) and keeps the p_similar_plans parameter name.
--
-- Functions copied from their newest definitions are marked with the migration they come from.

-- =============================================================================================
-- Levels, grants, matrix
-- =============================================================================================
create type public.plan_level as enum ('free', 'plus', 'vip');

create table public.plan_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  plan       public.plan_level not null check (plan <> 'free'),
  source     text not null check (source in ('promo', 'matchmaker', 'referral', 'admin', 'purchase', 'legacy')),
  starts_at  timestamptz not null default now(),
  -- null: no end.
  ends_at    timestamptz,
  granted_by uuid references auth.users (id) on delete set null,
  note       text check (char_length(note) <= 500),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index plan_grants_user_idx on public.plan_grants (user_id, ends_at);
create index plan_grants_created_idx on public.plan_grants (created_at desc);

alter table public.plan_grants enable row level security;
revoke all on public.plan_grants from anon, authenticated;
grant select on public.plan_grants to authenticated;
create policy "plan_grants: own" on public.plan_grants
  for select to authenticated using (user_id = (select auth.uid()));

create table public.features (
  key        text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  name_ru    text not null,
  min_plan   public.plan_level not null default 'free',
  enabled    boolean not null default true,
  note       text,
  sort       int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.plan_limits (
  feature_key text not null references public.features (key) on delete cascade,
  plan        public.plan_level not null,
  -- null: unlimited.
  limit_value int check (limit_value is null or limit_value >= 0),
  period      text check (period in ('day', 'week', 'month')),
  updated_at  timestamptz not null default now(),
  primary key (feature_key, plan)
);

-- The matrix is not secret (the app reads it through my_access); nobody but the RPCs writes it.
alter table public.features enable row level security;
alter table public.plan_limits enable row level security;
revoke all on public.features, public.plan_limits from anon, authenticated;
grant select on public.features, public.plan_limits to authenticated;
create policy "features: read" on public.features for select to authenticated using (true);
create policy "plan_limits: read" on public.plan_limits for select to authenticated using (true);

-- Uses of quota features that have no table of their own (boost, message_before_match, ...).
create table public.feature_uses (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  feature_key text not null,
  created_at  timestamptz not null default now()
);

create index feature_uses_user_idx on public.feature_uses (user_id, feature_key, created_at desc);

alter table public.feature_uses enable row level security;
revoke all on public.feature_uses from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Seeds: the owner's matrix.
insert into public.features (key, name_ru, min_plan, note, sort) values
  ('likes_per_day',        'Лайки в Discover в день',            'free', null, 10),
  ('who_liked_you',        'Кто лайкнул (без размытия)',         'plus', null, 20),
  ('chat_photos',          'Фото в чате',                        'plus', null, 30),
  ('voice_messages',       'Голосовые сообщения',                'plus', null, 40),
  ('video_messages',       'Видеосообщения',                     'plus', null, 50),
  ('calls',                'Аудио- и видеозвонки',               'vip',  'Звонить и принимать звонки', 60),
  ('feed_post',            'Посты в ленте',                      'plus', null, 70),
  ('feed_comment',         'Комментарии в ленте',                'plus', null, 80),
  ('feed_like',            'Лайки постов в ленте',               'free', null, 90),
  ('blind_dating_per_day', 'Blind Dating: новых свиданий в день','free', 'Только обычные, не вечера', 100),
  ('event_priority',       'Приоритет в очереди Blind Dating Night', 'vip', null, 110),
  ('incognito',            'Инкогнито',                          'plus', null, 120),
  ('boost',                'Буст профиля (30 минут)',            'plus', null, 130),
  ('crush_links_per_30d',  'Ссылки Secret crush за 30 дней',     'free', null, 140),
  ('duo',                  'Duo',                                'free', null, 150),
  ('statuses',             'Статусы',                            'free', null, 160),
  ('crossed_paths',        'Пересечения',                        'free', null, 170),
  ('vip_badge',            'Значок VIP',                         'vip',  null, 180),
  ('read_receipts',        'Отчёты о прочтении',                 'vip',  'Зарезервировано', 190),
  ('profile_visitors',     'Кто смотрел профиль',                'vip',  'Зарезервировано', 200),
  ('discover_priority',    'Приоритет в Discover',               'vip',  'Зарезервировано', 210),
  ('message_before_match', 'Сообщение до мэтча',                 'vip',  'Зарезервировано', 220);

insert into public.plan_limits (feature_key, plan, limit_value, period) values
  ('likes_per_day',        'free', 100,  'day'),
  ('likes_per_day',        'plus', null, null),
  ('likes_per_day',        'vip',  null, null),
  ('blind_dating_per_day', 'free', 3,    'day'),
  ('blind_dating_per_day', 'plus', 10,   'day'),
  ('blind_dating_per_day', 'vip',  null, null),
  ('boost',                'plus', 1,    'month'),
  ('boost',                'vip',  1,    'week'),
  ('crush_links_per_30d',  'free', 1,    'month'),
  ('crush_links_per_30d',  'plus', 3,    'month'),
  ('crush_links_per_30d',  'vip',  5,    'month'),
  ('message_before_match', 'vip',  1,    'day');

-- =============================================================================================
-- Helpers. Internal (security definer, not callable by clients): they take any user id.
-- =============================================================================================

create function public.is_staff(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and exists (select 1 from public.admins a where a.user_id = p_user);
$$;

-- The plan from grants only (no staff rule): the highest active grant, else 'free'.
create function public.plan_of(p_user uuid)
returns public.plan_level
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select max(g.plan) from public.plan_grants g
     where g.user_id = p_user and g.revoked_at is null
       and g.starts_at <= now() and (g.ends_at is null or g.ends_at > now())),
    'free'::public.plan_level);
$$;

-- The effective plan: staff count as 'vip' (and get everything else too, see has_feature).
create function public.current_plan(p_user uuid)
returns public.plan_level
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_staff(p_user) then 'vip'::public.plan_level else public.plan_of(p_user) end;
$$;

-- When the user's current plan level ends: the latest end among the active grants of that level
-- or higher, chained through grants that start before the previous one ends. Null = no end (or
-- free).
create function public.plan_until(p_user uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  lvl public.plan_level := public.plan_of(p_user);
  until timestamptz := now();
  g record;
begin
  if lvl = 'free' then
    return null;
  end if;
  for g in
    select starts_at, ends_at from public.plan_grants
    where user_id = p_user and revoked_at is null and plan >= lvl
      and (ends_at is null or ends_at > now())
    order by starts_at
  loop
    if g.starts_at > until then
      exit;
    end if;
    if g.ends_at is null then
      return null;
    end if;
    until := greatest(until, g.ends_at);
  end loop;
  return until;
end;
$$;

create function public.has_feature(p_user uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user is null then false
    when public.is_staff(p_user) then true
    else coalesce(
      (select f.enabled and public.plan_of(p_user) >= f.min_plan
       from public.features f where f.key = p_key),
      false)
  end;
$$;

-- Quota of the user's plan: null = unlimited (staff always), 0 when the feature is not available.
create function public.feature_limit(p_user uuid, p_key text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff(p_user) then null
    when not public.has_feature(p_user, p_key) then 0
    else (select l.limit_value from public.plan_limits l
          where l.feature_key = p_key and l.plan = public.plan_of(p_user))
  end;
$$;

create function public.feature_period(p_user uuid, p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select l.period from public.plan_limits l
  where l.feature_key = p_key and l.plan = public.plan_of(p_user);
$$;

create function public.period_interval(p_period text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_period
    when 'day' then interval '1 day'
    when 'week' then interval '7 days'
    when 'month' then interval '30 days'
    else interval '100 years'
  end;
$$;

-- How much of a quota feature the user used in the current window. Features with a table of their
-- own are counted there (existing content keeps counting: limits apply to new actions).
create function public.feature_used(p_user uuid, p_key text, p_period text)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz := now() - public.period_interval(p_period);
begin
  return case p_key
    when 'likes_per_day' then
      (select count(*) from public.swipes s
       where s.swiper_id = p_user and s.direction = 'like' and s.created_at > since)
    when 'blind_dating_per_day' then
      (select count(*) from public.random_chat_sessions s
       where p_user in (s.user_a, s.user_b) and s.kind = 'blind' and s.event_id is null
         and s.started_at > since)
    when 'crush_links_per_30d' then
      (select count(*) from public.referral_invites r
       where r.inviter_id = p_user and r.is_crush and r.created_at > since)
    else
      (select count(*) from public.feature_uses u
       where u.user_id = p_user and u.feature_key = p_key and u.created_at > since)
  end;
end;
$$;

create function public.raise_plan_required(p_key text, p_hint text default 'feature')
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  raise exception 'Plan required: %', p_key using errcode = 'VP402', detail = p_key, hint = p_hint;
end;
$$;

create function public.assert_feature(p_user uuid, p_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_feature(p_user, p_key) then
    perform public.raise_plan_required(p_key, 'feature');
  end if;
end;
$$;

-- Whether one more use fits the quota (true for unlimited).
create function public.quota_left(p_user uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  lim int;
begin
  if not public.has_feature(p_user, p_key) then
    return false;
  end if;
  lim := public.feature_limit(p_user, p_key);
  return lim is null
    or public.feature_used(p_user, p_key, public.feature_period(p_user, p_key)) < lim;
end;
$$;

create function public.assert_quota(p_user uuid, p_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_feature(p_user, p_key);
  if not public.quota_left(p_user, p_key) then
    perform public.raise_plan_required(p_key, 'limit');
  end if;
end;
$$;

-- For quota features counted in feature_uses: checks and records one use.
create function public.consume_feature(p_user uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_quota(p_user, p_key);
  insert into public.feature_uses (user_id, feature_key) values (p_user, p_key);
end;
$$;

-- Incognito counts only while the user's plan includes it.
create function public.incognito_on(p_user uuid, p_flag boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_flag, false) and public.has_feature(p_user, 'incognito');
$$;

-- Adds a grant that starts when the user's last active grant of the same or a higher level ends
-- (now when there is none). p_days null = no end. Returns the new grant's ends_at.
create function public.grant_plan(
  p_user   uuid,
  p_plan   public.plan_level,
  p_days   int,
  p_source text,
  p_by     uuid default null,
  p_note   text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  start timestamptz;
  ends  timestamptz;
begin
  if p_plan is null or p_plan = 'free' then
    raise exception 'Invalid plan' using errcode = 'invalid_parameter_value';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then
    raise exception 'Invalid days' using errcode = 'invalid_parameter_value';
  end if;
  -- One grant at a time per user, so two stacking grants see each other.
  perform pg_advisory_xact_lock(hashtext('plan_grant:' || p_user::text));
  select greatest(now(), coalesce(max(g.ends_at), now())) into start
  from public.plan_grants g
  where g.user_id = p_user and g.revoked_at is null and g.plan >= p_plan
    and g.ends_at > now();
  -- An unlimited grant of that level is already running: the new one starts now (nothing to add).
  if exists (select 1 from public.plan_grants g
             where g.user_id = p_user and g.revoked_at is null and g.plan >= p_plan
               and g.ends_at is null and g.starts_at <= now()) then
    start := now();
  end if;
  ends := case when p_days is null then null else start + make_interval(days => p_days) end;
  insert into public.plan_grants (user_id, plan, source, starts_at, ends_at, granted_by, note)
  values (p_user, p_plan, p_source, start, ends, p_by, nullif(btrim(coalesce(p_note, '')), ''));
  return ends;
end;
$$;

-- Target id for moderation_actions rows about a matrix entry (target_id is a uuid).
create function public.plan_feature_uuid(p_key text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select md5('feature:' || p_key)::uuid;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'is_staff(uuid)', 'plan_of(uuid)', 'current_plan(uuid)', 'plan_until(uuid)',
    'has_feature(uuid, text)', 'feature_limit(uuid, text)', 'feature_period(uuid, text)',
    'period_interval(text)', 'feature_used(uuid, text, text)', 'raise_plan_required(text, text)',
    'assert_feature(uuid, text)', 'quota_left(uuid, text)', 'assert_quota(uuid, text)',
    'consume_feature(uuid, text)', 'incognito_on(uuid, boolean)',
    'grant_plan(uuid, public.plan_level, int, text, uuid, text)', 'plan_feature_uuid(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- =============================================================================================
-- The client's view: my_access()
-- =============================================================================================
-- {plan, is_staff, plan_until, boost_until,
--  features: {key: {on, min_plan, limit, period, used}}}  (limit null = unlimited; used only for
--  features with a limit). Null when signed out.
create function public.my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  feats jsonb;
begin
  if me is null then
    return null;
  end if;
  select coalesce(jsonb_object_agg(f.key, jsonb_build_object(
      'on', public.has_feature(me, f.key),
      'min_plan', f.min_plan,
      'limit', public.feature_limit(me, f.key),
      'period', public.feature_period(me, f.key),
      'used', case when public.feature_limit(me, f.key) is not null
                   then public.feature_used(me, f.key, public.feature_period(me, f.key)) end)),
    '{}'::jsonb)
  into feats
  from public.features f;
  return jsonb_build_object(
    'plan', public.current_plan(me),
    'is_staff', public.is_staff(me),
    'plan_until', public.plan_until(me),
    'boost_until', (select case when p.vip_boost_until > now() then p.vip_boost_until end
                    from public.profiles p where p.id = me),
    'features', feats);
end;
$$;

revoke execute on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- =============================================================================================
-- Boost: 30 minutes first in Discover (vip_boost_until, read by get_swipe_candidates), a quota
-- per plan (plus 1 per month, vip 1 per week). Returns the new boost end.
-- =============================================================================================
create function public.activate_boost()
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
  -- A running boost is not stacked: the button waits until it ends.
  select vip_boost_until into until from public.profiles where id = me;
  if until > now() then
    return until;
  end if;
  perform public.consume_feature(me, 'boost');
  update public.profiles set vip_boost_until = now() + interval '30 minutes'
  where id = me
  returning vip_boost_until into until;
  return until;
end;
$$;

revoke execute on function public.activate_boost() from public, anon;
grant execute on function public.activate_boost() to authenticated;

-- feature_uses older than the longest window are useless. Daily, with pg_cron (below).
create function public.purge_feature_uses()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from public.feature_uses where created_at < now() - interval '31 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.purge_feature_uses() from public, anon, authenticated;
grant execute on function public.purge_feature_uses() to service_role;

-- =============================================================================================
-- Gates on the write paths (triggers: they hold for every RPC and direct insert). They apply
-- only to the acting user's own rows (auth.uid()), so rows written on someone's behalf (a crush
-- match, a blind-date transcript copy, service-role scripts) are not blocked.
-- =============================================================================================

-- Discover likes per day.
create function public.swipes_plan_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction = 'like' and new.swiper_id = (select auth.uid()) then
    perform public.assert_quota(new.swiper_id, 'likes_per_day');
  end if;
  return new;
end;
$$;

create trigger swipes_plan_gate
  before insert on public.swipes
  for each row execute function public.swipes_plan_gate();

-- Chat media by kind. Runs after messages_check_insert (trigger order is by name), which has
-- normalised media_kind for old clients.
create function public.messages_plan_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.media_path is not null
     and new.sender_id = (select auth.uid())
     and coalesce(current_setting('vibely.blind_copy', true), '') <> 'on' then
    perform public.assert_feature(new.sender_id, case new.media_kind
      when 'voice' then 'voice_messages'
      when 'video' then 'video_messages'
      else 'chat_photos' end);
  end if;
  return new;
end;
$$;

create trigger messages_plan_gate
  before insert on public.messages
  for each row execute function public.messages_plan_gate();

-- Photos in Duo group chats.
create function public.group_messages_plan_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'image' and new.sender_id = (select auth.uid()) then
    perform public.assert_feature(new.sender_id, 'chat_photos');
  end if;
  return new;
end;
$$;

create trigger group_messages_plan_gate
  before insert on public.group_messages
  for each row execute function public.group_messages_plan_gate();

-- Feed: posts and comments need Plus, likes are free (still switchable in the matrix).
create function public.feed_plan_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Column names differ per table: read them through jsonb (a record has no optional fields).
  actor uuid := (to_jsonb(new) ->> case tg_table_name when 'post_likes' then 'user_id' else 'author_id' end)::uuid;
begin
  if actor = (select auth.uid()) then
    perform public.assert_feature(actor, case tg_table_name
      when 'posts' then 'feed_post'
      when 'comments' then 'feed_comment'
      else 'feed_like' end);
  end if;
  return new;
end;
$$;

create trigger posts_plan_gate before insert on public.posts
  for each row execute function public.feed_plan_gate();
create trigger comments_plan_gate before insert on public.comments
  for each row execute function public.feed_plan_gate();
create trigger post_likes_plan_gate before insert on public.post_likes
  for each row execute function public.feed_plan_gate();

-- Calls: the caller needs the feature to ring (and the callee must be able to pick up: hint
-- 'partner'), the callee needs it to answer.
create function public.calls_plan_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.caller_id = me then
      perform public.assert_feature(me, 'calls');
      if not public.has_feature(new.callee_id, 'calls') then
        perform public.raise_plan_required('calls', 'partner');
      end if;
    end if;
  elsif new.status = 'active' and old.status = 'ringing' and new.callee_id = me then
    perform public.assert_feature(me, 'calls');
  end if;
  return new;
end;
$$;

create trigger calls_plan_gate
  before insert or update of status on public.calls
  for each row execute function public.calls_plan_gate();

-- Incognito can be switched on only with the feature (switching off is always allowed).
create function public.profiles_incognito_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_incognito and not old.is_incognito and new.id = (select auth.uid()) then
    perform public.assert_feature(new.id, 'incognito');
  end if;
  return new;
end;
$$;

create trigger profiles_incognito_gate
  before update of is_incognito on public.profiles
  for each row execute function public.profiles_incognito_gate();

-- Crossed paths and Duo are free for all; the switch in the matrix still applies.
create function public.free_feature_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (to_jsonb(new) ->> case tg_table_name when 'duo_teams' then 'user_a' else 'user_id' end)::uuid;
begin
  if actor = (select auth.uid()) then
    perform public.assert_feature(actor, tg_argv[0]);
  end if;
  return new;
end;
$$;

create trigger crossed_paths_settings_plan_gate before insert on public.crossed_paths_settings
  for each row execute function public.free_feature_gate('crossed_paths');
create trigger duo_teams_plan_gate before insert on public.duo_teams
  for each row execute function public.free_feature_gate('duo');

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'swipes_plan_gate()', 'messages_plan_gate()', 'group_messages_plan_gate()', 'feed_plan_gate()',
    'calls_plan_gate()', 'profiles_incognito_gate()', 'free_feature_gate()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
end;
$$;

-- =============================================================================================
-- VIP compatibility: the badge, perks and my_vip() now derive from plans. profiles.vip_until is
-- kept (old rows, old clients) but no longer written.
-- =============================================================================================

-- Active VIP on vip_until becomes a legacy grant.
insert into public.plan_grants (user_id, plan, source, starts_at, ends_at, note)
select p.id, 'vip', 'legacy', now(), p.vip_until, 'profiles.vip_until'
from public.profiles p
where p.vip_until > now();

-- Same signatures as 20261009000230.
create or replace function public.is_vip(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_plan(p_user) = 'vip';
$$;

-- Old perk names map to features: see_likes = who_liked_you, queue_priority = event_priority.
create or replace function public.has_vip_perk(p_user uuid, p_perk text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_feature(p_user, case p_perk
    when 'see_likes' then 'who_liked_you'
    when 'queue_priority' then 'event_priority'
    else p_perk end);
$$;

create or replace function public.my_vip()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'is_vip', public.has_feature(p.id, 'vip_badge'),
    'vip_until', case when public.current_plan(p.id) = 'vip' then public.plan_until(p.id) end,
    'plan', public.current_plan(p.id),
    'plan_until', public.plan_until(p.id),
    'boost_until', case when p.vip_boost_until > now() then p.vip_boost_until end,
    'perks', jsonb_build_object(
      'see_likes', public.has_feature(p.id, 'who_liked_you'),
      'queue_priority', public.has_feature(p.id, 'event_priority')),
    'pending', (select count(*) from public.promo_redemptions r
                where r.user_id = p.id and r.granted_at is null))
  from public.profiles p
  where p.id = (select auth.uid());
$$;

-- Badge on cards: people whose plan shows the VIP badge.
create or replace function public.vip_ids(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.id = any (p_ids[1:200])
    and public.has_feature(p.id, 'vip_badge')
    and (p.id = (select auth.uid()) or public.can_view_profile(p.id));
$$;

-- =============================================================================================
-- Promo codes grant plans. benefits: {plan: 'plus'|'vip', days, boost_hours}. The old shape
-- ({vip_days, boost_hours, see_likes, queue_priority}) stays valid: vip_days = VIP for N days
-- (the flags are part of VIP now).
-- =============================================================================================
create or replace function public.promo_benefits_valid(b jsonb)
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
  if b - array['plan', 'days', 'vip_days', 'boost_hours', 'see_likes', 'queue_priority'] <> '{}'::jsonb then
    return false;
  end if;
  if (b ? 'plan' and (jsonb_typeof(b->'plan') <> 'string' or b->>'plan' not in ('plus', 'vip')))
     or (b ? 'days' and jsonb_typeof(b->'days') <> 'number')
     or (b ? 'vip_days' and jsonb_typeof(b->'vip_days') <> 'number')
     or (b ? 'boost_hours' and jsonb_typeof(b->'boost_hours') <> 'number')
     or (b ? 'see_likes' and jsonb_typeof(b->'see_likes') <> 'boolean')
     or (b ? 'queue_priority' and jsonb_typeof(b->'queue_priority') <> 'boolean') then
    return false;
  end if;
  -- One way to say the duration: plan + days, or the old vip_days.
  if b ? 'plan' and b ? 'vip_days' then
    return false;
  end if;
  if (b ? 'plan') <> (b ? 'days') then
    return false;
  end if;
  days  := coalesce((b->>'days')::numeric, (b->>'vip_days')::numeric, 0)::int;
  hours := coalesce((b->>'boost_hours')::numeric, 0)::int;
  if days < 0 or days > 3650 or hours < 0 or hours > 8760 then
    return false;
  end if;
  if b ? 'plan' and days < 1 then
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

-- Applies a benefits object: a plan grant (stacking, source 'promo') and the boost hours.
-- Same signature as 20261009000230; the returned keys keep vip_until/boost_until for old clients.
create or replace function public.promo_grant(p_user uuid, p_benefits jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  lvl   public.plan_level := coalesce(p_benefits ->> 'plan',
                                      case when coalesce((p_benefits ->> 'vip_days')::numeric, 0) > 0 then 'vip' end
                                     )::public.plan_level;
  days  int := coalesce((p_benefits ->> 'days')::numeric, (p_benefits ->> 'vip_days')::numeric, 0)::int;
  hours int := coalesce((p_benefits ->> 'boost_hours')::numeric, 0)::int;
  ends  timestamptz;
  boost timestamptz;
begin
  if lvl is not null and days > 0 then
    ends := public.grant_plan(p_user, lvl, days, 'promo', null, 'promo code');
  end if;
  update public.profiles
  set vip_boost_until = case when hours > 0
                             then greatest(coalesce(vip_boost_until, now()), now()) + make_interval(hours => hours)
                             else vip_boost_until end
  where id = p_user
  returning vip_boost_until into boost;
  return jsonb_build_object(
    'plan', lvl,
    'days', days,
    'plan_until', ends,
    'vip_until', case when lvl = 'vip' then ends end,
    'boost_until', case when boost > now() then boost end,
    'boost_hours', hours);
end;
$$;

-- The launch code: VIP for 90 days. Still inactive until the owner switches it on.
update public.promo_codes
set benefits = '{"plan": "vip", "days": 90}'::jsonb, updated_at = now()
where lower(code) = lower('XMUM_FIRST_100');

-- =============================================================================================
-- Admin (/admin/plans): admin role, every change logged (plan.*).
-- =============================================================================================

-- The matrix: [{key, name_ru, min_plan, enabled, note, sort, limits: {plan: {limit, period}}}]
create function public.admin_plan_matrix(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', f.key, 'name_ru', f.name_ru, 'min_plan', f.min_plan, 'enabled', f.enabled,
      'note', f.note, 'sort', f.sort,
      'limits', coalesce((
        select jsonb_object_agg(l.plan, jsonb_build_object('limit', l.limit_value, 'period', l.period))
        from public.plan_limits l where l.feature_key = f.key), '{}'::jsonb))
      order by f.sort, f.key)
    from public.features f), '[]'::jsonb);
end;
$$;

create function public.admin_set_feature(
  p_admin    uuid,
  p_key      text,
  p_enabled  boolean,
  p_min_plan public.plan_level,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.features;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  if p_enabled is null or p_min_plan is null then
    raise exception 'Invalid feature settings' using errcode = 'invalid_parameter_value';
  end if;
  update public.features
  set enabled = p_enabled, min_plan = p_min_plan,
      note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
  where key = p_key
  returning * into f;
  if f.key is null then
    raise exception 'Feature not found' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, 'plan.feature', 'feature', public.plan_feature_uuid(p_key),
    p_key || ' enabled=' || p_enabled::text || ' min_plan=' || p_min_plan::text);
end;
$$;

-- p_value null = unlimited; p_period null = no window (lifetime).
create function public.admin_set_limit(
  p_admin  uuid,
  p_key    text,
  p_plan   public.plan_level,
  p_value  int,
  p_period text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  if not exists (select 1 from public.features where key = p_key) then
    raise exception 'Feature not found' using errcode = 'no_data_found';
  end if;
  if p_plan is null or (p_value is not null and (p_value < 0 or p_value > 100000))
     or (p_period is not null and p_period not in ('day', 'week', 'month')) then
    raise exception 'Invalid limit' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.plan_limits (feature_key, plan, limit_value, period)
  values (p_key, p_plan, p_value, p_period)
  on conflict (feature_key, plan) do update
    set limit_value = excluded.limit_value, period = excluded.period, updated_at = now();
  perform public.log_moderation(p_admin, 'plan.limit', 'feature', public.plan_feature_uuid(p_key),
    p_key || ' ' || p_plan::text || '=' || coalesce(p_value::text, 'unlimited')
    || '/' || coalesce(p_period, 'total'));
end;
$$;

-- Grants a plan for p_days (null = no end), stacking like every grant. Returns the grant id.
create function public.admin_grant_plan(
  p_admin uuid,
  p_user  uuid,
  p_plan  public.plan_level,
  p_days  int,
  p_note  text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;
  perform public.grant_plan(p_user, p_plan, p_days, 'admin', p_admin, p_note);
  select id into gid from public.plan_grants
  where user_id = p_user and source = 'admin' order by created_at desc limit 1;
  perform public.log_moderation(p_admin, 'plan.grant', 'user', p_user,
    p_plan::text || ' ' || coalesce(p_days::text || 'd', 'unlimited')
    || coalesce(' ' || nullif(btrim(coalesce(p_note, '')), ''), ''));
  return gid;
end;
$$;

create function public.admin_revoke_grant(p_admin uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.plan_grants;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  update public.plan_grants set revoked_at = now(), revoked_by = p_admin
  where id = p_id and revoked_at is null
  returning * into g;
  if g.id is null then
    if not exists (select 1 from public.plan_grants where id = p_id) then
      raise exception 'Grant not found' using errcode = 'no_data_found';
    end if;
    return;
  end if;
  perform public.log_moderation(p_admin, 'plan.revoke', 'user', g.user_id,
    g.plan::text || ' ' || g.source || ' grant ' || g.id::text);
end;
$$;

-- A user's plan and grants (newest first).
create function public.admin_user_plan(p_admin uuid, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  return jsonb_build_object(
    'plan', public.plan_of(p_user),
    'is_staff', public.is_staff(p_user),
    'plan_until', public.plan_until(p_user),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'plan', g.plan, 'source', g.source, 'starts_at', g.starts_at,
        'ends_at', g.ends_at, 'note', g.note, 'revoked_at', g.revoked_at,
        'granted_by', g.granted_by, 'created_at', g.created_at,
        'active', g.revoked_at is null and g.starts_at <= now() and (g.ends_at is null or g.ends_at > now()))
        order by g.created_at desc)
      from public.plan_grants g where g.user_id = p_user), '[]'::jsonb));
end;
$$;

-- {by_plan: {free, plus, vip}, staff, by_source: [{source, active, total, last_30d}]}
-- by_plan counts profiles by their plan from grants (staff are counted at their grant level).
create function public.admin_plan_stats(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  per_plan jsonb;
  per_source jsonb;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  with active as (
    select g.user_id, max(g.plan) as plan
    from public.plan_grants g
    where g.revoked_at is null and g.starts_at <= now() and (g.ends_at is null or g.ends_at > now())
    group by g.user_id
  )
  select jsonb_build_object(
    'free', (select count(*) from public.profiles p where not exists (select 1 from active a where a.user_id = p.id)),
    'plus', (select count(*) from active where plan = 'plus'),
    'vip',  (select count(*) from active where plan = 'vip'))
  into per_plan;
  select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'active', s.active, 'total', s.total,
                                               'last_30d', s.recent) order by s.source), '[]'::jsonb)
  into per_source
  from (
    select g.source,
      count(*) filter (where g.revoked_at is null and g.starts_at <= now()
                       and (g.ends_at is null or g.ends_at > now())) as active,
      count(*) as total,
      count(*) filter (where g.created_at > now() - interval '30 days') as recent
    from public.plan_grants g
    group by g.source
  ) s;
  return jsonb_build_object(
    'by_plan', per_plan,
    'staff', (select count(*) from public.admins),
    'by_source', per_source);
end;
$$;

revoke execute on function public.admin_plan_matrix(uuid) from public, anon, authenticated;
revoke execute on function public.admin_set_feature(uuid, text, boolean, public.plan_level, text) from public, anon, authenticated;
revoke execute on function public.admin_set_limit(uuid, text, public.plan_level, int, text) from public, anon, authenticated;
revoke execute on function public.admin_grant_plan(uuid, uuid, public.plan_level, int, text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_grant(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_user_plan(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_plan_stats(uuid) from public, anon, authenticated;
grant execute on function public.admin_plan_matrix(uuid) to service_role;
grant execute on function public.admin_set_feature(uuid, text, boolean, public.plan_level, text) to service_role;
grant execute on function public.admin_set_limit(uuid, text, public.plan_level, int, text) to service_role;
grant execute on function public.admin_grant_plan(uuid, uuid, public.plan_level, int, text) to service_role;
grant execute on function public.admin_revoke_grant(uuid, uuid) to service_role;
grant execute on function public.admin_user_plan(uuid, uuid) to service_role;
grant execute on function public.admin_plan_stats(uuid) to service_role;

-- =============================================================================================
-- Remove the 24-hour Plans (20261009000200). Statuses keep their preset tag (plan_tag).
-- =============================================================================================
-- set_status: copied from 20261009000271 without the 24-hour plan (the preset is stored as the
-- status's plan_tag only) and with the matrix switch for statuses.

create or replace function public.set_status(p_emoji text, p_text text, p_plan_tag text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s  public.user_statuses;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(coalesce(p_text, '')), '') is null or nullif(btrim(coalesce(p_emoji, '')), '') is null then
    raise exception 'Status required' using errcode = 'invalid_parameter_value';
  end if;
  -- Like posts: banned people cannot post, muted people wait until the mute ends.
  if exists (select 1 from public.profiles where id = me and banned_at is not null) then
    raise exception 'Banned' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.profiles where id = me and muted_until > now()) then
    raise exception 'muted' using errcode = 'VS001';
  end if;
  perform public.assert_feature(me, 'statuses');
  -- Rate limit: at most 20 statuses per hour (edits included).
  if (select count(*) from public.user_statuses
      where user_id = me and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many statuses' using errcode = 'P0429';
  end if;

  update public.user_statuses set replaced_at = now() where user_id = me and replaced_at is null;
  insert into public.user_statuses (user_id, emoji, text, plan_tag)
  values (me, btrim(p_emoji), btrim(p_text), p_plan_tag)
  returning * into s;
  return public.status_json(s);
end;
$$;

drop function public.set_plan(text);
drop function public.clear_plan();

-- Discover: get_swipe_candidates copied from 20261009000230 (VIP boost first). The "Similar" sort
-- now uses statuses: people whose active, visible status has the same preset tag (plan_tag) as the
-- caller's active status come next. The candidate's 24-hour plan column is gone. The parameter
-- keeps its name (p_similar_plans) for compatibility.
drop function public.get_swipe_candidates(public.gender[], int, int, int, int, boolean);
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
  second_chance     boolean
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
    select s.plan_tag into my_plan from public.user_statuses s
    where s.user_id = me.id and s.replaced_at is null and s.expires_at > now()
      and s.moderation_state <> 'removed';
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
    c.second_chance
  from public.swipe_candidate_pool(me.id, p_genders, p_min_age, p_max_age, p_max_km) c
  join public.profiles p on p.id = c.id
  left join public.user_statuses pl
    on pl.user_id = p.id and pl.replaced_at is null and pl.expires_at > now()
   and pl.moderation_state = 'visible'
  order by coalesce(p.vip_boost_until > now(), false) desc, -- VIP boost (20261009000230)
           (my_plan is not null and pl.plan_tag is not distinct from my_plan) desc, -- similar statuses
           c.second_chance,
           p.last_active_at desc
  limit p_limit;
end;
$$;

revoke execute on function public.get_swipe_candidates(public.gender[], int, int, int, int, boolean) from public, anon;
grant execute on function public.get_swipe_candidates(public.gender[], int, int, int, int, boolean) to authenticated;

-- From 20261009000200, without the plans table (the cron job keeps its name).

create or replace function public.purge_crossed_paths()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.user_location_pings where seen_hour < now() - interval '48 hours';
  delete from public.crossed_paths
  where day < (now() at time zone 'Asia/Kuala_Lumpur')::date - 1;
end;
$$;

-- =============================================================================================
-- Incognito counts only while the plan includes it (public.incognito_on). Copied from their newest
-- definitions with that one change.
-- =============================================================================================
-- From 20261009000240.

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
    and not p.shadow_banned
    and p.gender = any (p_genders)
    and me.gender = any (p.interested_in)
    and public.age_in_years(p.birth_date) between p_min_age and p_max_age
    and (me.location is null or p.location is null
         or extensions.st_dwithin(me.location, p.location, p_max_km * 1000))
    and (s.swiper_id is null
         or (s.direction = 'pass' and s.created_at < now() - interval '14 days'))
    and not public.is_blocked_between(me.id, p.id)
    and (
      not public.incognito_on(p.id, p.is_incognito)
      or exists (
        select 1 from public.swipes l
        where l.swiper_id = p.id and l.swiped_id = me.id and l.direction = 'like'
      )
    );
$$;

-- From 20261009000240.

create or replace function public.incoming_like_ids()
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
    and not p.shadow_banned
    and not public.incognito_on(p.id, p.is_incognito)
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

-- From 20261009000240.

create or replace function public.search_profiles_by_username(q text, lim int default 20)
returns table (
  id           uuid,
  username     text,
  display_name text,
  age          int,
  city         text,
  photo        jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  term text := left(public.normalize_username(q), 40);
  uterm text;
  ulike text;
  nlike text;
begin
  if not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if char_length(term) < 2 then
    return;
  end if;
  lim := least(50, greatest(1, coalesce(lim, 20)));
  uterm := regexp_replace(term, '[^a-z0-9_.]', '', 'g');
  -- LIKE patterns with the wildcards of the input escaped (backslash is LIKE's default escape).
  ulike := replace(uterm, '_', '\_');
  nlike := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_');

  return query
  select
    p.id,
    p.username,
    p.display_name,
    public.age_in_years(p.birth_date),
    p.city,
    (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
     from public.profile_photos ph
     where ph.profile_id = p.id
     order by ph.position
     limit 1)
  from public.profiles p
  where p.id <> me
    and p.verification_status = 'approved'
    and p.is_active
    and p.banned_at is null
    and not p.shadow_banned
    and p.discoverable
    and p.searchable_by_username
    and not public.incognito_on(p.id, p.is_incognito)
    and (
      (char_length(uterm) >= 2 and p.username like ulike || '%')
      or (char_length(uterm) >= 3 and p.username like '%' || ulike || '%')
      or lower(p.display_name) like nlike || '%'
    )
    and not public.is_blocked_between(me, p.id)
  order by
    p.username = uterm desc,
    (char_length(uterm) >= 2 and p.username like ulike || '%') desc,
    p.last_active_at desc
  limit lim;
end;
$$;

-- From 20261009000240.

create or replace function public.get_crossed_paths()
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
    and not public.incognito_on(p.id, p.is_incognito)
    and p.gender = any (me.interested_in)
    and me.gender = any (p.interested_in)
    and not public.is_blocked_between(me.id, p.id)
    and not exists (
      select 1 from public.crossed_path_hides h where h.user_id = me.id and h.hidden_id = p.id
    )
  order by p.id, cp.day desc;
end;
$$;

-- From 20261009000240.

create or replace function public.compute_crossed_paths()
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
      and not public.incognito_on(p.id, p.is_incognito)
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

-- From 20261009000271.

create or replace function public.status_visible_to(p_viewer uuid, p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles p on p.id = p_user
    left join public.new_people_alerts mf on mf.user_id = me.id
    left join public.new_people_alerts pf on pf.user_id = p.id
    where me.id = p_viewer and p.id <> me.id
      and p.verification_status = 'approved'
      and p.is_active
      and p.discoverable
      and p.banned_at is null
      and not p.shadow_banned
      and not public.incognito_on(p.id, p.is_incognito)
      and p.gender = any (me.interested_in)
      and me.gender = any (p.interested_in)
      and public.age_in_years(p.birth_date) between coalesce(mf.min_age, 18) and coalesce(mf.max_age, 99)
      and public.age_in_years(me.birth_date) between coalesce(pf.min_age, 18) and coalesce(pf.max_age, 99)
      and (me.location is null or p.location is null
           or extensions.st_dwithin(me.location, p.location,
                least(coalesce(mf.max_km, 50), coalesce(pf.max_km, 50)) * 1000))
      and not public.is_blocked_between(me.id, p.id)
  );
$$;

-- =============================================================================================
-- "Who liked you": the list needs the who_liked_you feature (Plus). Without it the app shows the
-- count (count_incoming_likes, unchanged) with blurred placeholders and gets no rows here.
-- Copied from 20261008000088.
-- =============================================================================================

create or replace function public.get_incoming_likes(p_limit int default 50)
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
  where public.has_feature(me.id, 'who_liked_you')
  order by l.liked_at desc
  limit least(100, greatest(1, coalesce(p_limit, 50)));
$$;

-- =============================================================================================
-- Secret crush links per 30 days from the matrix (free 1, plus 3, vip 5): VP402
-- crush_links_per_30d instead of the fixed 'crush_limit'. Copied from 20261009000250.
-- =============================================================================================

create or replace function public.create_referral_invite(p_crush boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  new_code text;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_crush, false) then
    perform public.assert_quota(me, 'crush_links_per_30d');
  end if;
  if (
    select count(*) from public.referral_invites
    where inviter_id = me and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'invite_limit' using errcode = 'P0001';
  end if;

  loop
    new_code := substr(md5(gen_random_uuid()::text), 1, 8);
    -- Both code spaces share the ?ref= parameter, so a new invite never shadows a user code.
    continue when exists (select 1 from public.referral_codes rc where rc.code = new_code);
    begin
      insert into public.referral_invites (inviter_id, code, is_crush)
      values (me, new_code, coalesce(p_crush, false));
      return new_code;
    exception when unique_violation then
      -- Taken: try another one.
    end;
  end loop;
end;
$$;

-- =============================================================================================
-- Blind Dating: regular dates (kind 'blind', no event) per day from the matrix; people waiting in
-- the queue who are out of dates for today are not paired. In a Blind Dating Night, people whose
-- plan has event_priority are paired first. Copied from 20261009000220.
-- =============================================================================================

create or replace function public.randomizer_join(
  p_genders  public.gender[],
  p_min_age  int,
  p_max_age  int,
  p_tags     smallint[] default '{}',
  p_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        public.profiles;
  my_age    int;
  my_tags   smallint[];
  partner   uuid;
  v_session uuid;
  ev        public.scheduled_events;
begin
  select * into me from public.profiles where id = (select auth.uid());
  if me.id is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;

  my_age := public.age_in_years(me.birth_date);

  if p_event_id is not null then
    select * into ev from public.scheduled_events where id = p_event_id for update;
    if ev.id is null or public.event_effective_status(ev) <> 'live' then
      raise exception 'Event is not live' using errcode = 'no_data_found';
    end if;
    if ev.status = 'scheduled' then
      update public.scheduled_events set status = 'live', updated_at = now() where id = ev.id;
    end if;
    -- Relaxed filters: genders as chosen, a wide age band, no interest filter.
    p_min_age := greatest(18, my_age - 10);
    p_max_age := least(99, my_age + 10);
    p_tags := '{}';
  else
    p_min_age := greatest(18, p_min_age);
    p_max_age := least(99, greatest(p_min_age, p_max_age));
    p_tags := coalesce(p_tags[1:10], '{}');
  end if;
  select coalesce(array_agg(tag_id), '{}') into my_tags
  from public.profile_tags where profile_id = me.id;

  -- Serialize matchmaking: two users joining at once must see each other.
  perform pg_advisory_xact_lock(hashtext('randomizer_join'));

  select id into v_session from public.random_chat_sessions
  where status = 'active' and kind = 'blind' and me.id in (user_a, user_b);
  if v_session is not null then
    return v_session;
  end if;
  if p_event_id is null then
    perform public.assert_quota(me.id, 'blind_dating_per_day');
  end if;

  delete from public.random_chat_queue
  where user_id = me.id or last_seen_at < now() - interval '10 minutes';

  if p_event_id is not null then
    insert into public.event_participants (event_id, user_id, want_genders)
    values (p_event_id, me.id, p_genders)
    on conflict (event_id, user_id) do update set want_genders = excluded.want_genders;
  end if;

  -- Compatibility must hold both ways: each side fits the other's filters.
  select q.user_id into partner
  from public.random_chat_queue q
  join public.profiles p on p.id = q.user_id
  where q.last_seen_at > now() - interval '45 seconds'
    and q.event_id is not distinct from p_event_id
    and p.verification_status = 'approved'
    and p.is_active
    and p.gender = any (p_genders)
    and public.age_in_years(p.birth_date) between p_min_age and p_max_age
    and me.gender = any (q.want_genders)
    and my_age between q.min_age and q.max_age
    and (cardinality(p_tags) = 0 or exists (
          select 1 from public.profile_tags pt
          where pt.profile_id = p.id and pt.tag_id = any (p_tags)))
    and (cardinality(q.want_tags) = 0 or my_tags && q.want_tags)
    and not public.is_blocked_between(me.id, p.id)
    and (p_event_id is not null or public.quota_left(p.id, 'blind_dating_per_day'))
  order by (p_event_id is not null and public.has_feature(p.id, 'event_priority')) desc,
           q.enqueued_at
  limit 1;

  if partner is null then
    insert into public.random_chat_queue (user_id, want_genders, min_age, max_age, want_tags, event_id)
    values (me.id, p_genders, p_min_age, p_max_age, p_tags, p_event_id);
    return null;
  end if;

  delete from public.random_chat_queue where user_id = partner;
  insert into public.random_chat_sessions (user_a, user_b, kind, event_id)
  values (partner, me.id, 'blind', p_event_id)
  returning id into v_session;

  perform realtime.send(
    jsonb_build_object('session_id', v_session), 'paired', 'randomizer:' || partner::text, true);
  return v_session;
end;
$$;

-- =============================================================================================
-- Matchmaker reward: Plus for 7 days (a plan grant, source 'matchmaker') instead of VIP days.
-- Copied from 20261009000240.
-- =============================================================================================

create or replace function public.decide_referral(p_id uuid, p_interested boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  r        public.matchmaker_referrals;
  side     text;
  ac       uuid;
  v_match  uuid;
  reward   boolean := false;
  mm_name  text;
  b_name   text;
  c_name   text;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.matchmaker_referrals where id = p_id for update;
  if r.id is null then
    raise exception 'Not found' using errcode = 'VM003';
  end if;
  side := case when me = r.user_b then 'b' when me = r.user_c then 'c' end;
  if side is null or (side = 'c' and not coalesce(r.decision_b, false)) then
    raise exception 'Not available' using errcode = 'VM002';
  end if;
  if r.status <> 'pending' then
    return jsonb_build_object(
      'state', case when r.status = 'matched' then 'matched' else 'closed' end,
      'match_id', case when r.status = 'matched' then r.match_id end
    );
  end if;
  if (side = 'b' and r.decision_b is not null) or (side = 'c' and r.decision_c is not null) then
    raise exception 'Already decided' using errcode = 'VM002';
  end if;

  -- A block since the introduction cancels it (the trigger below covers the usual path).
  if public.is_blocked_between(r.matchmaker_id, r.user_b)
     or public.is_blocked_between(r.matchmaker_id, r.user_c)
     or public.is_blocked_between(r.user_b, r.user_c) then
    update public.matchmaker_referrals set status = 'cancelled' where id = r.id;
    return jsonb_build_object('state', 'closed');
  end if;

  if not coalesce(p_interested, false) then
    update public.matchmaker_referrals
    set status = side || '_declined',
        decision_b = case when side = 'b' then false else decision_b end,
        decision_c = case when side = 'c' then false else decision_c end
    where id = r.id;
    return jsonb_build_object('state', 'closed');
  end if;

  select display_name into mm_name from public.profiles where id = r.matchmaker_id;

  if side = 'b' then
    select id into ac from public.matches
    where user_a = least(r.matchmaker_id, r.user_c) and user_b = greatest(r.matchmaker_id, r.user_c);
    if ac is null then
      update public.matchmaker_referrals set status = 'cancelled' where id = r.id;
      return jsonb_build_object('state', 'closed');
    end if;
    update public.matchmaker_referrals set decision_b = true where id = r.id;
    -- C learns about the introduction only now: the card goes into the A-C chat. Written on
    -- A's behalf, so A's own message triggers (rate limit, mute) are skipped like the blind-date
    -- transcript copy.
    perform set_config('vibely.blind_copy', 'on', true);
    insert into public.messages (match_id, sender_id, kind, payload)
    values (ac, r.matchmaker_id, 'referral', jsonb_build_object('referral_id', r.id));
    perform set_config('vibely.blind_copy', '', true);
    return jsonb_build_object(
      'state', 'interested',
      'notify', jsonb_build_object('user_id', r.user_c, 'match_id', ac, 'matchmaker_name', mm_name)
    );
  end if;

  -- Both interested: the regular match path (the pair may have matched meanwhile: reused).
  v_match := public.ensure_match(r.user_b, r.user_c, 'matchmaker');
  if r.note is not null then
    perform set_config('vibely.blind_copy', 'on', true);
    insert into public.messages (match_id, sender_id, kind, payload, body, read_at)
    values (v_match, r.matchmaker_id, 'system', jsonb_build_object('referral_id', r.id), r.note, now());
    perform set_config('vibely.blind_copy', '', true);
  end if;
  reward := not exists (
    select 1 from public.matchmaker_referrals x
    where x.matchmaker_id = r.matchmaker_id and x.rewarded_at > now() - interval '7 days'
  );
  if reward then
    perform public.grant_plan(r.matchmaker_id, 'plus', 7, 'matchmaker', null,
      'matchmaker referral ' || r.id::text);
  end if;
  update public.matchmaker_referrals
  set decision_c = true, status = 'matched', match_id = v_match,
      rewarded_at = case when reward then now() end
  where id = r.id;
  select display_name into b_name from public.profiles where id = r.user_b;
  select display_name into c_name from public.profiles where id = r.user_c;
  return jsonb_build_object(
    'state', 'matched',
    'match_id', v_match,
    'just_matched', true,
    'notify', jsonb_build_object(
      'matchmaker_id', r.matchmaker_id, 'matchmaker_name', mm_name,
      'b_id', r.user_b, 'b_name', b_name,
      'c_id', r.user_c, 'c_name', c_name
    )
  );
end;
$$;

-- The intents table goes last (nothing reads it any more).
drop table public.user_plans;

-- =============================================================================================
-- Schedules
-- =============================================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-feature-uses', '41 3 * * *', 'select public.purge_feature_uses()');
  end if;
end;
$$;
