-- VIP perks (needs 20261009000280_plans: has_feature, feature_limit, is_staff, SQLSTATE VP402).
-- Every perk is gated in the database with has_feature(uid, key) (VIP, staff always allowed):
--
-- 1. Read receipts (feature 'read_receipts').
--    Read state moves out of messages.read_at into match_reads (one row per match and reader:
--    "read up to"). Writing read_at on the message itself sent a postgres_changes UPDATE to the
--    sender, which told them the message was read whatever the plan or privacy setting said.
--    * mark_match_read(match): the reader's read-up-to moves to now. When the SENDER may see it
--      (read_receipts_visible) a 'read' broadcast goes to the private match:<id> topic, so the
--      ticks update live; the reader's other devices get a 'read' broadcast on inbox:<me>.
--    * match_read_state(match): what the caller may see of the partner's reading.
--    * profiles.send_read_receipts (default on, my_read_receipts / set_read_receipts). Off: nobody
--      sees this person's read state, and (fairness, like WhatsApp) they see nobody's either.
--    * Clients can no longer write messages.read_at (column grant and policy dropped). Old values
--      stay (they were visible before). Unread counts honour both: a message is unread while its
--      read_at is null and it is newer than the reader's match_reads row.
-- 2. Profile visitors (feature 'profile_visitors').
--    * record_profile_visit(target): one row per (viewer, viewed, Malaysia day). Not recorded for
--      self, staff, incognito, shadow-banned, unverified or inactive viewers, or when either side
--      blocked the other (can_view_profile). Incognito is how a VIP hides their own visits.
--    * my_profile_visitors(): VIP/staff get the list (name, age, first photo, when, liked);
--      everybody else only the count (no photos, no ids: the blurred avatars are placeholders).
--    * Kept 30 days (purge_old_profile_visits, pg_cron).
-- 3. Discover priority (feature 'discover_priority'): get_swipe_candidates (copied from its
--    newest definition, same signature) shows priority profiles first to viewers who joined in the
--    last 14 days, when the profile is in the same city or within 30 km. After the boost key,
--    before everything else; viewers older than 14 days see the old order.
-- 4. Message before match (feature 'message_before_match', limit feature_limit per 24 h).
--    * send_like_note(target, body): a like with a note (1..200 chars). The note goes through the
--      risk detector of 20261009000163: any signal holds it (state 'held', never shown). One note
--      per pair. A pass on that person is replaced by the like.
--    * incoming_like_notes(ids): the recipient reads visible notes of people who like them and
--      can still be seen (blocks, bans, shadow bans and incognito hide them).
--    * When the pair matches (any source), the visible note becomes the first chat message.
--    * Report target 'like_note' (20261009000289): the subject is the sender; reporting hides the
--      note at once. admin_open_like_note shows the text to a moderator of an open report, logged.
--    * Kept 90 days (retention protocol), longer only under an open report.

-- =============================================================================================
-- 1. Read receipts
-- =============================================================================================
-- Not readable or writable by clients directly (other people must not learn the setting).
alter table public.profiles add column send_read_receipts boolean not null default true;

