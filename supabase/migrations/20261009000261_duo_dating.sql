-- Duo Dating: two verified friends form a duo, browse other duos in a "Duo" deck, and a mutual
-- duo like opens a 4-person group chat (text and photos only, no calls).
--
--   * duo_teams     one team per pair of friends: invited by @username or by invite link; status
--                   pending (invite out) -> active (accepted) -> dissolved (either member leaves,
--                   a ban, a block between the two). One active team per user.
--   * duo profile   both main photos, names and ages come from the profiles; the duo bio (<= 120
--                   characters) runs through the SQL risk detector (20261009000163): a suspicious
--                   bio is held (bio_status = 'held') and not shown to other duos until a moderator
--                   approves it.
--   * duo deck      get_duo_candidates(): active duos compatible both ways (each member of X fits
--                   at least one member of Y by interested_in and the other team's age range, and
--                   vice versa; the leaders' locations are within both teams' distance), without
--                   blocked pairs, banned, shadow-banned, incognito or paused members.
--   * team like     either member likes or passes a duo for the whole team (duo_likes). The
--                   partner is told who liked and can undo within 1 hour. Mutual likes create a
--                   duo match at once: duo_matches + group_chats + 4 group_members.
--   * group chat    group_messages: text and photos (chat-media/<group id>/<uuid>.webp), realtime
--                   over the private topic group:<id> (postgres_changes, current members only) and
--                   group-typing:<id> (writable). Rate limited, mute checked and risk flagged like
--                   match messages. Leaving keeps the chat for the others (a system message is
--                   added); blocking a member removes the blocker from their shared groups; a ban
--                   removes the user from every group and dissolves their duo.
--   * reports       'group_message' and 'group_member' (20261009000260). Moderators read a group
--                   transcript only while handling an open report, and every access is logged
--                   (admin_open_group_transcript / admin_open_group_media).
--   * retention     CLAUDE.md: messages stay while the group exists, photos are purged after 90
--                   days (retention_group_media), dissolved teams and decided likes after 90 days
--                   (purge_old_duo_data), all except material under an open report or an evidence
--                   hold. report_is_personal and retention_orphan_chat_media are redefined here.

-- ---------------------------------------------------------------------------------------------
-- Columns on existing tables
-- ---------------------------------------------------------------------------------------------
-- Incognito arrives from another branch (feature/matchmaker-incognito); either order works.
alter table public.profiles add column if not exists is_incognito boolean not null default false;

-- Push preference "Duo dating": invites, partner likes, duo matches and group messages.
alter table public.notification_prefs add column duo boolean not null default true;
grant insert (duo), update (duo) on public.notification_prefs to authenticated;

-- Risk flags of group messages (20261009000163).
alter table public.message_flags drop constraint message_flags_source_check;
alter table public.message_flags
  add constraint message_flags_source_check check (source in ('chat', 'random', 'group'));

-- ---------------------------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------------------------
create table public.duo_teams (
  id              uuid primary key default gen_random_uuid(),
  -- The leader: created the team; distance between duos is measured from the leaders.
  user_a          uuid not null references public.profiles (id) on delete cascade,
  -- The invited friend; null while an invite link is open to anyone.
  user_b          uuid references public.profiles (id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'active', 'dissolved')),
  invite_code     text unique check (invite_code ~ '^[a-z0-9]{8}$'),
  bio             text check (char_length(bio) <= 120),
  bio_status      text not null default 'ok' check (bio_status in ('ok', 'held')),
  min_age         smallint not null default 18 check (min_age between 18 and 99),
  max_age         smallint not null default 45 check (max_age between 18 and 99),
  max_km          smallint not null default 50 check (max_km between 1 and 300),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  dissolved_at    timestamptz,
  dissolve_reason text check (dissolve_reason in ('left', 'declined', 'cancelled', 'ban', 'block', 'accepted_other')),
  check (min_age <= max_age),
  check (user_b is null or user_a <> user_b),
  check (status <> 'active' or (user_b is not null and accepted_at is not null)),
  check (status <> 'dissolved' or dissolved_at is not null)
);

-- One open (pending or active) team per leader, one active team per invited friend.
create unique index duo_teams_leader_open_idx on public.duo_teams (user_a) where status <> 'dissolved';
create unique index duo_teams_member_active_idx on public.duo_teams (user_b) where status = 'active';
create index duo_teams_invitee_idx on public.duo_teams (user_b) where status = 'pending';
create index duo_teams_held_idx on public.duo_teams (created_at) where bio_status = 'held' and status = 'active';

