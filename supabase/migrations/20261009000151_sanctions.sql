-- Sanctions (batch-4): warnings, temporary bans, mutes and shadow-bans.
--
--   * Warnings: public.user_warnings. The user sees each active warning once and acknowledges it.
--   * Temporary ban: profiles.banned_until (null = permanent while banned_at is set). An expired ban
--     is lifted by the profiles_enforce_ban trigger on the next write to the row (the app touches it
--     when a banned user opens Vibely, see my_ban_status()) and by lift_expired_sanctions(), run by
--     pg_cron every 10 minutes and by the daily retention job.
--   * Mute: profiles.muted_until blocks sending chat messages, random chat messages, posts and
--     comments (BEFORE INSERT triggers below, SQLSTATE VS001).
--   * Shadow-ban: profiles.shadow_banned hides the user's posts, comments and swipe card from
--     everyone else; the user still sees their own content (feed views copied from 20261009000140,
--     the Discover pool from 20261008000130, incoming likes from 20261008000088, search from
--     20261009000140).
--   * A ban ends the user's random chats and live calls and deletes their auth sessions (refresh
--     tokens), so every device is signed out once its access token expires (at most 1 hour); the
--     app sends a banned user to /banned on the next request anyway.
-- None of these columns is readable by clients except banned_until (like banned_at: a banned
-- profile is inactive, so nobody else can see it).

alter table public.profiles
  add column banned_until  timestamptz,
  add column muted_until   timestamptz,
  add column mute_reason   text check (char_length(mute_reason) <= 500),
  add column shadow_banned boolean not null default false;

create index profiles_banned_until_idx on public.profiles (banned_until) where banned_until is not null;
create index profiles_muted_until_idx on public.profiles (muted_until) where muted_until is not null;

grant select (banned_until) on public.profiles to authenticated;

-- Copied from 20261008000015 and extended: an expired temporary ban is lifted (and logged as
-- auto.unban) instead of keeping the profile inactive. SECURITY DEFINER for the log insert, since
-- the row may be written by its owner.
create or replace function public.profiles_enforce_ban()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.banned_at is not null and new.banned_until is not null and new.banned_until <= now() then
    if tg_op = 'UPDATE' and old.banned_at is not null then
      insert into public.moderation_actions (admin_id, action, target_type, target_id, reason)
      values (null, 'auto.unban', 'user', new.id, 'Срок блокировки истёк');
      new.is_active := true;
    end if;
    new.banned_at := null;
    new.ban_reason := null;
  end if;
  if new.banned_at is null then
    new.banned_until := null;
  else
    new.is_active := false;
  end if;
  if new.muted_until is not null and new.muted_until <= now() then
    new.muted_until := null;
    new.mute_reason := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_enforce_ban() from public, anon, authenticated;

-- Lifts every expired temporary ban and mute. Returns the number of lifted bans.
create function public.lift_expired_sanctions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  -- The no-op assignment fires profiles_enforce_ban, which does the actual lift.
  update public.profiles set banned_until = banned_until
  where banned_at is not null and banned_until <= now();
  get diagnostics n = row_count;
  update public.profiles set muted_until = muted_until where muted_until <= now();
  return n;
end;
$$;

-- On-read check for the signed-in user: lifts their own expired ban first.
create function public.my_ban_status()
returns table (banned_at timestamptz, ban_reason text, banned_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  update public.profiles p set banned_until = p.banned_until
  where p.id = me and p.banned_at is not null and p.banned_until <= now();
  return query select p.banned_at, p.ban_reason, p.banned_until from public.profiles p where p.id = me;
end;
$$;

revoke execute on function public.lift_expired_sanctions() from public, anon, authenticated;
grant execute on function public.lift_expired_sanctions() to service_role;
revoke execute on function public.my_ban_status() from public, anon;
grant execute on function public.my_ban_status() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Warnings

create table public.user_warnings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  -- A ban reason code ("code" or "code: note", src/features/safety/reason-codes.ts): shown to the
  -- user translated.
  reason          text not null check (char_length(reason) between 3 and 500),
  -- Internal note for moderators, never shown to the user.
  note            text check (char_length(note) <= 1000),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  acknowledged_at timestamptz,
  revoked_at      timestamptz,
  check (expires_at > created_at)
);