create table public.match_reads (
  match_id     uuid not null references public.matches (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.match_reads enable row level security;
revoke all on public.match_reads from anon, authenticated;

-- Clients stop writing read_at: reads go through mark_match_read.
drop policy if exists "messages: mark read" on public.messages;
revoke update (read_at) on public.messages from authenticated;

create index messages_match_sender_created_idx on public.messages (match_id, sender_id, created_at desc);

-- May p_viewer (a sender) see when p_reader read their messages? Both must have receipts on and
-- the viewer must have the perk.
create function public.read_receipts_visible(p_viewer uuid, p_reader uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select v.send_read_receipts from public.profiles v where v.id = p_viewer), false)
     and coalesce((select r.send_read_receipts from public.profiles r where r.id = p_reader), false)
     and public.has_feature(p_viewer, 'read_receipts');
$$;

-- The caller read the chat up to now. Returns the new read-up-to (null: not a participant).
create function public.mark_match_read(p_match uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  partner uuid;
  prev    timestamptz;
  ts      timestamptz := now();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  select case when m.user_a = me then m.user_b else m.user_a end into partner
  from public.matches m
  where m.id = p_match and me in (m.user_a, m.user_b);
  if partner is null then
    return null;
  end if;

  select r.last_read_at into prev from public.match_reads r
  where r.match_id = p_match and r.user_id = me;
  -- Nothing new from the partner: no write, no broadcast.
  if prev is not null and not exists (
    select 1 from public.messages x
    where x.match_id = p_match and x.sender_id = partner and x.created_at > prev
  ) then
    return prev;
  end if;

  insert into public.match_reads (match_id, user_id, last_read_at) values (p_match, me, ts)
  on conflict (match_id, user_id) do update set last_read_at = excluded.last_read_at;

  -- The reader's other tabs and devices refresh their unread badge.
  perform realtime.send(jsonb_build_object('match_id', p_match), 'read', 'inbox:' || me::text, true);
  -- Live ticks for the sender, only when they may see them (both topics are private).
  if public.read_receipts_visible(partner, me) then
    perform realtime.send(jsonb_build_object('reader', me, 'at', ts), 'read',
      'match:' || p_match::text, true);
  end if;
  return ts;
end;
$$;

-- What the caller may see of the partner's reading:
--   {"enabled": bool, "seen_up_to": timestamptz|null}
-- enabled: the caller has the perk and receipts on (otherwise the app shows "sent" only).
-- seen_up_to: the partner read everything the caller sent up to then (null when the partner
-- turned receipts off, or has not read anything yet). Old read_at values count too.
create function public.match_read_state(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  partner uuid;
  enabled boolean;
  seen    timestamptz;
begin
  select case when m.user_a = me then m.user_b else m.user_a end into partner
  from public.matches m
  where m.id = p_match and me in (m.user_a, m.user_b);
  if me is null or partner is null then
    return null;
  end if;
  enabled := coalesce((select p.send_read_receipts from public.profiles p where p.id = me), false)
             and public.has_feature(me, 'read_receipts');
  if enabled and public.read_receipts_visible(me, partner) and public.can_view_profile(partner) then
    select greatest(
      (select r.last_read_at from public.match_reads r where r.match_id = p_match and r.user_id = partner),
      (select max(x.created_at) from public.messages x
       where x.match_id = p_match and x.sender_id = me and x.read_at is not null))
    into seen;
  end if;
  return jsonb_build_object('enabled', enabled, 'seen_up_to', seen);
end;
$$;

-- The caller's own read-up-to per match (chat list unread counts).
create function public.my_match_reads()
returns table (match_id uuid, last_read_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.match_id, r.last_read_at from public.match_reads r where r.user_id = (select auth.uid());
$$;

-- Settings: {"send": bool, "available": bool}. available: the caller has the perk.
create function public.my_read_receipts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('send', p.send_read_receipts,
                            'available', public.has_feature(p.id, 'read_receipts'))
  from public.profiles p where p.id = (select auth.uid());
$$;

create function public.set_read_receipts(p_send boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or p_send is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  update public.profiles set send_read_receipts = p_send where id = me;
  return p_send;
end;
$$;

-- Unread badge: newest definition was 20261008000060; now also newer than the caller's
-- match_reads row. SECURITY INVOKER as before (RLS limits the messages), match_reads read
-- through my_match_reads.
create or replace function public.unread_message_count()
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.messages m
  left join public.my_match_reads() r on r.match_id = m.match_id
  where m.read_at is null
    and m.deleted_at is null
    and m.sender_id <> (select auth.uid())
    and (r.last_read_at is null or m.created_at > r.last_read_at)
    and public.is_match_participant(m.match_id)
    and public.can_view_profile(m.sender_id);
$$;

-- =============================================================================================
-- 2. Profile visitors
-- =============================================================================================
create table public.profile_visits (
  viewer_id  uuid not null references public.profiles (id) on delete cascade,
  viewed_id  uuid not null references public.profiles (id) on delete cascade,
  -- Malaysia calendar day: one row per pair and day.
  day        date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  visited_at timestamptz not null default now(),
  primary key (viewer_id, viewed_id, day),
  check (viewer_id <> viewed_id)
);

create index profile_visits_viewed_idx on public.profile_visits (viewed_id, visited_at desc);
create index profile_visits_visited_idx on public.profile_visits (visited_at);

alter table public.profile_visits enable row level security;
revoke all on public.profile_visits from anon, authenticated;

-- Records that the caller opened p_target's profile (profile page or "More" on a card).
-- Returns whether a visit was recorded; never raises for a skipped visit.
create function public.record_profile_visit(p_target uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v  record;
begin
  if me is null or p_target is null or p_target = me then
    return false;
  end if;
  select p.verification_status, p.is_active, p.is_incognito, p.shadow_banned, p.banned_at
  into v from public.profiles p where p.id = me;
  if v.verification_status is distinct from 'approved' or not v.is_active or v.is_incognito
     or v.shadow_banned or v.banned_at is not null or public.is_staff(me) then
    return false;
  end if;
  -- Target approved and active, no block either way.
  if not public.can_view_profile(p_target) then
    return false;
  end if;
  insert into public.profile_visits (viewer_id, viewed_id)
  values (me, p_target)
  on conflict (viewer_id, viewed_id, day) do update set visited_at = now();
  return true;
end;
$$;

-- Visitors of the last 30 days, still visible to the caller (blocks, bans, shadow bans and
-- incognito hide them; paused or deleted profiles drop out too).
--   {"full": bool, "count": int, "visitors": [...]}
-- visitors (only when full): {id, name, age, photo: {path, width, height}|null, visited_at,
-- liked: the caller already liked them}, newest first, at most p_limit.
create function public.my_profile_visitors(p_limit int default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  is_full boolean;
  result jsonb;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  is_full := public.has_feature(me, 'profile_visitors');

  with visitors as (
    select v.viewer_id as id, max(v.visited_at) as visited_at
    from public.profile_visits v
    join public.profiles p on p.id = v.viewer_id
    where v.viewed_id = me
      and v.visited_at > now() - interval '30 days'
      and p.verification_status = 'approved'
      and p.is_active
      and not p.shadow_banned
      and not p.is_incognito
      and p.banned_at is null
      and not public.is_blocked_between(me, p.id)
    group by v.viewer_id
  ),
  shown as (
    select t.id, t.visited_at from visitors t
    where is_full
    order by t.visited_at desc
    limit least(greatest(coalesce(p_limit, 60), 1), 100)
  )
  select jsonb_build_object(
    'full', is_full,
    'count', (select count(*)::int from visitors),
    'visitors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.display_name,
        'age', public.age_in_years(p.birth_date),
        'photo', (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
                  from public.profile_photos ph where ph.profile_id = p.id
                  order by ph.position limit 1),
        'visited_at', s.visited_at,
        'liked', exists (select 1 from public.swipes w
                         where w.swiper_id = me and w.swiped_id = p.id and w.direction = 'like'))
        order by s.visited_at desc)
      from shown s join public.profiles p on p.id = s.id), '[]'::jsonb))
  into result;
  return result;
end;
$$;

create function public.purge_old_profile_visits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.profile_visits where visited_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- =============================================================================================
-- 3. Discover priority: get_swipe_candidates copied from its newest definition
--    (20261009000230: boost first, then "Similar plans"). One new ORDER BY key after the boost.
-- =============================================================================================
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
  -- Joined in the last 14 days: priority profiles nearby come first (20261009000290).
  me_new boolean;
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
  me_new := me.created_at > now() - interval '14 days';

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
           -- Discover priority for new users nearby (20261009000290)
           (me_new
            and (lower(btrim(p.city)) = lower(btrim(me.city))
                 or (me.location is not null and p.location is not null
                     and extensions.st_dwithin(me.location, p.location, 30000)))
            and public.has_feature(p.id, 'discover_priority')) desc,
           (my_plan is not null and pl.tag is not distinct from my_plan) desc,
           c.second_chance,
           p.last_active_at desc
  limit p_limit;
end;
$$;

-- =============================================================================================
-- 4. Message before match: notes attached to likes
-- =============================================================================================
create table public.like_notes (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 200 and body ~ '\S'),
  -- visible: shown to the recipient; held: the risk detector found a signal (never shown);
  -- reported: the recipient reported it (hidden); delivered: became the first chat message.
  state        text not null default 'visible'
               check (state in ('visible', 'held', 'reported', 'delivered')),
  held_kinds   text[] not null default '{}',
  match_id     uuid references public.matches (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);

create index like_notes_recipient_idx on public.like_notes (recipient_id, created_at desc);
create index like_notes_sender_idx on public.like_notes (sender_id, created_at desc);

alter table public.like_notes enable row level security;
revoke all on public.like_notes from anon, authenticated;

-- A like with a note. Errors: 42501 not verified, VS001 muted, VP402 no perk (detail = feature
-- key), P0429 daily limit, 22023 bad text or target, 23505 a note to this person exists already.
-- Returns {"note_id", "state": "visible"|"held", "match_id": uuid|null}.
create function public.send_like_note(p_target uuid, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  lim    int;
  used   int;
  kinds  text[];
  nid    uuid;
  mid    uuid;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.profiles where id = me and muted_until > now()) then
    raise exception 'muted' using errcode = 'VS001';
  end if;
  if not public.has_feature(me, 'message_before_match') then
    raise exception 'Plan required' using errcode = 'VP402', detail = 'message_before_match';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 200 then
    raise exception 'Note must be 1 to 200 characters' using errcode = 'invalid_parameter_value';
  end if;
  if p_target is null or p_target = me or not public.can_view_profile(p_target) then
    raise exception 'Profile not available' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.matches m
             where m.user_a = least(me, p_target) and m.user_b = greatest(me, p_target)) then
    raise exception 'Already matched' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.like_notes n where n.sender_id = me and n.recipient_id = p_target) then
    raise exception 'Note already sent' using errcode = 'unique_violation';
  end if;

  -- Daily limit (rolling 24 h). Staff: feature_limit null = unlimited.
  lim := public.feature_limit(me, 'message_before_match');
  if lim is not null then
    perform pg_advisory_xact_lock(hashtextextended('like_note:' || me::text, 0));
    select count(*)::int into used from public.like_notes n
    where n.sender_id = me and n.created_at > now() - interval '24 hours';
    if used >= lim then
      raise exception 'Daily note limit reached' using errcode = 'P0429';
    end if;
  end if;

  select coalesce(array_agg(distinct r.kind), '{}') into kinds from public.detect_message_risk(v_body) r;

  insert into public.like_notes (sender_id, recipient_id, body, state, held_kinds)
  values (me, p_target, v_body, case when cardinality(kinds) > 0 then 'held' else 'visible' end, kinds)
  returning id into nid;

  -- The like itself (a pass becomes the like). A mutual like creates the match through the
  -- swipes trigger, whose matches trigger delivers the note as the first message.
  delete from public.swipes where swiper_id = me and swiped_id = p_target and direction = 'pass';
  insert into public.swipes (swiper_id, swiped_id, direction) values (me, p_target, 'like')
  on conflict (swiper_id, swiped_id) do nothing;

  select m.id into mid from public.matches m
  where m.user_a = least(me, p_target) and m.user_b = greatest(me, p_target);
  return jsonb_build_object('note_id', nid,
    'state', (select n.state from public.like_notes n where n.id = nid),
    'match_id', mid);
end;
$$;

-- Visible notes for the caller from people who like them and can still be seen. p_ids limits
-- them to these senders (Discover cards); null = all ("Who liked you").
create function public.incoming_like_notes(p_ids uuid[] default null)
returns table (id uuid, sender_id uuid, first_name text, body text, created_at timestamptz)
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
  select n.id, n.sender_id, split_part(btrim(p.display_name), ' ', 1), n.body, n.created_at
  from public.like_notes n
  join public.profiles p on p.id = n.sender_id
  where n.recipient_id = me
    and n.state = 'visible'
    and (p_ids is null or n.sender_id = any (p_ids[1:200]))
    and p.verification_status = 'approved'
    and p.is_active
    and not p.shadow_banned
    and p.banned_at is null
    and not public.is_blocked_between(me, n.sender_id)
    and exists (select 1 from public.swipes s
                where s.swiper_id = n.sender_id and s.swiped_id = me and s.direction = 'like')
  order by n.created_at desc
  limit 200;
end;
$$;

-- The caller's own note to p_target, if any (profile page: "Note sent").
create function public.my_like_note(p_target uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('body', n.body, 'state',
           case when n.state = 'reported' then 'visible' else n.state end, 'created_at', n.created_at)
  from public.like_notes n
  where n.sender_id = (select auth.uid()) and n.recipient_id = p_target;
$$;

-- A new match (any source): the visible note between the pair becomes the first message.
-- Never blocks the match: a failure (muted sender, rate limit) just leaves the note undelivered.
create function public.matches_deliver_like_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
begin
  for n in
    select * from public.like_notes
    where state = 'visible'
      and ((sender_id = new.user_a and recipient_id = new.user_b)
        or (sender_id = new.user_b and recipient_id = new.user_a))
    order by created_at
  loop
    begin
      insert into public.messages (match_id, sender_id, body, created_at)
      values (new.id, n.sender_id, n.body, greatest(n.created_at, new.created_at));
      update public.like_notes set state = 'delivered', match_id = new.id where id = n.id;
    exception when others then
      null;
    end;
  end loop;
  return null;
end;
$$;

create trigger matches_deliver_like_notes
  after insert on public.matches
  for each row execute function public.matches_deliver_like_notes();

-- Reporting a note hides it from the recipient at once.
create function public.reports_hide_like_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.like_notes set state = 'reported'
  where id = new.target_id and recipient_id = new.reporter_id and state = 'visible';
  return null;
end;
$$;

create trigger reports_hide_like_note
  after insert on public.reports
  for each row when (new.target_type = 'like_note')
  execute function public.reports_hide_like_note();

-- Reports: newest reports_set_subject was 20261009000271 (live statuses); copied with every
-- branch kept and 'like_note' added (only the recipient can report a note).
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
    -- Group reports (20261009000261): the reporter must be (or have been) a member of that group.
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
    when 'status' then
      select user_id into new.subject_id from public.user_statuses where id = new.target_id;
    -- Like notes (20261009000290): only the recipient can report one.
    when 'like_note' then
      select n.sender_id into new.subject_id from public.like_notes n
      where n.id = new.target_id and n.recipient_id = new.reporter_id;
  end case;

  if new.target_type in ('message', 'photo', 'call', 'group_message', 'group_member', 'status',
                         'like_note') then
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

-- Admin: the text of a reported note, for a moderator handling an open report on it. Every
-- opening is logged (view.like_note). Service role only.
create function public.admin_open_like_note(p_admin uuid, p_note uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.like_notes;
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  if not exists (select 1 from public.reports r
                 where r.target_type = 'like_note' and r.target_id = p_note and r.resolved_at is null) then
    raise exception 'No open report on this note' using errcode = 'insufficient_privilege';
  end if;
  select * into n from public.like_notes where id = p_note;
  if n.id is null then
    return null;
  end if;
  insert into public.moderation_actions (admin_id, action, target_type, target_id, reason)
  values (p_admin, 'view.like_note', 'like_note', p_note, null);
  return jsonb_build_object('id', n.id, 'sender_id', n.sender_id, 'recipient_id', n.recipient_id,
    'body', n.body, 'state', n.state, 'held_kinds', to_jsonb(n.held_kinds), 'created_at', n.created_at);
end;
$$;

-- Retention: 90 days, longer only while an open report is attached.
create function public.purge_old_like_notes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.like_notes l
  where l.created_at < now() - interval '90 days'
    and not exists (select 1 from public.reports r
                    where r.target_type = 'like_note' and r.target_id = l.id and r.resolved_at is null);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- =============================================================================================
-- Grants
-- =============================================================================================
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'read_receipts_visible(uuid, uuid)',
    'mark_match_read(uuid)',
    'match_read_state(uuid)',
    'my_match_reads()',
    'my_read_receipts()',
    'set_read_receipts(boolean)',
    'record_profile_visit(uuid)',
    'my_profile_visitors(int)',
    'purge_old_profile_visits()',
    'send_like_note(uuid, text)',
    'incoming_like_notes(uuid[])',
    'my_like_note(uuid)',
    'matches_deliver_like_notes()',
    'reports_hide_like_note()',
    'admin_open_like_note(uuid, uuid)',
    'purge_old_like_notes()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'mark_match_read(uuid)',
    'match_read_state(uuid)',
    'my_match_reads()',
    'my_read_receipts()',
    'set_read_receipts(boolean)',
    'record_profile_visit(uuid)',
    'my_profile_visitors(int)',
    'send_like_note(uuid, text)',
    'incoming_like_notes(uuid[])',
    'my_like_note(uuid)'
  ] loop
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  foreach fn in array array[
    'purge_old_profile_visits()',
    'admin_open_like_note(uuid, uuid)',
    'purge_old_like_notes()'
  ] loop
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- Daily at 04:07 / 04:12 Malaysia time, only where pg_cron exists (see 20261008000022).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-old-profile-visits', '7 20 * * *',
      'select public.purge_old_profile_visits()');
    perform cron.schedule('purge-old-like-notes', '12 20 * * *',
      'select public.purge_old_like_notes()');
  end if;
end;
$$;