-- Decisions of a team about another team. One row per pair; undo deletes it.
create table public.duo_likes (
  team_id        uuid not null references public.duo_teams (id) on delete cascade,
  target_team_id uuid not null references public.duo_teams (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  direction      public.swipe_direction not null,
  created_at     timestamptz not null default now(),
  primary key (team_id, target_team_id),
  check (team_id <> target_team_id)
);

create index duo_likes_target_idx on public.duo_likes (target_team_id) where direction = 'like';
create index duo_likes_created_idx on public.duo_likes (created_at);

create table public.group_chats (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.duo_matches (
  id         uuid primary key default gen_random_uuid(),
  team_a     uuid not null references public.duo_teams (id) on delete cascade,
  team_b     uuid not null references public.duo_teams (id) on delete cascade,
  -- The group chat; null once everyone left it (the chat is then deleted).
  group_id   uuid references public.group_chats (id) on delete set null,
  created_at timestamptz not null default now(),
  check (team_a < team_b),
  unique (team_a, team_b)
);

create index duo_matches_team_b_idx on public.duo_matches (team_b);

-- Membership history: a row stays (left_at set) after leaving, so reports and evidence keep
-- working; access checks use left_at is null.
create table public.group_members (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.group_chats (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  team_id      uuid references public.duo_teams (id) on delete set null,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  left_reason  text check (left_reason in ('left', 'block', 'ban')),
  last_read_at timestamptz,
  unique (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id) where left_at is null;

create table public.group_messages (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.group_chats (id) on delete cascade,
  -- null: a system message (someone joined or left)
  sender_id        uuid default auth.uid() references public.profiles (id) on delete cascade,
  kind             text not null default 'text' check (kind in ('text', 'image', 'system')),
  body             text check (char_length(body) between 1 and 2000),
  -- chat-media object "<group id>/<uuid>.webp"; null once purged (media_expired_at set)
  media_path       text,
  image_width      int check (image_width > 0),
  image_height     int check (image_height > 0),
  media_expired_at timestamptz,
  system_event     text check (system_event in ('matched', 'left', 'removed')),
  about_user       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (
    case kind
      when 'text' then sender_id is not null and body is not null and media_path is null
        and media_expired_at is null and system_event is null
      when 'image' then sender_id is not null and image_width is not null and image_height is not null
        and (media_path is not null or media_expired_at is not null) and system_event is null
      else sender_id is null and body is null and media_path is null and system_event is not null
    end
  ),
  check (
    media_path is null
    or media_path ~ ('^' || group_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
  )
);

create index group_messages_group_created_idx on public.group_messages (group_id, created_at desc);
create index group_messages_sender_recent_idx on public.group_messages (sender_id, created_at desc);
create unique index group_messages_media_path_key on public.group_messages (media_path)
  where media_path is not null;
create index group_messages_media_created_idx on public.group_messages (created_at)
  where media_path is not null;

alter table public.duo_teams enable row level security;
alter table public.duo_likes enable row level security;
alter table public.duo_matches enable row level security;
alter table public.group_chats enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

revoke all on public.duo_teams, public.duo_likes, public.duo_matches, public.group_chats,
  public.group_members, public.group_messages from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
-- The caller is a current member of the group (left members lose access at once).
create function public.is_group_member(g uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = g and user_id = (select auth.uid()) and left_at is null
  );
$$;

-- A member who can be shown to other duos.
create function public.duo_member_visible(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.verification_status = 'approved'
      and p.is_active
      and p.banned_at is null
      and not p.shadow_banned
      and p.discoverable
      and not p.is_incognito
  );
$$;

-- One member of X fits one member of Y: mutual interest, each inside the other team's age range.
create function public.duo_pair_ok(p_x uuid, p_y uuid, x_min int, x_max int, y_min int, y_max int)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles px
    join public.profiles py on py.id = p_y
    where px.id = p_x
      and py.gender = any (px.interested_in)
      and px.gender = any (py.interested_in)
      and public.age_in_years(py.birth_date) between x_min and x_max
      and public.age_in_years(px.birth_date) between y_min and y_max
  );
$$;

-- Both ways: every member of X fits someone in Y and every member of Y fits someone in X; the
-- leaders are within both teams' distance (unknown location: allowed, as in Discover); no block
-- between any member of X and any member of Y.
create function public.duo_teams_compatible(x public.duo_teams, y public.duo_teams)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  aa boolean := public.duo_pair_ok(x.user_a, y.user_a, x.min_age, x.max_age, y.min_age, y.max_age);
  ab boolean := public.duo_pair_ok(x.user_a, y.user_b, x.min_age, x.max_age, y.min_age, y.max_age);
  ba boolean := public.duo_pair_ok(x.user_b, y.user_a, x.min_age, x.max_age, y.min_age, y.max_age);
  bb boolean := public.duo_pair_ok(x.user_b, y.user_b, x.min_age, x.max_age, y.min_age, y.max_age);
begin
  if x.user_b is null or y.user_b is null then
    return false;
  end if;
  if not ((aa or ab) and (ba or bb) and (aa or ba) and (ab or bb)) then
    return false;
  end if;
  if public.is_blocked_between(x.user_a, y.user_a) or public.is_blocked_between(x.user_a, y.user_b)
     or public.is_blocked_between(x.user_b, y.user_a) or public.is_blocked_between(x.user_b, y.user_b) then
    return false;
  end if;
  return exists (
    select 1
    from public.profiles la
    join public.profiles lb on lb.id = y.user_a
    where la.id = x.user_a
      and (la.location is null or lb.location is null
           or extensions.st_dwithin(la.location, lb.location, least(x.max_km, y.max_km) * 1000))
  );
end;
$$;

-- Rounded distance between the leaders of two teams, in km (null when unknown).
create function public.duo_distance_km(x uuid, y uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when la.location is null or lb.location is null then null
              else ceil(extensions.st_distance(la.location, lb.location) / 1000)::int end
  from public.duo_teams tx
  join public.duo_teams ty on ty.id = y
  join public.profiles la on la.id = tx.user_a
  join public.profiles lb on lb.id = ty.user_a
  where tx.id = x;
$$;

-- Public card data of one person (main photo as a storage path: the app signs it).
create function public.duo_person_json(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'age', public.age_in_years(p.birth_date),
    'city', p.city,
    'photo', (
      select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
      from public.profile_photos ph where ph.profile_id = p.id order by ph.position limit 1))
  from public.profiles p
  where p.id = p_user;
$$;

-- Leader first, then the friend.
create function public.duo_members_json(p_team uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.duo_person_json(u) order by ord), '[]'::jsonb)
  from public.duo_teams t
  cross join lateral (values (t.user_a, 1), (t.user_b, 2)) m (u, ord)
  where t.id = p_team and m.u is not null;
$$;

-- The caller's active team, or null.
create function public.duo_active_team(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.duo_teams t
  where t.status = 'active' and p_user in (t.user_a, t.user_b)
  limit 1;
$$;

-- Dissolves every open team of a user (ban, leave). Returns the number of teams dissolved.
create function public.duo_dissolve_for(p_user uuid, p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.duo_teams
  set status = 'dissolved', dissolved_at = now(), dissolve_reason = p_reason
  where status <> 'dissolved' and p_user in (user_a, user_b);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Removes a member from one group with a system message; deletes the group once empty.
create function public.group_remove_member(p_group uuid, p_user uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_members
  set left_at = now(), left_reason = p_reason
  where group_id = p_group and user_id = p_user and left_at is null;
  if not found then
    return false;
  end if;
  insert into public.group_messages (group_id, sender_id, kind, system_event, about_user)
  values (p_group, null, 'system', case when p_reason = 'ban' then 'removed' else 'left' end, p_user);
  if not exists (select 1 from public.group_members where group_id = p_group and left_at is null) then
    delete from public.group_chats where id = p_group;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Team RPCs
-- ---------------------------------------------------------------------------------------------
-- Creates (or reuses) the caller's pending invite. p_user: invite a specific person (username
-- search); null: an invite link anyone verified can accept. Returns {"team_id", "code"}.
-- SQLSTATE VD001: the caller already has a duo; VD002: the invited person already has one.
create function public.duo_invite(p_user uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  t    public.duo_teams;
  code text;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if public.duo_active_team(me) is not null then
    raise exception 'You already have a duo' using errcode = 'VD001';
  end if;
  if p_user is not null then
    if p_user = me then
      raise exception 'Invalid user' using errcode = 'invalid_parameter_value';
    end if;
    if not public.can_view_profile(p_user) or not public.duo_member_visible(p_user) then
      raise exception 'User not available' using errcode = 'no_data_found';
    end if;
    if public.duo_active_team(p_user) is not null then
      raise exception 'This person already has a duo' using errcode = 'VD002';
    end if;
  end if;

  select * into t from public.duo_teams where user_a = me and status = 'pending' for update;
  if t.id is null then
    loop
      code := substr(md5(gen_random_uuid()::text), 1, 8);
      exit when not exists (select 1 from public.duo_teams where invite_code = code);
    end loop;
    insert into public.duo_teams (user_a, user_b, invite_code)
    values (me, p_user, code)
    returning * into t;
  elsif p_user is not null and t.user_b is distinct from p_user then
    update public.duo_teams set user_b = p_user, created_at = now() where id = t.id returning * into t;
  end if;

  if t.user_b is not null then
    perform realtime.send(jsonb_build_object('kind', 'invite', 'team_id', t.id, 'from', me),
      'duo', 'inbox:' || t.user_b::text, true);
  end if;
  return jsonb_build_object('team_id', t.id, 'code', t.invite_code);
end;
$$;

-- Accepts an invite by team id (sent to me) or by invite code (link). The caller's own pending
-- invite, if any, is cancelled. Returns the team id. SQLSTATE VD003: no such invite (or it was
-- taken, declined, or its sender no longer qualifies).
create function public.duo_accept(p_team uuid default null, p_code text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t  public.duo_teams;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if public.duo_active_team(me) is not null then
    raise exception 'You already have a duo' using errcode = 'VD001';
  end if;

  select * into t from public.duo_teams
  where status = 'pending'
    and (case when p_team is not null then id = p_team and user_b = me
              else invite_code = lower(btrim(coalesce(p_code, ''))) and (user_b is null or user_b = me) end)
  for update;
  if t.id is null or t.user_a = me then
    raise exception 'Invite not found' using errcode = 'VD003';
  end if;
  if not public.duo_member_visible(t.user_a) or public.is_blocked_between(me, t.user_a)
     or public.duo_active_team(t.user_a) is not null then
    update public.duo_teams
    set status = 'dissolved', dissolved_at = now(), dissolve_reason = 'cancelled'
    where id = t.id;
    raise exception 'Invite no longer valid' using errcode = 'VD003';
  end if;

  -- My own outgoing invite is dropped: one duo per person.
  update public.duo_teams
  set status = 'dissolved', dissolved_at = now(), dissolve_reason = 'accepted_other'
  where user_a = me and status = 'pending';

  update public.duo_teams
  set user_b = me, status = 'active', accepted_at = now()
  where id = t.id;
  perform realtime.send(jsonb_build_object('kind', 'accepted', 'team_id', t.id, 'by', me),
    'duo', 'inbox:' || t.user_a::text, true);
  return t.id;
end;
$$;

-- Declines an invite sent to me.
create function public.duo_decline(p_team uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  update public.duo_teams
  set status = 'dissolved', dissolved_at = now(), dissolve_reason = 'declined'
  where id = p_team and user_b = me and status = 'pending';
  return found;
end;
$$;

-- Leaves the active duo (dissolves it for both) or cancels my pending invite.
create function public.duo_leave()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t  public.duo_teams;
begin
  select * into t from public.duo_teams
  where status <> 'dissolved' and me in (user_a, user_b)
  order by status = 'active' desc
  limit 1
  for update;
  if t.id is null then
    return false;
  end if;
  update public.duo_teams
  set status = 'dissolved', dissolved_at = now(),
      dissolve_reason = case when t.status = 'active' then 'left' else 'cancelled' end
  where id = t.id;
  if t.status = 'active' then
    perform realtime.send(jsonb_build_object('kind', 'dissolved', 'team_id', t.id, 'by', me),
      'duo', 'inbox:' || (case when t.user_a = me then t.user_b else t.user_a end)::text, true);
  end if;
  return true;
end;
$$;

-- Duo profile: bio (<= 120 characters, risk checked) and the team's preferences. Either member.
-- Returns the new bio_status ('ok' or 'held').
create function public.duo_set_profile(
  p_bio text, p_min_age int default null, p_max_age int default null, p_max_km int default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  team     uuid := public.duo_active_team((select auth.uid()));
  v_bio    text := nullif(btrim(coalesce(p_bio, '')), '');
  v_status text := 'ok';
begin
  if me is null or team is null then
    raise exception 'No active duo' using errcode = 'no_data_found';
  end if;
  if char_length(v_bio) > 120 then
    raise exception 'Bio too long' using errcode = 'check_violation';
  end if;
  if v_bio is not null and exists (select 1 from public.detect_message_risk(v_bio)) then
    v_status := 'held';
  end if;
  update public.duo_teams t
  set bio = v_bio,
      bio_status = v_status,
      min_age = coalesce(p_min_age, t.min_age),
      max_age = coalesce(p_max_age, t.max_age),
      max_km = coalesce(p_max_km, t.max_km)
  where t.id = team;
  return v_status;
end;
$$;

-- The caller's team (pending invite I sent, or the active duo) and the invites waiting for me.
create function public.get_my_duo()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'team', (
      select jsonb_build_object(
        'id', t.id, 'status', t.status, 'code', t.invite_code,
        'bio', t.bio, 'bio_status', t.bio_status,
        'min_age', t.min_age, 'max_age', t.max_age, 'max_km', t.max_km,
        'is_leader', t.user_a = (select auth.uid()),
        'partner', public.duo_person_json(case when t.user_a = (select auth.uid()) then t.user_b else t.user_a end),
        'created_at', t.created_at, 'accepted_at', t.accepted_at)
      from public.duo_teams t
      where t.status <> 'dissolved'
        and ((t.user_a = (select auth.uid())) or (t.user_b = (select auth.uid()) and t.status = 'active'))
      order by t.status = 'active' desc
      limit 1),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('team_id', t.id, 'from', public.duo_person_json(t.user_a),
        'created_at', t.created_at) order by t.created_at desc)
      from public.duo_teams t
      where t.status = 'pending' and t.user_b = (select auth.uid())
        and public.duo_member_visible(t.user_a) and not public.is_blocked_between(t.user_a, (select auth.uid()))
    ), '[]'::jsonb));
$$;

-- ---------------------------------------------------------------------------------------------
-- Duo deck, likes, matches
-- ---------------------------------------------------------------------------------------------
create function public.get_duo_candidates(p_limit int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  mine public.duo_teams;
  out  jsonb;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  select * into mine from public.duo_teams where status = 'active' and me in (user_a, user_b);
  if mine.id is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'team_id', c.id,
      'bio', case when c.bio_status = 'ok' then c.bio end,
      'distance_km', public.duo_distance_km(mine.id, c.id),
      'members', public.duo_members_json(c.id)) order by c.accepted_at desc), '[]'::jsonb)
  into out
  from (
    select t.*
    from public.duo_teams t
    where t.status = 'active'
      and t.id <> mine.id
      and public.duo_member_visible(t.user_a)
      and public.duo_member_visible(t.user_b)
      and not exists (
        select 1 from public.duo_likes l where l.team_id = mine.id and l.target_team_id = t.id)
      and not exists (
        select 1 from public.duo_matches m
        where m.team_a = least(mine.id, t.id) and m.team_b = greatest(mine.id, t.id))
      and public.duo_teams_compatible(mine, t)
    order by t.accepted_at desc
    limit least(50, greatest(1, coalesce(p_limit, 20)))
  ) c;
  return out;
end;
$$;

-- Like (true) or pass (false) a duo on behalf of the caller's team. Idempotent per pair.
-- Returns {"matched": bool, "group_id": uuid|null, "match_id": uuid|null, "just_matched": true?}.
-- Broadcasts 'duo' on inbox:<user> ({kind: 'like'} to the partner; {kind: 'match'} to all four).
create function public.duo_decide(p_team uuid, p_like boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  mine     public.duo_teams;
  target   public.duo_teams;
  existing public.duo_likes;
  partner  uuid;
  v_match  uuid;
  v_group  uuid;
  u        uuid;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if p_like is null or p_team is null then
    raise exception 'Decision required' using errcode = 'invalid_parameter_value';
  end if;
  select * into mine from public.duo_teams where status = 'active' and me in (user_a, user_b);
  if mine.id is null then
    raise exception 'No active duo' using errcode = 'no_data_found';
  end if;
  -- Lock both teams in id order: two teams deciding on each other at once never deadlock.
  perform 1 from public.duo_teams where id in (mine.id, p_team) order by id for update;
  select * into mine from public.duo_teams where id = mine.id and status = 'active';
  select * into target from public.duo_teams where id = p_team and status = 'active';
  if mine.id is null or target.id is null or target.id = mine.id then
    raise exception 'Duo not available' using errcode = 'VD004';
  end if;

  select m.id, m.group_id into v_match, v_group from public.duo_matches m
  where m.team_a = least(mine.id, target.id) and m.team_b = greatest(mine.id, target.id);
  if v_match is not null then
    return jsonb_build_object('matched', true, 'group_id', v_group, 'match_id', v_match);
  end if;
  select * into existing from public.duo_likes
  where team_id = mine.id and target_team_id = target.id;
  if existing.team_id is not null then
    return jsonb_build_object('matched', false, 'group_id', null, 'match_id', null,
      'decided', existing.direction);
  end if;
  if p_like and not (public.duo_member_visible(target.user_a) and public.duo_member_visible(target.user_b)
                     and public.duo_teams_compatible(mine, target)) then
    raise exception 'Duo not available' using errcode = 'VD004';
  end if;

  insert into public.duo_likes (team_id, target_team_id, user_id, direction)
  values (mine.id, target.id, me, case when p_like then 'like' else 'pass' end::public.swipe_direction);
  if not p_like then
    return jsonb_build_object('matched', false, 'group_id', null, 'match_id', null);
  end if;

  partner := case when mine.user_a = me then mine.user_b else mine.user_a end;
  perform realtime.send(jsonb_build_object('kind', 'like', 'team_id', target.id, 'by', me),
    'duo', 'inbox:' || partner::text, true);

  if not exists (
    select 1 from public.duo_likes l
    where l.team_id = target.id and l.target_team_id = mine.id and l.direction = 'like'
  ) then
    return jsonb_build_object('matched', false, 'group_id', null, 'match_id', null);
  end if;

  -- Mutual: the duo match and its 4-person group chat.
  insert into public.group_chats default values returning id into v_group;
  insert into public.duo_matches (team_a, team_b, group_id)
  values (least(mine.id, target.id), greatest(mine.id, target.id), v_group)
  returning id into v_match;
  insert into public.group_members (group_id, user_id, team_id)
  values (v_group, mine.user_a, mine.id), (v_group, mine.user_b, mine.id),
         (v_group, target.user_a, target.id), (v_group, target.user_b, target.id);
  insert into public.group_messages (group_id, sender_id, kind, system_event)
  values (v_group, null, 'system', 'matched');
  foreach u in array array[mine.user_a, mine.user_b, target.user_a, target.user_b] loop
    perform realtime.send(jsonb_build_object('kind', 'match', 'group_id', v_group, 'match_id', v_match),
      'duo', 'inbox:' || u::text, true);
  end loop;
  return jsonb_build_object('matched', true, 'group_id', v_group, 'match_id', v_match,
    'just_matched', true);
end;
$$;

-- Takes back the team's like on p_team within 1 hour, unless it already made a match.
create function public.duo_undo_like(p_team uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  mine uuid := public.duo_active_team((select auth.uid()));
begin
  if me is null or mine is null then
    return false;
  end if;
  perform 1 from public.duo_teams where id in (mine, p_team) order by id for update;
  delete from public.duo_likes l
  where l.team_id = mine and l.target_team_id = p_team and l.direction = 'like'
    and l.created_at > now() - interval '1 hour'
    and not exists (
      select 1 from public.duo_matches m
      where m.team_a = least(mine, p_team) and m.team_b = greatest(mine, p_team));
  return found;
end;
$$;

-- The team's likes of the last 7 days, newest first: who liked, until when it can be undone,
-- whether it became a match.
create function public.get_duo_inbox()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'target_team_id', l.target_team_id,
    'by', jsonb_build_object('id', p.id, 'display_name', p.display_name),
    'mine', l.user_id = (select auth.uid()),
    'created_at', l.created_at,
    'undo_until', l.created_at + interval '1 hour',
    'can_undo', l.created_at > now() - interval '1 hour' and m.id is null,
    'matched', m.id is not null,
    'group_id', m.group_id,
    'team', jsonb_build_object(
      'bio', case when t.bio_status = 'ok' then t.bio end,
      'members', public.duo_members_json(t.id))
  ) order by l.created_at desc), '[]'::jsonb)
  from public.duo_likes l
  join public.profiles p on p.id = l.user_id
  join public.duo_teams t on t.id = l.target_team_id
  left join public.duo_matches m
    on m.team_a = least(l.team_id, l.target_team_id) and m.team_b = greatest(l.team_id, l.target_team_id)
  where l.team_id = public.duo_active_team((select auth.uid()))
    and l.direction = 'like'
    and l.created_at > now() - interval '7 days';
$$;

-- ---------------------------------------------------------------------------------------------
-- Group chats
-- ---------------------------------------------------------------------------------------------
grant select on public.group_chats, public.group_members, public.group_messages to authenticated;
grant insert (group_id, kind, body, media_path, image_width, image_height)
  on public.group_messages to authenticated;

create policy "group_chats: member" on public.group_chats
  for select to authenticated using (public.is_group_member(id));
create policy "group_members: member" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "group_messages: member" on public.group_messages
  for select to authenticated using (public.is_group_member(group_id));
create policy "group_messages: send" on public.group_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_verified()
    and kind in ('text', 'image')
    and public.is_group_member(group_id)
  );

-- Current membership, uploaded photo; nothing else the client could set.
create function public.group_messages_check_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'system' then
    return new;
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = new.group_id and user_id = new.sender_id and left_at is null
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if new.kind = 'image' then
    if new.media_path is null or not exists (
      select 1 from storage.objects where bucket_id = 'chat-media' and name = new.media_path
    ) then
      raise exception 'media not uploaded' using errcode = '23514';
    end if;
  else
    new.media_path := null;
    new.image_width := null;
    new.image_height := null;
  end if;
  new.media_expired_at := null;
  new.system_event := null;
  new.about_user := null;
  return new;
end;
$$;

create trigger group_messages_check_insert
  before insert on public.group_messages
  for each row execute function public.group_messages_check_insert();

create trigger group_messages_rate_limit
  before insert on public.group_messages
  for each row execute function public.enforce_rate_limit('sender_id', '30', '1 minute');

create trigger group_messages_enforce_not_muted
  before insert on public.group_messages
  for each row execute function public.enforce_not_muted('sender_id');

create function public.group_messages_flag_risk()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'text' then
    perform public.flag_message_risk(new.id, 'group', new.sender_id, new.group_id, new.body);
  end if;
  return null;
end;
$$;

create trigger group_messages_flag_risk
  after insert on public.group_messages
  for each row execute function public.group_messages_flag_risk();

-- Live delivery over group:<id> (postgres_changes, RLS-filtered per subscriber).
alter publication supabase_realtime add table public.group_messages;

-- Photos: chat-media/<group id>/<uuid>.webp, readable and writable by current members.
create policy "chat-media: read group member" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-media' and public.is_group_member(public.chat_media_match(name)));

create policy "chat-media: upload group member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_verified()
    and public.is_group_member(public.chat_media_match(name))
  );

-- The caller's groups for the Chats list: members, last message, unread count.
create function public.get_group_chats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'group_id', g.id,
    'created_at', g.created_at,
    'members', (
      select jsonb_agg(public.duo_person_json(gm.user_id) || jsonb_build_object('left', gm.left_at is not null)
        order by gm.joined_at, gm.user_id)
      from public.group_members gm where gm.group_id = g.id),
    'last_message', (
      select jsonb_build_object('kind', m.kind, 'body', m.body, 'sender_id', m.sender_id,
        'system_event', m.system_event, 'about_user', m.about_user, 'created_at', m.created_at)
      from public.group_messages m where m.group_id = g.id
      order by m.created_at desc, m.id desc limit 1),
    'unread', (
      select count(*) from public.group_messages m
      where m.group_id = g.id and m.kind <> 'system'
        and m.sender_id <> (select auth.uid())
        and m.created_at > coalesce(me.last_read_at, me.joined_at))
  ) order by g.created_at desc), '[]'::jsonb)
  from public.group_chats g
  join public.group_members me on me.group_id = g.id and me.user_id = (select auth.uid()) and me.left_at is null;
