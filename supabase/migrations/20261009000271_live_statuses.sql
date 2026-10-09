-- Live statuses: "What's your vibe?" (emoji + up to 60 characters, 3 hours), merged with Plans
-- (20261009000200) into one sheet: a preset plan fills the status and may set the 24-hour plan.
--
--   * One active status per user: setting a new one marks the previous row replaced (kept for
--     retention, see purge_live_statuses). Rows are never updated by clients: set / clear only
--     through the RPCs below; reads only through get_my_status() and get_live_statuses().
--   * Moderation: the SQL risk detector of 20261009000163 (phone, link, messenger, money,
--     moderator keywords) runs on insert. A hit puts the status in 'held': visible only to the
--     author ("under review") until a moderator approves or removes it (/admin/statuses, logged
--     as status.approve / status.remove). Users can report a status (report_target 'status',
--     20261009000270). 'removed' statuses are hidden from everyone.
--   * Carousel: statuses of compatible people nearby (interested in each other, inside the
--     caller's saved Discover distance and age range, else 50 km and 18-99), verified, active,
--     not paused, not banned, not shadow-banned, not incognito, not blocked either way.
--   * Reply: a conversation on the Blind Dating engine (random_chat_sessions, 20261009000190),
--     kind 'status', revealed_from_start (both see names and photos), the status pinned as
--     context (a snapshot in random_chat_sessions.context: the status itself expires and is
--     purged while the conversation keeps its 90-day retention). Connect / Pass as in Blind
--     Dating: mutual Connect = match + transcript copy via blind_decide (unchanged).
--     Limits: 10 new conversations per 24 hours, one conversation per status per replier,
--     never with yourself, never across a block, never while muted (VS001 from the trigger).
--   * Retention (pg_cron, hourly): visible statuses 24 hours after they expired or were
--     replaced; held and removed ones 90 days; anything under an open report stays until the
--     report is resolved.
--
-- Columns on random_chat_sessions are shared with feature/feed-conversations (20261009000220):
-- kind, revealed_from_start, context, started_by, last_push_at are added with IF NOT EXISTS and
-- the same definitions, so either migration can land first. 220 also redefines
-- get_blind_session and the kind constraints; see the DO blocks below for how both coexist.

-- ---------------------------------------------------------------------------------------------
-- Statuses
-- ---------------------------------------------------------------------------------------------

-- Incognito (feature/matchmaker-incognito adds and manages this column; guarded here so the
-- carousel can exclude incognito people whichever migration lands first).
alter table public.profiles add column if not exists is_incognito boolean not null default false;

create table public.user_statuses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  -- One emoji (a grapheme cluster can be several code points). No whitespace.
  emoji            text not null check (char_length(emoji) between 1 and 16 and emoji !~ '\s'),
  text             text not null check (char_length(text) between 1 and 60 and text = btrim(text)),
  -- Preset that filled the status, if any (same list as public.user_plans.tag).
  plan_tag         text check (plan_tag in (
    'coffee', 'football', 'mamak', 'morning-run', 'gym', 'movie', 'karaoke', 'hiking', 'study',
    'new-cafe', 'night-market', 'badminton', 'beach', 'gaming', 'concert', 'art-gallery',
    'food-hunt', 'chatting'
  )),
  moderation_state text not null default 'visible'
                   check (moderation_state in ('visible', 'held', 'removed')),
  -- Risk kinds that put it on hold (detect_message_risk), for the moderator.
  held_kinds       text[] not null default '{}',
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '3 hours',
  -- Set when the user posted a newer status (or cleared this one). Null = the current one.
  replaced_at      timestamptz,
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz
);

create unique index user_statuses_current_idx on public.user_statuses (user_id) where replaced_at is null;
create index user_statuses_live_idx on public.user_statuses (expires_at desc)
  where replaced_at is null and moderation_state = 'visible';
create index user_statuses_review_idx on public.user_statuses (created_at desc)
  where moderation_state = 'held';

alter table public.user_statuses enable row level security;
-- Closed to clients: everything goes through the RPCs (and the service role for the panel).
revoke all on public.user_statuses from anon, authenticated;

-- Insert-time moderation: any risk signal holds the status. If the detector itself fails the
-- status is held too (never shown unchecked).
create function public.user_statuses_moderate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kinds text[];
begin
  select coalesce(array_agg(distinct d.kind order by d.kind), '{}') into kinds
  from public.detect_message_risk(new.emoji || ' ' || new.text) d;
  new.held_kinds := kinds;
  if cardinality(kinds) > 0 then
    new.moderation_state := 'held';
  end if;
  return new;