create index user_warnings_user_idx on public.user_warnings (user_id, created_at desc);

alter table public.user_warnings enable row level security;
revoke all on public.user_warnings from anon, authenticated;

-- What the signed-in user must be told about: an active mute and unacknowledged active warnings.
create function public.my_sanctions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'muted_until', (select case when p.muted_until > now() then p.muted_until end
                    from public.profiles p where p.id = (select auth.uid())),
    'mute_reason', (select case when p.muted_until > now() then p.mute_reason end
                    from public.profiles p where p.id = (select auth.uid())),
    'warnings', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'reason', w.reason,
        'created_at', w.created_at, 'expires_at', w.expires_at) order by w.created_at)
      from public.user_warnings w
      where w.user_id = (select auth.uid())
        and w.acknowledged_at is null and w.revoked_at is null and w.expires_at > now()
    ), '[]'::jsonb)
  );
$$;

create function public.acknowledge_warning(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_warnings set acknowledged_at = now()
  where id = p_id and user_id = (select auth.uid()) and acknowledged_at is null;
$$;

revoke execute on function public.my_sanctions() from public, anon;
revoke execute on function public.acknowledge_warning(uuid) from public, anon;
grant execute on function public.my_sanctions() to authenticated;
grant execute on function public.acknowledge_warning(uuid) to authenticated;

create function public.admin_warn_user(
  p_admin uuid, p_user uuid, p_reason text, p_note text default null, p_days int default 30
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  w uuid;
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Warning reason required' using errcode = 'check_violation';
  end if;
  if p_days is null or p_days not between 1 and 365 then
    raise exception 'Warning lasts 1..365 days' using errcode = 'check_violation';
  end if;
  insert into public.user_warnings (user_id, reason, note, created_by, expires_at)
  values (p_user, btrim(p_reason), nullif(btrim(p_note), ''), p_admin, now() + make_interval(days => p_days))
  returning id into w;
  perform public.log_moderation(p_admin, 'user.warn', 'user', p_user,
    btrim(p_reason) || coalesce(' · ' || nullif(btrim(p_note), ''), ''));
  return w;
end;
$$;

create function public.admin_revoke_warning(p_admin uuid, p_warning uuid, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  update public.user_warnings set revoked_at = now()
  where id = p_warning and revoked_at is null
  returning user_id into target;
  if target is null then
    raise exception 'Warning not found' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, 'warning.revoke', 'user', target, p_reason);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Mutes

create function public.admin_set_mute(p_admin uuid, p_user uuid, p_hours int, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  if coalesce(p_hours, 0) = 0 then
    update public.profiles set muted_until = null, mute_reason = null where id = p_user;
  else
    if p_hours not between 1 and 720 then
      raise exception 'A mute lasts 1..720 hours' using errcode = 'check_violation';
    end if;
    if nullif(btrim(p_reason), '') is null then
      raise exception 'Mute reason required' using errcode = 'check_violation';
    end if;
    update public.profiles
    set muted_until = now() + make_interval(hours => p_hours), mute_reason = btrim(p_reason)
    where id = p_user;
  end if;
  if not found then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, case when coalesce(p_hours, 0) = 0 then 'user.unmute' else 'user.mute' end,
    'user', p_user, case when coalesce(p_hours, 0) = 0 then p_reason else btrim(p_reason) || ' (' || p_hours || ' ч)' end);
end;
$$;

-- BEFORE INSERT on every table a user writes content into. tg_argv[0]: the column of the author.
create function public.enforce_not_muted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if exists (select 1 from public.profiles where id = actor and muted_until > now()) then
    raise exception 'muted' using errcode = 'VS001';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_not_muted() from public, anon, authenticated;

create trigger messages_enforce_not_muted
  before insert on public.messages
  for each row execute function public.enforce_not_muted('sender_id');
create trigger random_chat_messages_enforce_not_muted
  before insert on public.random_chat_messages
  for each row execute function public.enforce_not_muted('sender_id');
create trigger posts_enforce_not_muted
  before insert on public.posts
  for each row execute function public.enforce_not_muted('author_id');
create trigger comments_enforce_not_muted
  before insert on public.comments
  for each row execute function public.enforce_not_muted('author_id');

-- ---------------------------------------------------------------------------------------------
-- Bans

-- Ends everything live for a banned user and signs them out. Returns the ids of the calls it
-- ended, so the server can also close their LiveKit rooms.
create function public.end_user_activity(p_user uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended uuid[] := '{}';
  c uuid;
begin
  delete from public.random_chat_queue where user_id = p_user;
  update public.random_chat_sessions set status = 'ended', ended_at = now()
  where status = 'active' and p_user in (user_a, user_b);

  for c in
    select id from public.calls where status in ('ringing', 'active') and p_user in (caller_id, callee_id)
  loop
    perform public.finish_call(c);
    ended := ended || c;
  end loop;

  -- Supabase Auth: deleting the sessions revokes their refresh tokens (cascade). The table exists
  -- only on Supabase, not in the local test database.
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_user;
  end if;
  return ended;
end;
$$;

-- Bans a user: p_days null = permanent (admin), 1..7 days (moderator), 8..365 days (admin).
create function public.admin_ban_user(p_admin uuid, p_user uuid, p_reason text, p_days int default null)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_days is not null and p_days not between 1 and 365 then
    raise exception 'A temporary ban lasts 1..365 days' using errcode = 'check_violation';
  end if;
  perform public.assert_admin_role(p_admin,
    case when p_days between 1 and 7 then 'moderator' else 'admin' end::public.admin_role);
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Ban reason required' using errcode = 'check_violation';
  end if;
  -- A moderator must not turn a permanent or longer ban into a short one.
  if public.admin_role_of(p_admin) < 'admin' and exists (
    select 1 from public.profiles
    where id = p_user and banned_at is not null
      and (banned_until is null or banned_until > now() + make_interval(days => p_days))
  ) then
    raise exception 'Only an admin can shorten an existing ban' using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
  set banned_at = now(),
      ban_reason = btrim(p_reason),
      banned_until = case when p_days is not null then now() + make_interval(days => p_days) end,
      is_active = false
  where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;

  perform public.log_moderation(p_admin, case when p_days is null then 'user.ban' else 'user.temp_ban' end,
    'user', p_user, btrim(p_reason) || coalesce(' (' || p_days || ' дн.)', ''));
  return public.end_user_activity(p_user);
end;
$$;

create function public.admin_unban_user(p_admin uuid, p_user uuid, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  update public.profiles
  set banned_at = null, ban_reason = null, banned_until = null, is_active = true
  where id = p_user and banned_at is not null;
  if not found then
    raise exception 'User is not banned' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, 'user.unban', 'user', p_user, p_reason);
end;
$$;

-- The original RPC (20261008000016) stays for existing callers: a permanent ban or an unban, both
-- admin decisions now, with the same side effects as admin_ban_user.
create or replace function public.admin_set_ban(p_admin uuid, p_user uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_banned then
    perform public.admin_ban_user(p_admin, p_user, p_reason, null);
  else
    perform public.admin_unban_user(p_admin, p_user, p_reason);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Shadow-ban

create function public.admin_set_shadow_ban(p_admin uuid, p_user uuid, p_on boolean, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  update public.profiles set shadow_banned = p_on where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, case when p_on then 'user.shadow_ban' else 'user.shadow_unban' end,
    'user', p_user, p_reason);
end;
$$;

-- Feed views: copied from 20261009000140; a shadow-banned author's posts and comments are visible
-- only to that author.
create or replace view public.feed_posts as
select
  p.id,
  p.body,
  p.likes_count,
  p.comments_count,
  p.created_at,
  p.author_id = (select auth.uid()) as is_mine,
  exists (
    select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())
  ) as is_liked_by_me,
  a.visible as is_named,
  case when a.visible then p.author_id end as author_id,
  case when a.visible then pr.display_name end as author_name,
  case when a.visible then public.age_in_years(pr.birth_date) end as author_age,
  case when a.visible then pr.verification_status = 'approved' end as author_verified,
  case when a.visible then ph.storage_path end as author_photo_path,
  case when not a.visible then ps.v[1] end as anon_adj,
  case when not a.visible then ps.v[2] end as anon_noun,
  case when not a.visible then ps.v[3] end as anon_color,
  -- Only the match is exposed, never the author's city.
  coalesce(nullif(lower(btrim(pr.city)), '') = public.feed_viewer_city(), false) as same_city,
  p.likes_count + p.comments_count as engagement,
  case when a.visible then pr.username end as author_username
from public.posts p
join public.profiles pr on pr.id = p.author_id
cross join lateral (
  select p.is_named and public.can_view_profile(p.author_id) as visible
) a
cross join lateral (select public.feed_pseudonym(p.id, 0) as v) ps
left join lateral (
  select f.storage_path from public.profile_photos f
  where f.profile_id = p.author_id and a.visible
  order by f.position
  limit 1
) ph on true
where not p.is_hidden and public.is_verified()
  and (not pr.shadow_banned or p.author_id = (select auth.uid()));

create or replace view public.post_comments as
select
  c.id,
  c.post_id,
  c.body,
  -- A named comment hides its alias: otherwise it would unmask the same person's anonymous
  -- comments in the thread. It is marked as the OP's only when the post itself shows the author.
  case when not a.visible then c.alias_no end as alias_no,
  c.alias_no = 0 and (not a.visible or (p.is_named and public.can_view_profile(p.author_id))) as is_op,
  c.author_id = (select auth.uid()) as is_mine,
  c.created_at,
  a.visible as is_named,
  case when a.visible then c.author_id end as author_id,
  case when a.visible then pr.display_name end as author_name,
  case when a.visible then public.age_in_years(pr.birth_date) end as author_age,
  case when a.visible then pr.verification_status = 'approved' end as author_verified,
  case when a.visible then ph.storage_path end as author_photo_path,
  case when not a.visible then ps.v[1] end as anon_adj,
  case when not a.visible then ps.v[2] end as anon_noun,
  case when not a.visible then ps.v[3] end as anon_color,
  case when a.visible then pr.username end as author_username
from public.comments c
join public.posts p on p.id = c.post_id
join public.profiles pr on pr.id = c.author_id
cross join lateral (
  select c.is_named and public.can_view_profile(c.author_id) as visible
) a
cross join lateral (select public.feed_pseudonym(c.post_id, c.alias_no) as v) ps
left join lateral (
  select f.storage_path from public.profile_photos f
  where f.profile_id = c.author_id and a.visible
  order by f.position
  limit 1
) ph on true
where not c.is_hidden and not p.is_hidden and public.is_verified()
  and (not pr.shadow_banned or c.author_id = (select auth.uid()));

revoke all on public.feed_posts, public.post_comments from anon, authenticated;
grant select on public.feed_posts, public.post_comments to authenticated;

-- Discover pool: copied from 20261008000130, without shadow-banned people.
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
    and not public.is_blocked_between(me.id, p.id);
$$;

-- "Who liked you": copied from 20261008000088, without shadow-banned likers.
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

-- People search: copied from 20261009000140, without shadow-banned people.
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

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_warn_user(uuid, uuid, text, text, int)',
    'admin_revoke_warning(uuid, uuid, text)',
    'admin_set_mute(uuid, uuid, int, text)',
    'end_user_activity(uuid)',
    'admin_ban_user(uuid, uuid, text, int)',
    'admin_unban_user(uuid, uuid, text)',
    'admin_set_shadow_ban(uuid, uuid, boolean, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- Every 10 minutes where pg_cron exists (Supabase; not the local test database). The daily
-- retention job (POST /api/cron/retention) calls it too.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('lift-expired-sanctions', '*/10 * * * *',
      'select public.lift_expired_sanctions()');
  end if;
end;
$$;