$$;

-- One group for the chat screen, or null when the caller is not a current member.
create function public.get_group_chat(p_group uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'group_id', g.id,
    'created_at', g.created_at,
    'members', (
      select jsonb_agg(public.duo_person_json(gm.user_id)
        || jsonb_build_object('member_id', gm.id, 'left', gm.left_at is not null, 'team_id', gm.team_id)
        order by gm.joined_at, gm.user_id)
      from public.group_members gm where gm.group_id = g.id))
  from public.group_chats g
  where g.id = p_group and public.is_group_member(g.id);
$$;

create function public.group_mark_read(p_group uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_members set last_read_at = now()
  where group_id = p_group and user_id = (select auth.uid()) and left_at is null;
$$;

-- Leaves a group; the others continue (a system message tells them).
create function public.group_leave(p_group uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.group_remove_member(p_group, (select auth.uid()), 'left');
$$;

-- Unread group messages across the caller's groups (Chats tab badge).
create function public.group_unread_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((
    select count(*) from public.group_messages m
    where m.group_id = me.group_id and m.kind <> 'system'
      and m.sender_id <> (select auth.uid())
      and m.created_at > coalesce(me.last_read_at, me.joined_at)))::int, 0)
  from public.group_members me
  where me.user_id = (select auth.uid()) and me.left_at is null;
$$;

-- ---------------------------------------------------------------------------------------------
-- Blocks, bans
-- ---------------------------------------------------------------------------------------------
-- Blocking a member: the blocker leaves every group they share (the others only see "left") and
-- a duo with the blocked person is dissolved. Future duo matches are prevented by
-- duo_teams_compatible (no block between any members).
create function public.blocks_leave_groups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g uuid;
begin
  for g in
    select a.group_id from public.group_members a
    join public.group_members b on b.group_id = a.group_id and b.user_id = new.blocked_id and b.left_at is null
    where a.user_id = new.blocker_id and a.left_at is null
  loop
    perform public.group_remove_member(g, new.blocker_id, 'block');
  end loop;
  update public.duo_teams
  set status = 'dissolved', dissolved_at = now(), dissolve_reason = 'block'
  where status <> 'dissolved'
    and ((user_a = new.blocker_id and user_b = new.blocked_id) or (user_a = new.blocked_id and user_b = new.blocker_id));
  return null;
end;
$$;

create trigger blocks_leave_groups
  after insert on public.blocks
  for each row execute function public.blocks_leave_groups();

-- A ban removes the user from every group and dissolves their duo (any ban path: admin_ban_user,
-- admin_set_ban, the Telegram bot).
create function public.profiles_ban_leaves_duo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g uuid;
begin
  for g in select group_id from public.group_members where user_id = new.id and left_at is null loop
    perform public.group_remove_member(g, new.id, 'ban');
  end loop;
  perform public.duo_dissolve_for(new.id, 'ban');
  return null;
end;
$$;

create trigger profiles_ban_leaves_duo
  after update of banned_at on public.profiles
  for each row when (old.banned_at is null and new.banned_at is not null)
  execute function public.profiles_ban_leaves_duo();

-- ---------------------------------------------------------------------------------------------
-- Realtime: group:<id> (read-only, postgres_changes) and group-typing:<id> (writable).
-- "realtime: receive" is recreated with every existing topic (last: 20261008000122).
-- MERGE NOTE: any other branch that recreates this policy must keep the group: lines.
-- ---------------------------------------------------------------------------------------------
drop policy "realtime: receive" on realtime.messages;

create policy "realtime: receive" on realtime.messages
  for select to authenticated
  using (
    (realtime.topic() = 'feed' and public.is_verified())
    or realtime.topic() = 'randomizer:' || (select auth.uid())::text
    or realtime.topic() = 'inbox:' || (select auth.uid())::text
    or realtime.topic() = 'call:' || (select auth.uid())::text
    or (
      realtime.topic() like 'random:%'
      and public.random_session_side(substring(realtime.topic() from 8)::uuid) is not null
    )
    or (
      realtime.topic() like 'random-typing:%'
      and public.random_session_side(substring(realtime.topic() from 15)::uuid) is not null
    )
    or (
      realtime.topic() like 'match:%'
      and public.is_match_participant(substring(realtime.topic() from 7)::uuid)
    )
    or (
      realtime.topic() like 'match-typing:%'
      and public.is_match_participant(substring(realtime.topic() from 14)::uuid)
    )
    or (
      realtime.topic() like 'group:%'
      and public.is_group_member(substring(realtime.topic() from 7)::uuid)
    )
    or (
      realtime.topic() like 'group-typing:%'
      and public.is_group_member(substring(realtime.topic() from 14)::uuid)
    )
  );

create policy "realtime: group typing" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'group-typing:%'
    and public.is_group_member(substring(realtime.topic() from 14)::uuid)
  );