exception
  when others then
    new.moderation_state := 'held';
    new.held_kinds := array['error'];
    return new;
end;
$$;

revoke execute on function public.user_statuses_moderate() from public, anon, authenticated;

create trigger user_statuses_moderate
  before insert on public.user_statuses
  for each row execute function public.user_statuses_moderate();

-- What the author sees of their own status (any state) and others see of a visible one.
create function public.status_json(s public.user_statuses)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'emoji', s.emoji, 'text', s.text, 'plan_tag', s.plan_tag,
    'moderation_state', s.moderation_state, 'created_at', s.created_at,
    'expires_at', s.expires_at);
$$;

revoke execute on function public.status_json(public.user_statuses) from public, anon, authenticated;

-- Sets (replaces) the caller's status for 3 hours. With p_plan_tag the 24-hour plan is set as
-- well (set_plan, 20261009000200), so one tap from the sheet does both. Returns the new status
-- (moderation_state 'held' when the risk detector flagged it).
create function public.set_status(p_emoji text, p_text text, p_plan_tag text default null)
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
  -- Rate limit: at most 20 statuses per hour (edits included).
  if (select count(*) from public.user_statuses
      where user_id = me and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many statuses' using errcode = 'P0429';
  end if;

  update public.user_statuses set replaced_at = now() where user_id = me and replaced_at is null;
  insert into public.user_statuses (user_id, emoji, text, plan_tag)
  values (me, btrim(p_emoji), btrim(p_text), p_plan_tag)
  returning * into s;
  if p_plan_tag is not null then
    perform public.set_plan(p_plan_tag);
  end if;
  return public.status_json(s);
end;
$$;

-- Hides the current status (kept for retention like a replaced one). The plan is not touched.
create function public.clear_status()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_statuses set replaced_at = now()
  where user_id = (select auth.uid()) and replaced_at is null;
$$;

-- The caller's current status (any moderation state), null when none or expired.
create function public.get_my_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.status_json(s)
  from public.user_statuses s
  where s.user_id = (select auth.uid()) and s.replaced_at is null and s.expires_at > now()
    and s.moderation_state <> 'removed';
$$;

-- Internal: whether p_viewer may see p_user's status in the carousel (compatibility, distance,
-- age, blocks, sanctions, incognito, pause).
create function public.status_visible_to(p_viewer uuid, p_user uuid)
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
    where me.id = p_viewer and p.id <> me.id
      and p.verification_status = 'approved'
      and p.is_active
      and p.discoverable
      and p.banned_at is null
      and not p.shadow_banned
      and not coalesce(p.is_incognito, false)
      and p.gender = any (me.interested_in)
      and me.gender = any (p.interested_in)
      and public.age_in_years(p.birth_date) between coalesce(mf.min_age, 18) and coalesce(mf.max_age, 99)
      and (me.location is null or p.location is null
           or extensions.st_dwithin(me.location, p.location, coalesce(mf.max_km, 50) * 1000))
      and not public.is_blocked_between(me.id, p.id)
  );
$$;

revoke execute on function public.status_visible_to(uuid, uuid) from public, anon, authenticated;

-- The carousel: live, visible statuses of compatible people nearby, newest first (the caller's
-- own status comes from get_my_status). Only what the ring and the viewer show.
create function public.get_live_statuses(p_limit int default 50)
returns table (
  id           uuid,
  user_id      uuid,
  display_name text,
  age          int,
  photo        jsonb,
  emoji        text,
  text         text,
  plan_tag     text,
  created_at   timestamptz,
  expires_at   timestamptz
)
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
  select s.id, p.id, p.display_name, public.age_in_years(p.birth_date),
    (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
     from public.profile_photos ph where ph.profile_id = p.id order by ph.position limit 1),
    s.emoji, s.text, s.plan_tag, s.created_at, s.expires_at
  from public.user_statuses s
  join public.profiles p on p.id = s.user_id
  where s.replaced_at is null
    and s.moderation_state = 'visible'
    and s.expires_at > now()
    and s.user_id <> me
    and public.status_visible_to(me, s.user_id)
  order by s.created_at desc
  limit least(100, greatest(1, coalesce(p_limit, 50)));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Conversations on the Blind Dating engine