-- ---------------------------------------------------------------------------------------------
-- Reports (20261009000260): subject and sanity checks for the new targets.
-- Newest definition (was 20261009000161).
-- ---------------------------------------------------------------------------------------------
create or replace function public.reports_set_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.subject_id := null;
  case new.target_type
    when 'user' then
      select id into new.subject_id from public.profiles where id = new.target_id;
    when 'post' then
      select author_id into new.subject_id from public.posts where id = new.target_id;
    when 'comment' then
      select author_id into new.subject_id from public.comments where id = new.target_id;
    when 'random_session' then
      select case when s.user_a = new.reporter_id then s.user_b else s.user_a end
      into new.subject_id
      from public.random_chat_sessions s
      where s.id = new.target_id and new.reporter_id in (s.user_a, s.user_b);
    when 'message' then
      select m.sender_id into new.subject_id
      from public.messages m
      join public.matches x on x.id = m.match_id
      where m.id = new.target_id and new.reporter_id in (x.user_a, x.user_b);
    when 'photo' then
      select profile_id into new.subject_id from public.profile_photos where id = new.target_id;
    when 'call' then
      select case when c.caller_id = new.reporter_id then c.callee_id else c.caller_id end
      into new.subject_id
      from public.calls c
      where c.id = new.target_id and new.reporter_id in (c.caller_id, c.callee_id);
    -- Group reports: the reporter must be (or have been) a member of that group.
    when 'group_message' then
      select m.sender_id into new.subject_id
      from public.group_messages m
      join public.group_members gm on gm.group_id = m.group_id and gm.user_id = new.reporter_id
      where m.id = new.target_id and m.kind <> 'system';
    when 'group_member' then
      select gm.user_id into new.subject_id
      from public.group_members gm
      join public.group_members mine on mine.group_id = gm.group_id and mine.user_id = new.reporter_id
      where gm.id = new.target_id;
  end case;

  if new.target_type in ('message', 'photo', 'call', 'group_message', 'group_member') then
    if new.subject_id is null then
      raise exception 'Report target not found' using errcode = 'no_data_found';
    end if;
    if new.subject_id = new.reporter_id then
      raise exception 'You cannot report yourself' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Newest definition (was 20261009000162): group reports concern a person too, so the chats,