-- ---------------------------------------------------------------------------------------------

-- Shared with 20261009000220 (same names and definitions, IF NOT EXISTS on both sides).
alter table public.random_chat_sessions
  add column if not exists kind text not null default 'blind',
  add column if not exists revealed_from_start boolean not null default false,
  add column if not exists context jsonb,
  add column if not exists started_by uuid references public.profiles (id) on delete set null,
  add column if not exists last_push_at timestamptz,
  -- Own: the status replied to. set null: the status is purged long before the conversation.
  add column if not exists status_id uuid references public.user_statuses (id) on delete set null;

-- The kind checks: drop whatever check mentions `kind` (the inline check of 220, or ours from an
-- earlier run) and re-add them including 'status'. The context constraint covers 220's columns
-- when they exist.
do $$
declare
  r record;
  has_220 boolean;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.random_chat_sessions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\mkind\M'
  loop
    execute format('alter table public.random_chat_sessions drop constraint %I', r.conname);
  end loop;
  alter table public.random_chat_sessions
    add constraint random_sessions_kind_check check (kind in ('blind', 'post', 'prompt', 'status'));
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'random_chat_sessions' and column_name = 'post_id'
  ) into has_220;
  if has_220 then
    alter table public.random_chat_sessions add constraint random_sessions_kind_context check (
      (kind = 'blind' and post_id is null and prompt_id is null and status_id is null and started_by is null)
      or (kind = 'post' and prompt_id is null and status_id is null and started_by is not null)
      or (kind = 'prompt' and post_id is null and status_id is null and started_by is not null and prompt_id is not null)
      or (kind = 'status' and post_id is null and prompt_id is null and started_by is not null and context is not null));
  else
    alter table public.random_chat_sessions add constraint random_sessions_kind_context check (
      (kind = 'status' and started_by is not null and context is not null)
      or (kind <> 'status' and status_id is null));
  end if;
end;
$$;

-- One conversation per status and replier (reused whatever its state).
create unique index if not exists random_sessions_status_pair_idx
  on public.random_chat_sessions (status_id, user_b) where kind = 'status';
create index if not exists random_sessions_started_by_idx
  on public.random_chat_sessions (started_by, started_at desc) where started_by is not null;

-- The pinned context of a conversation for one participant. Status conversations carry their
-- snapshot in `context`; post / prompt conversations (220) have public.session_context(), used
-- here when it exists so that both features keep working whichever migration ran last.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'session_context'
  ) then
    execute $f$
      create or replace function public.conversation_context(s public.random_chat_sessions, viewer uuid)
      returns jsonb
      language sql
      stable
      security definer
      set search_path = ''
      as $b$
        select case when s.kind = 'status' then s.context else public.session_context(s, viewer) end
      $b$
    $f$;
  else
    execute $f$
      create or replace function public.conversation_context(s public.random_chat_sessions, viewer uuid)
      returns jsonb
      language sql
      stable
      security definer
      set search_path = ''
      as $b$
        select case when s.kind = 'status' then s.context end
      $b$
    $f$;
  end if;
end;
$$;

revoke execute on function public.conversation_context(public.random_chat_sessions, uuid) from public, anon, authenticated;

-- get_blind_session: same columns as 20261009000220 (a superset of 20261009000190). Without an
-- id it returns only the newest active BLIND date, so a status conversation never hijacks the
-- Blind Dating screen. The partner profile is included after a match, or from the start when
-- revealed_from_start (status and prompt conversations); never otherwise.
drop function if exists public.get_blind_session(uuid);

create function public.get_blind_session(p_session uuid default null)
returns table (
  id                  uuid,
  my_side             text,
  my_alias            int,
  partner_alias       int,
  my_decision         boolean,
  state               text,
  common_tags         text[],
  partner             jsonb,
  match_id            uuid,
  started_at          timestamptz,
  kind                text,
  context             jsonb,
  my_messages         int,
  partner_messages    int,
  revealed_from_start boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select rs as sess, rs.*,
           case when rs.user_a = (select auth.uid()) then 'a' else 'b' end as side,
           case when rs.user_a = (select auth.uid()) then rs.user_b else rs.user_a end as other
    from public.random_chat_sessions rs
    where (select auth.uid()) in (rs.user_a, rs.user_b)
      and (case when p_session is null then rs.status = 'active' and rs.kind = 'blind'
                else rs.id = p_session end)
    order by rs.started_at desc
    limit 1
  )
  select
    s.id,
    s.side,
    (case s.side when 'a' then s.alias_a else s.alias_b end)::int,
    (case s.side when 'a' then s.alias_b else s.alias_a end)::int,
    case s.side when 'a' then s.decision_a else s.decision_b end,
    public.blind_state(s.sess, s.side),
    case when s.kind = 'blind' then coalesce((
      select array_agg(t.slug order by t.slug)
      from public.profile_tags mine
      join public.profile_tags theirs on theirs.tag_id = mine.tag_id and theirs.profile_id = s.other
      join public.tags t on t.id = mine.tag_id
      where mine.profile_id = (select auth.uid())
    ), '{}') else '{}' end,
    case when (s.end_reason = 'matched' or s.revealed_from_start) and public.can_view_profile(s.other) then (
      select jsonb_build_object(
        'id', p.id, 'display_name', p.display_name,
        'age', public.age_in_years(p.birth_date), 'bio', p.bio, 'city', p.city,
        'relationship_goal', p.relationship_goal, 'job_title', p.job_title)
      from public.profiles p where p.id = s.other
    ) end,
    case when s.end_reason = 'matched' then s.match_id end,
    s.started_at,
    s.kind,
    public.conversation_context(s.sess, (select auth.uid())),
    (select count(*) from public.random_chat_messages m
     where m.session_id = s.id and m.sender_id = (select auth.uid()))::int,
    (select count(*) from public.random_chat_messages m
     where m.session_id = s.id and m.sender_id <> (select auth.uid()))::int,
    s.revealed_from_start
  from s;
$$;

revoke execute on function public.get_blind_session(uuid) from public, anon;
grant execute on function public.get_blind_session(uuid) to authenticated;

-- Reply to a status: starts (or continues) the caller's conversation with its author, sending
-- p_body as the first message. Not allowed: own status, a status that is held, removed, replaced
-- or expired, an author the caller may not see (banned, paused, blocked either way,
-- shadow-banned, incognito), more than 10 new conversations in 24 hours (P0429), muted (VS001
-- from the message trigger). user_a is the author, user_b the replier.
-- Returns {"session_id", "message_id" | null, "created": bool, "state"}.
create function public.start_status_conversation(p_status uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    uuid := (select auth.uid());
  st    public.user_statuses;
  s     public.random_chat_sessions;
  v_msg uuid;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(coalesce(p_body, '')), '') is null then
    raise exception 'Message required' using errcode = 'invalid_parameter_value';
  end if;

  select * into st from public.user_statuses where id = p_status;
  if st.id is null then
    raise exception 'Status not found' using errcode = 'no_data_found';
  end if;
  if st.user_id = me then
    raise exception 'Cannot reply to your own status' using errcode = 'insufficient_privilege';
  end if;

  select * into s from public.random_chat_sessions
  where kind = 'status' and status_id = p_status and user_b = me
  for update;

  if s.id is null then
    if st.moderation_state <> 'visible' or st.replaced_at is not null or st.expires_at <= now()
       or not public.status_visible_to(me, st.user_id) then
      raise exception 'Status not found' using errcode = 'no_data_found';
    end if;
    if (select count(*) from public.random_chat_sessions
        where started_by = me and kind = 'status' and started_at > now() - interval '24 hours') >= 10 then
      raise exception 'Too many replies today' using errcode = 'P0429';
    end if;
    insert into public.random_chat_sessions
      (user_a, user_b, kind, status_id, started_by, revealed_from_start, context)
    values (st.user_id, me, 'status', st.id, me, true, jsonb_build_object(
      'status_id', st.id, 'author_id', st.user_id, 'emoji', st.emoji, 'text', st.text,
      'plan_tag', st.plan_tag, 'expires_at', st.expires_at))
    returning * into s;
    v_msg := public.randomizer_send(s.id, p_body);
    perform realtime.send(jsonb_build_object('session_id', s.id), 'conversation',
      'randomizer:' || st.user_id::text, true);
    return jsonb_build_object('session_id', s.id, 'message_id', v_msg, 'created', true, 'state', 'active');
  end if;

  if s.status = 'active' then
    v_msg := public.randomizer_send(s.id, p_body);
    return jsonb_build_object('session_id', s.id, 'message_id', v_msg, 'created', false, 'state', 'active');
  end if;
  return jsonb_build_object('session_id', s.id, 'message_id', null, 'created', false,
    'state', public.blind_state(s, 'b'));