-- media and recordings of the parties are kept while such a report is open.
create or replace function public.report_is_personal(t public.report_target)
returns boolean
language sql
immutable
set search_path = ''
as $$ select t in ('user', 'message', 'photo', 'call', 'group_message', 'group_member') $$;

-- An open personal report about anyone who is or was in the group, or an evidence hold on them.
create function public.group_under_open_report(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    join public.reports r
      on r.resolved_at is null and public.report_is_personal(r.target_type) and r.subject_id = gm.user_id
    where gm.group_id = p_group
  ) or exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group and public.under_evidence_hold(gm.user_id)
  );
$$;

-- Evidence for moderators: the group transcript around the reported message (or the latest
-- messages for a member report), only while the report is open, logged as
-- evidence.transcript_open. Media is never returned here (admin_open_group_media).
create function public.admin_open_group_transcript(
  p_admin    uuid,
  p_type     public.report_target,
  p_target   uuid,
  p_reporter uuid,
  p_limit    int default 300
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  subject uuid;
  v_group uuid;
  anchor  timestamptz;
  half    int := least(greatest(coalesce(p_limit, 300), 2), 300) / 2;
  out     jsonb;
begin
  perform public.assert_admin(p_admin);
  if p_type not in ('group_message', 'group_member') then
    raise exception 'Not a group report' using errcode = 'check_violation';
  end if;
  subject := public.evidence_case_subject(p_type, p_target, p_reporter);
  if p_type = 'group_message' then
    select m.group_id, m.created_at into v_group, anchor from public.group_messages m where m.id = p_target;
  else
    select gm.group_id into v_group from public.group_members gm where gm.id = p_target;
  end if;
  if v_group is null then
    raise exception 'The group chat no longer exists' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.group_members where group_id = v_group and user_id = p_reporter)
     or not exists (select 1 from public.group_members where group_id = v_group and user_id = subject) then
    raise exception 'Not a party of this group' using errcode = 'insufficient_privilege';
  end if;

  perform public.log_moderation(p_admin, 'evidence.transcript_open', p_type::text, p_target,
    format('reporter %s, reported %s, group %s', p_reporter, subject, v_group));

  with picked as (
    (select m.* from public.group_messages m
     where m.group_id = v_group and (anchor is null or m.created_at <= anchor)
     order by m.created_at desc, m.id desc
     limit case when anchor is null then half * 2 else half end)
    union all
    (select m.* from public.group_messages m
     where m.group_id = v_group and anchor is not null and m.created_at > anchor
     order by m.created_at, m.id
     limit half)
  )
  select jsonb_build_object(
    'group_id', v_group,
    'members', (
      select jsonb_agg(jsonb_build_object('id', gm.user_id, 'name', p.display_name,
        'left', gm.left_at is not null) order by gm.joined_at)
      from public.group_members gm join public.profiles p on p.id = gm.user_id
      where gm.group_id = v_group),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'sender_id', m.sender_id, 'kind', m.kind, 'body', m.body,
        'has_media', m.media_path is not null, 'system_event', m.system_event,
        'about_user', m.about_user, 'created_at', m.created_at,
        'reported', p_type = 'group_message' and m.id = p_target)
        order by m.created_at, m.id)
      from picked m), '[]'::jsonb))
  into out;
  return out;