end;
$$;

-- The caller's status conversations for the Chats screen: partner (names are shown from the
-- start), the pinned status, the latest message. Active ones first, then matched / ended ones of
-- the last 7 days.
create function public.list_status_conversations()
returns table (
  id          uuid,
  my_side     text,
  state       text,
  i_am_author boolean,
  partner     jsonb,
  context     jsonb,
  last_body   text,
  last_at     timestamptz,
  last_mine   boolean,
  started_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rs.id,
    case when rs.user_a = (select auth.uid()) then 'a' else 'b' end,
    public.blind_state(rs, case when rs.user_a = (select auth.uid()) then 'a' else 'b' end),
    rs.user_a = (select auth.uid()),
    case when public.can_view_profile(o.id) then
      jsonb_build_object('id', o.id, 'display_name', o.display_name,
        'age', public.age_in_years(o.birth_date),
        'photo', (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
                  from public.profile_photos ph where ph.profile_id = o.id order by ph.position limit 1))
    end,
    rs.context,
    lm.body,
    lm.created_at,
    lm.sender_id = (select auth.uid()),
    rs.started_at
  from public.random_chat_sessions rs
  join public.profiles o on o.id = case when rs.user_a = (select auth.uid()) then rs.user_b else rs.user_a end
  left join lateral (
    select m.body, m.created_at, m.sender_id from public.random_chat_messages m
    where m.session_id = rs.id order by m.created_at desc, m.id desc limit 1
  ) lm on true
  where rs.kind = 'status'
    and (select auth.uid()) in (rs.user_a, rs.user_b)
    and (rs.status = 'active' or rs.ended_at > now() - interval '7 days')
  order by (rs.status = 'active') desc, coalesce(lm.created_at, rs.started_at) desc
  limit 100;
$$;

-- randomizer_join must ignore non-blind conversations in its "already in a session" check,
-- otherwise an open status reply would block starting a blind date. Same patch as 220 (skipped
-- when already applied).
do $$
declare
  r   record;
  def text;
  old constant text := 'where status = ''active'' and me.id in (user_a, user_b)';
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'randomizer_join'
  loop
    def := pg_get_functiondef(r.oid);
    if def like '%kind = ''blind''%' then
      continue;
    elsif position(old in def) > 0 then
      execute replace(def, old, 'where status = ''active'' and kind = ''blind'' and me.id in (user_a, user_b)');
    else
      raise warning 'randomizer_join: add "and kind = ''blind''" to its active-session check (20261009000271)';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Pushes
-- ---------------------------------------------------------------------------------------------

alter table public.notification_prefs add column if not exists status_replies boolean not null default true;
grant insert (status_replies), update (status_replies) on public.notification_prefs to authenticated;

-- Server only (after a message in a status conversation): who to notify, or null (other kinds,
-- ended sessions, blocked pairs, inactive recipients, or a push for this session went out in the
-- last 10 minutes). Claims the slot atomically.
create function public.claim_status_push(p_message uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m         public.random_chat_messages;
  s         public.random_chat_sessions;
  recipient uuid;
begin
  select * into m from public.random_chat_messages where id = p_message;
  if m.id is null then
    return null;
  end if;
  select * into s from public.random_chat_sessions where id = m.session_id for update;
  if s.kind <> 'status' or s.status <> 'active' then
    return null;
  end if;
  recipient := case when s.user_a = m.sender_id then s.user_b else s.user_a end;
  if public.is_blocked_between(s.user_a, s.user_b)
     or not exists (select 1 from public.profiles where id = recipient and is_active)
     or s.last_push_at > now() - interval '10 minutes' then
    return null;
  end if;
  update public.random_chat_sessions set last_push_at = now() where id = s.id;
  return jsonb_build_object(
    'recipient', recipient,
    'session_id', s.id,
    'sender_name', (select display_name from public.profiles where id = m.sender_id),
    'is_first', (select count(*) from public.random_chat_messages where session_id = s.id) = 1);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reports: the subject of a status report is its author (newest reports_set_subject was
-- 20261009000161; copied with the 'status' branch added).
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
    when 'status' then
      select user_id into new.subject_id from public.user_statuses where id = new.target_id;
  end case;

  if new.target_type in ('message', 'photo', 'call', 'status') then
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

-- ---------------------------------------------------------------------------------------------
-- Admin (/admin/statuses): the review queue and the decision. Service role only; roles checked
-- in the database (assert_admin_role); every decision logged.
-- ---------------------------------------------------------------------------------------------

-- p_filter: 'held' (default) = waiting for review, 'reported' = with open reports,
-- 'recent' = everything of the last 7 days.
create function public.admin_status_queue(
  p_admin  uuid,
  p_filter text default 'held',
  p_limit  int default 30,
  p_offset int default 0
)
returns table (
  id               uuid,
  user_id          uuid,
  display_name     text,
  username         text,
  emoji            text,
  text             text,
  plan_tag         text,
  moderation_state text,
  held_kinds       text[],
  created_at       timestamptz,
  expires_at       timestamptz,
  replaced_at      timestamptz,
  reviewed_at      timestamptz,
  open_reports     int,
  banned           boolean,
  total            bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  if p_filter not in ('held', 'reported', 'recent') then
    raise exception 'Unknown filter %', p_filter using errcode = 'check_violation';
  end if;
  return query
  select s.id, s.user_id, p.display_name, p.username, s.emoji, s.text, s.plan_tag,
    s.moderation_state, s.held_kinds, s.created_at, s.expires_at, s.replaced_at, s.reviewed_at,
    (select count(*)::int from public.reports r
     where r.target_type = 'status' and r.target_id = s.id and r.resolved_at is null),
    p.banned_at is not null,
    count(*) over ()
  from public.user_statuses s
  join public.profiles p on p.id = s.user_id
  where case p_filter
    when 'held' then s.moderation_state = 'held'
    when 'reported' then exists (select 1 from public.reports r
      where r.target_type = 'status' and r.target_id = s.id and r.resolved_at is null)
    else s.created_at > now() - interval '7 days'
  end
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- approve: held -> visible; remove: -> removed (hidden everywhere). Either decision closes the
-- open reports on the status (decision 'dismiss' / 'hide') in the same transaction and is logged
-- as status.approve / status.remove. Returns {"closed": n}.
create function public.admin_moderate_status(
  p_admin    uuid,
  p_status   uuid,
  p_decision text,
  p_reason   text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  note   text := nullif(btrim(p_reason), '');
  closed int;
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  if p_decision not in ('approve', 'remove') then
    raise exception 'Unknown decision %', p_decision using errcode = 'check_violation';
  end if;

  update public.user_statuses
  set moderation_state = case p_decision when 'approve' then 'visible' else 'removed' end,
      reviewed_by = p_admin, reviewed_at = now()
  where id = p_status;
  if not found then
    raise exception 'Status not found' using errcode = 'no_data_found';
  end if;

  update public.reports
  set resolved_at = now(), resolved_by = p_admin,
      decision = case p_decision when 'approve' then 'dismiss' else 'hide' end,
      resolution = left(coalesce(note,
        case p_decision when 'approve' then 'no_violation' else 'status_removed' end), 500)
  where target_type = 'status' and target_id = p_status and resolved_at is null;
  get diagnostics closed = row_count;
  delete from public.report_claims where target_type = 'status' and target_id = p_status;

  perform public.log_moderation(p_admin, 'status.' || p_decision, 'status', p_status, note);
  return jsonb_build_object('closed', closed);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------------------------

-- Visible statuses: 24 hours after they expired or were replaced. Held and removed: 90 days.
-- Anything under an open report stays until the report is resolved. Conversations keep their
-- own retention (status_id becomes null; the snapshot in context stays).
create function public.purge_live_statuses()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from public.user_statuses s
  where not exists (
      select 1 from public.reports r
      where r.target_type = 'status' and r.target_id = s.id and r.resolved_at is null)
    and case s.moderation_state
      when 'visible' then least(s.expires_at, coalesce(s.replaced_at, s.expires_at)) < now() - interval '24 hours'
      else s.created_at < now() - interval '90 days'
    end;
  get diagnostics n = row_count;
  return n;
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
    'set_status(text, text, text)',
    'clear_status()',
    'get_my_status()',
    'get_live_statuses(int)',
    'start_status_conversation(uuid, text)',
    'list_status_conversations()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  foreach fn in array array[
    'claim_status_push(uuid)',
    'admin_status_queue(uuid, text, int, int)',
    'admin_moderate_status(uuid, uuid, text, text)',
    'purge_live_statuses()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- Hourly where pg_cron exists (Supabase; not the local test database).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-live-statuses', '17 * * * *', 'select public.purge_live_statuses()');
  end if;
end;
$$;