end;
$$;

-- The chat-media path of one photo of that group, for a short-lived signed URL made by the panel.
create function public.admin_open_group_media(
  p_admin    uuid,
  p_type     public.report_target,
  p_target   uuid,
  p_reporter uuid,
  p_message  uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  subject uuid;
  v_group uuid;
  path    text;
begin
  perform public.assert_admin(p_admin);
  if p_type not in ('group_message', 'group_member') then
    raise exception 'Not a group report' using errcode = 'check_violation';
  end if;
  subject := public.evidence_case_subject(p_type, p_target, p_reporter);
  if p_type = 'group_message' then
    select m.group_id into v_group from public.group_messages m where m.id = p_target;
  else
    select gm.group_id into v_group from public.group_members gm where gm.id = p_target;
  end if;
  select m.media_path into path from public.group_messages m
  where m.id = p_message and m.group_id = v_group
    and exists (select 1 from public.group_members where group_id = v_group and user_id = p_reporter);
  if path is null then
    raise exception 'No media for this message (expired or not part of the case)'
      using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, 'evidence.media_open', 'group_message', p_message,
    format('case %s:%s, reporter %s', p_type, p_target, p_reporter));
  return path;
end;
$$;

-- Duo bios held by the risk detector, oldest first (moderators approve or clear them).
create function public.admin_held_duo_bios(p_admin uuid, p_limit int default 50)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  select coalesce(jsonb_agg(jsonb_build_object(
    'team_id', t.id, 'bio', t.bio, 'created_at', t.created_at,
    'members', (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'username', p.username))
                from public.profiles p where p.id in (t.user_a, t.user_b))
  ) order by t.created_at), '[]'::jsonb)
  into out
  from (
    select * from public.duo_teams
    where bio_status = 'held' and status = 'active'
    order by created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) t;
  return out;
end;
$$;

-- Approve (shown to other duos) or reject (bio removed) a held duo bio. Logged.
create function public.admin_review_duo_bio(p_admin uuid, p_team uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  update public.duo_teams
  set bio_status = 'ok', bio = case when p_approve then bio else null end
  where id = p_team and bio_status = 'held';
  if not found then
    raise exception 'No held bio' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, case when p_approve then 'duo_bio.approve' else 'duo_bio.reject' end,
    'duo_team', p_team, p_reason);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------------------------
-- Group photos older than 90 days, oldest first (files are removed by the server job).
create function public.retention_group_media(p_limit int default 200)
returns table (message_id uuid, path text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.media_path
  from public.group_messages m
  where m.media_path is not null
    and m.created_at < now() - interval '90 days'
    and not public.group_under_open_report(m.group_id)
  order by m.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- "Expired" placeholders for the messages whose file is really gone.
create function public.retention_mark_group_media_expired(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.group_messages m
  set media_path = null, media_expired_at = now()
  where m.id = any (p_ids)
    and m.media_path is not null
    and m.created_at < now() - interval '90 days'
    and not exists (
      select 1 from storage.objects o where o.bucket_id = 'chat-media' and o.name = m.media_path
    );
  get diagnostics updated = row_count;
  return updated;
end;
$$;

-- Newest definition (was 20261008000111): group photos are not orphans.
create or replace function public.retention_orphan_chat_media(p_limit int default 200)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chat-media'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.messages m where m.media_path = o.name)
    and not exists (select 1 from public.group_messages m where m.media_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- Dissolved teams, decided likes and empty groups older than 90 days (unless under a report or
-- hold). Messages of a living group stay as long as the group exists.
create function public.purge_old_duo_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  m integer;
begin
  delete from public.duo_likes l
  where l.created_at < now() - interval '90 days'
    and not exists (
      select 1 from public.duo_matches x
      where x.team_a = least(l.team_id, l.target_team_id) and x.team_b = greatest(l.team_id, l.target_team_id));
  get diagnostics n = row_count;
  delete from public.group_chats g
  where not exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.left_at is null)
    and not public.group_under_open_report(g.id);
  get diagnostics m = row_count;
  n := n + m;
  delete from public.duo_teams t
  where t.status = 'dissolved' and t.dissolved_at < now() - interval '90 days'
    and not public.under_evidence_hold(t.user_a)
    and (t.user_b is null or not public.under_evidence_hold(t.user_b))
    and not exists (
      select 1 from public.duo_matches x
      where t.id in (x.team_a, x.team_b) and x.group_id is not null);
  get diagnostics m = row_count;
  return n + m;
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
    'duo_invite(uuid)',
    'duo_accept(uuid, text)',
    'duo_decline(uuid)',
    'duo_leave()',
    'duo_set_profile(text, int, int, int)',
    'get_my_duo()',
    'get_duo_candidates(int)',
    'duo_decide(uuid, boolean)',
    'duo_undo_like(uuid)',
    'get_duo_inbox()',
    'get_group_chats()',
    'get_group_chat(uuid)',
    'group_mark_read(uuid)',
    'group_leave(uuid)',
    'group_unread_count()',
    'is_group_member(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  foreach fn in array array[
    'duo_member_visible(uuid)',
    'duo_pair_ok(uuid, uuid, int, int, int, int)',
    'duo_teams_compatible(public.duo_teams, public.duo_teams)',
    'duo_distance_km(uuid, uuid)',
    'duo_person_json(uuid)',
    'duo_members_json(uuid)',
    'duo_active_team(uuid)',
    'duo_dissolve_for(uuid, text)',
    'group_remove_member(uuid, uuid, text)',
    'group_messages_check_insert()',
    'group_messages_flag_risk()',
    'blocks_leave_groups()',
    'profiles_ban_leaves_duo()',
    'group_under_open_report(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'admin_open_group_transcript(uuid, public.report_target, uuid, uuid, int)',
    'admin_open_group_media(uuid, public.report_target, uuid, uuid, uuid)',
    'admin_held_duo_bios(uuid, int)',
    'admin_review_duo_bio(uuid, uuid, boolean, text)',
    'retention_group_media(int)',
    'retention_mark_group_media_expired(uuid[])',
    'purge_old_duo_data()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- Daily at 04:12 Malaysia time (20:12 UTC) where pg_cron exists (Supabase; not the local test
-- database). The retention job (POST /api/cron/retention) calls it too.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-old-duo-data', '12 20 * * *', 'select public.purge_old_duo_data()');
  end if;
end;
$$;
