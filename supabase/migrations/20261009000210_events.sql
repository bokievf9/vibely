-- Blind Dating Night: a scheduled, time-gated shared room for Blind Dating.
--
-- Same rules as a normal blind date (no timer, Connect/Pass any time, transcript kept 90 days,
-- reports/blocks/mutes/bans apply), with its own pool:
--   * while an event is live, a join with p_event_id pairs only inside that event's queue;
--   * filters are relaxed to the chosen genders plus a wide age band (the user's age +/- 10);
--   * after a Pass both people go back into the event queue (the client re-joins as well);
--   * when the event ends the event queue is closed; sessions in progress continue until decided.
-- Time: starts_at / ends_at are timestamptz; the admin panel enters Malaysia time (+08:00, no DST).
-- Status is flipped by event_tick() (pg_cron every minute, and the push job as a fallback); joins
-- and get_current_event() also apply the clock themselves, so a late tick never blocks a room.
-- Push: event_push_due() (service_role) hands the "15 minutes before" and "starts now" reminders
-- to POST /api/cron/events-push, which sends them through the regular push pipeline (type 'events').

create type public.event_status as enum ('draft', 'scheduled', 'live', 'ended', 'cancelled');

create table public.scheduled_events (
  id          uuid primary key default gen_random_uuid(),
  title_en    text not null check (char_length(btrim(title_en)) between 1 and 80),
  title_ms    text not null check (char_length(btrim(title_ms)) between 1 and 80),
  title_ru    text not null check (char_length(btrim(title_ru)) between 1 and 80),
  -- Free text shown under the title (same in every language, e.g. "Coffee lovers").
  theme       text check (char_length(theme) <= 120),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  recurrence  text check (recurrence in ('weekly')),
  status      public.event_status not null default 'scheduled',
  -- The occurrence this one was created from (weekly repeat).
  parent_id   uuid references public.scheduled_events (id) on delete set null,
  created_by  uuid references auth.users (id) on delete set null,
  ended_at    timestamptz,
  -- Refreshed by event_tick() while the event is live and for a week after; kept after the
  -- participant rows are purged (90 days), so past events keep their numbers.
  stats_joined  int not null default 0,
  stats_pairs   int not null default 0,
  stats_matches int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '12 hours')
);

create index scheduled_events_upcoming_idx on public.scheduled_events (starts_at)
  where status in ('scheduled', 'live');

-- Who joined the room at least once (stats, and the genders to re-queue with after a Pass).
create table public.event_participants (
  event_id     uuid not null references public.scheduled_events (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  want_genders public.gender[] not null,
  joined_at    timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- "Remind me": one row per user and event; the two push stamps keep the job idempotent.
create table public.event_reminders (
  event_id         uuid not null references public.scheduled_events (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  reminder_sent_at timestamptz,
  start_sent_at    timestamptz,
  primary key (event_id, user_id)
);

alter table public.scheduled_events enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_reminders enable row level security;
revoke all on public.scheduled_events, public.event_participants, public.event_reminders
  from anon, authenticated;

alter table public.random_chat_queue
  add column event_id uuid references public.scheduled_events (id) on delete cascade;
alter table public.random_chat_sessions
  add column event_id uuid references public.scheduled_events (id) on delete set null;

create index random_chat_queue_event_idx on public.random_chat_queue (event_id) where event_id is not null;
create index random_sessions_event_idx on public.random_chat_sessions (event_id) where event_id is not null;

-- Push preference for event reminders (Settings -> Notifications).
alter table public.notification_prefs add column events boolean not null default true;
grant insert (events), update (events) on public.notification_prefs to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Clock helpers (internal)

-- The status an event has right now, whatever the last tick wrote: a scheduled event whose start
-- has passed is live, a live event whose end has passed is ended.
create function public.event_effective_status(e public.scheduled_events)
returns public.event_status
language sql
stable
set search_path = ''
as $$
  select case
    when e.status in ('scheduled', 'live') and now() >= e.ends_at then 'ended'
    when e.status = 'scheduled' and now() >= e.starts_at then 'live'
    else e.status
  end::public.event_status;
$$;

revoke execute on function public.event_effective_status(public.scheduled_events) from public, anon, authenticated;

-- People in the room right now: waiting (pinged in the last 45 s, like randomizer_join pairs) plus
-- both sides of every active event session. Counts only.
create function public.event_room_count(p_event uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select (
    (select count(*) from public.random_chat_queue q
     where q.event_id = p_event and q.last_seen_at > now() - interval '45 seconds')
    + 2 * (select count(*) from public.random_chat_sessions s
           where s.event_id = p_event and s.status = 'active')
  )::int;
$$;

revoke execute on function public.event_room_count(uuid) from public, anon, authenticated;

create function public.event_refresh_stats(p_event uuid)
returns void
language sql
set search_path = ''
as $$
  update public.scheduled_events e
  set stats_joined  = (select count(*) from public.event_participants p where p.event_id = e.id),
      stats_pairs   = (select count(*) from public.random_chat_sessions s where s.event_id = e.id),
      stats_matches = (select count(*) from public.random_chat_sessions s
                       where s.event_id = e.id and s.end_reason = 'matched')
  where e.id = p_event;
$$;

revoke execute on function public.event_refresh_stats(uuid) from public, anon, authenticated;

-- Puts a participant back into the event queue (after a Pass) with the relaxed event filters.
-- Skips people who may no longer search (banned, paused, unverified) and anyone in another session.
create function public.event_requeue(p_event uuid, p_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  p      public.profiles;
  my_age int;
  wants  public.gender[];
begin
  select * into p from public.profiles where id = p_user;
  if p.id is null or p.verification_status <> 'approved' or not p.is_active then
    return;
  end if;
  if exists (select 1 from public.random_chat_sessions s
             where s.status = 'active' and p_user in (s.user_a, s.user_b)) then
    return;
  end if;
  select want_genders into wants from public.event_participants
  where event_id = p_event and user_id = p_user;
  if wants is null then
    return;
  end if;
  my_age := public.age_in_years(p.birth_date);
  insert into public.random_chat_queue (user_id, want_genders, min_age, max_age, want_tags, event_id)
  values (p_user, wants, greatest(18, my_age - 10), least(99, my_age + 10), '{}', p_event)
  on conflict (user_id) do update
    set want_genders = excluded.want_genders, min_age = excluded.min_age,
        max_age = excluded.max_age, want_tags = '{}', event_id = excluded.event_id,
        enqueued_at = now(), last_seen_at = now();
end;
$$;

revoke execute on function public.event_requeue(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Client RPCs

-- The event to show: the live one, otherwise the next scheduled one. Counts only, no identities.
-- `status` is the effective status (see event_effective_status); `server_now` lets the client
-- correct its clock for the countdown.
create function public.get_current_event()
returns table (
  id         uuid,
  title_en   text,
  title_ms   text,
  title_ru   text,
  theme      text,
  starts_at  timestamptz,
  ends_at    timestamptz,
  status     public.event_status,
  in_room    int,
  joined     int,
  reminded   boolean,
  server_now timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title_en, e.title_ms, e.title_ru, e.theme, e.starts_at, e.ends_at,
    public.event_effective_status(e),
    public.event_room_count(e.id),
    (select count(*) from public.event_participants p where p.event_id = e.id)::int,
    exists (select 1 from public.event_reminders r
            where r.event_id = e.id and r.user_id = (select auth.uid())),
    now()
  from public.scheduled_events e
  where e.status in ('scheduled', 'live') and e.ends_at > now()
  order by (public.event_effective_status(e) = 'live') desc, e.starts_at
  limit 1;
$$;

-- "Remind me" on (true) or off (false) for an upcoming event. Returns the new state.
create function public.event_remind(p_event uuid, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  e  public.scheduled_events;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if p_on is null then
    raise exception 'Value required' using errcode = 'invalid_parameter_value';
  end if;
  select * into e from public.scheduled_events where id = p_event;
  if e.id is null or e.status <> 'scheduled' or e.starts_at <= now() then
    raise exception 'Event is not upcoming' using errcode = 'no_data_found';
  end if;
  if p_on then
    insert into public.event_reminders (event_id, user_id) values (p_event, me)
    on conflict do nothing;
  else
    delete from public.event_reminders where event_id = p_event and user_id = me;
  end if;
  return p_on;
end;
$$;

revoke execute on function public.get_current_event() from public, anon;
revoke execute on function public.event_remind(uuid, boolean) from public, anon;
grant execute on function public.get_current_event() to authenticated;
grant execute on function public.event_remind(uuid, boolean) to authenticated;

-- randomizer_join with an optional event. Body copied from 20261008000018 (the newest definition);
-- the non-event path is unchanged apart from never pairing with an event queue row.
-- With p_event_id: the event must be live (a scheduled event whose start has passed is flipped to
-- live here), the pool is the event queue only, filters are the chosen genders plus the caller's
-- age +/- 10 (18 minimum), tags are ignored. Raises no_data_found when the event is not live.
drop function public.randomizer_join(public.gender[], int, int, smallint[]);

create function public.randomizer_join(
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
  where status = 'active' and me.id in (user_a, user_b);
  if v_session is not null then
    return v_session;
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
  order by q.enqueued_at
  limit 1;

  if partner is null then
    insert into public.random_chat_queue (user_id, want_genders, min_age, max_age, want_tags, event_id)
    values (me.id, p_genders, p_min_age, p_max_age, p_tags, p_event_id);
    return null;
  end if;

  delete from public.random_chat_queue where user_id = partner;
  insert into public.random_chat_sessions (user_a, user_b, event_id)
  values (partner, me.id, p_event_id)
  returning id into v_session;

  perform realtime.send(
    jsonb_build_object('session_id', v_session), 'paired', 'randomizer:' || partner::text, true);
  return v_session;
end;
$$;

revoke execute on function public.randomizer_join(public.gender[], int, int, smallint[], uuid) from public, anon;
grant execute on function public.randomizer_join(public.gender[], int, int, smallint[], uuid) to authenticated;

-- get_blind_session gains event_id (the client resumes event mode after a reload). Body copied
-- from 20261009000190; a new output column needs drop + create.
drop function public.get_blind_session(uuid);

create function public.get_blind_session(p_session uuid default null)
returns table (
  id            uuid,
  my_side       text,
  my_alias      int,
  partner_alias int,
  my_decision   boolean,
  state         text,
  common_tags   text[],
  partner       jsonb,
  match_id      uuid,
  started_at    timestamptz,
  event_id      uuid
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
      and (case when p_session is null then rs.status = 'active' else rs.id = p_session end)
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
    coalesce((
      select array_agg(t.slug order by t.slug)
      from public.profile_tags mine
      join public.profile_tags theirs on theirs.tag_id = mine.tag_id and theirs.profile_id = s.other
      join public.tags t on t.id = mine.tag_id
      where mine.profile_id = (select auth.uid())
    ), '{}'),
    case when s.end_reason = 'matched' and public.can_view_profile(s.other) then (
      select jsonb_build_object(
        'id', p.id, 'display_name', p.display_name,
        'age', public.age_in_years(p.birth_date), 'bio', p.bio, 'city', p.city,
        'relationship_goal', p.relationship_goal, 'job_title', p.job_title)
      from public.profiles p where p.id = s.other
    ) end,
    case when s.end_reason = 'matched' then s.match_id end,
    s.started_at,
    s.event_id
  from s;
$$;

revoke execute on function public.get_blind_session(uuid) from public, anon;
grant execute on function public.get_blind_session(uuid) to authenticated;

-- blind_decide: body copied from 20261009000190, plus the event re-queue after a Pass: while the
-- event is still live both people go straight back into the event queue ("Next" feel; the client
-- joins again too, which is idempotent). Everything else is unchanged.
create or replace function public.blind_decide(p_session uuid, p_connect boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  s       public.random_chat_sessions;
  side    text;
  v_match uuid;
  ev      public.scheduled_events;
begin
  if p_connect is null then
    raise exception 'Decision required' using errcode = 'invalid_parameter_value';
  end if;

  select * into s from public.random_chat_sessions
  where id = p_session and me in (user_a, user_b)
  for update;
  if s.id is null then
    raise exception 'Not a participant' using errcode = 'insufficient_privilege';
  end if;
  side := case when s.user_a = me then 'a' else 'b' end;

  if s.status <> 'active' then
    return jsonb_build_object('state', public.blind_state(s, side),
      'match_id', case when s.end_reason = 'matched' then s.match_id end);
  end if;

  if p_connect and exists (
    select 1 from public.profiles where id = me and banned_at is not null
  ) then
    raise exception 'Banned' using errcode = 'insufficient_privilege';
  end if;

  -- A block between the two (made elsewhere meanwhile) ends the session instead of matching.
  if p_connect and public.is_blocked_between(s.user_a, s.user_b) then
    update public.random_chat_sessions
    set status = 'ended', ended_at = now(), end_reason = 'block'
    where id = s.id;
    perform realtime.send('{}'::jsonb, 'ended', 'random:' || s.id::text, true);
    return jsonb_build_object('state', 'ended', 'match_id', null);
  end if;

  if not p_connect then
    update public.random_chat_sessions
    set decision_a = case when side = 'a' then false else decision_a end,
        decision_b = case when side = 'b' then false else decision_b end,
        decided_at = now(), status = 'ended', ended_at = now(), end_reason = 'pass'
    where id = s.id;
    perform realtime.send(jsonb_build_object('session_id', s.id, 'decision', false),
      'decided', 'randomizer:' || me::text, true);
    perform realtime.send('{}'::jsonb, 'ended', 'random:' || s.id::text, true);
    if s.event_id is not null then
      select * into ev from public.scheduled_events where id = s.event_id;
      if ev.id is not null and public.event_effective_status(ev) = 'live' then
        perform public.event_requeue(ev.id, s.user_a);
        perform public.event_requeue(ev.id, s.user_b);
      end if;
    end if;
    return jsonb_build_object('state', 'passed', 'match_id', null);
  end if;

  update public.random_chat_sessions
  set decision_a = case when side = 'a' then true else decision_a end,
      decision_b = case when side = 'b' then true else decision_b end,
      decided_at = now()
  where id = s.id
  returning * into s;

  if not (coalesce(s.decision_a, false) and coalesce(s.decision_b, false)) then
    perform realtime.send(jsonb_build_object('session_id', s.id, 'decision', true),
      'decided', 'randomizer:' || me::text, true);
    return jsonb_build_object('state', 'waiting', 'match_id', null);
  end if;

  -- Mutual: the pair may already be matched (swipes, an earlier blind date): reuse that match.
  v_match := public.ensure_match(s.user_a, s.user_b, 'randomizer');

  -- The blind chat continues in the match chat: same order, senders and timestamps. Both have
  -- read it already, so it does not count as unread.
  perform set_config('vibely.blind_copy', 'on', true);
  insert into public.messages (match_id, sender_id, body, created_at, read_at)
  select v_match, m.sender_id, m.body, m.created_at, now()
  from public.random_chat_messages m
  where m.session_id = s.id
  order by m.created_at, m.id;
  perform set_config('vibely.blind_copy', '', true);

  update public.random_chat_sessions
  set status = 'ended', ended_at = now(), end_reason = 'matched', match_id = v_match,
      a_revealed = true, b_revealed = true, revealed_at = now()
  where id = s.id;

  perform realtime.send(jsonb_build_object('session_id', s.id, 'decision', true),
    'decided', 'randomizer:' || me::text, true);
  perform realtime.send(jsonb_build_object('match_id', v_match), 'matched', 'random:' || s.id::text, true);
  -- just_matched: this call completed the match (the server sends the partner a push only then).
  return jsonb_build_object('state', 'matched', 'match_id', v_match, 'just_matched', true);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Scheduler (pg_cron every minute; POST /api/cron/events-push calls it too)

-- Applies the clock: scheduled -> live -> ended. An ended event closes its queue (sessions in
-- progress continue until decided), gets its stats refreshed, and, when weekly, spawns the next
-- occurrence one week later (once: the chain is followed through parent_id). Participant and
-- reminder rows are purged 90 days after the event ended (the stats columns keep the numbers).
-- Returns {"started": n, "ended": n, "created": n}.
create function public.event_tick()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e         public.scheduled_events;
  n_started int := 0;
  n_ended   int := 0;
  n_created int := 0;
begin
  -- One tick at a time (pg_cron and the push job may overlap).
  perform pg_advisory_xact_lock(hashtext('event_tick'));

  update public.scheduled_events
  set status = 'live', updated_at = now()
  where status = 'scheduled' and starts_at <= now() and ends_at > now();
  get diagnostics n_started = row_count;

  for e in
    select * from public.scheduled_events
    where status in ('scheduled', 'live') and ends_at <= now()
    order by ends_at
  loop
    update public.scheduled_events
    set status = 'ended', ended_at = now(), updated_at = now()
    where id = e.id;
    delete from public.random_chat_queue where event_id = e.id;
    perform public.event_refresh_stats(e.id);
    n_ended := n_ended + 1;

    if e.recurrence = 'weekly'
       and not exists (select 1 from public.scheduled_events n where n.parent_id = e.id) then
      insert into public.scheduled_events
        (title_en, title_ms, title_ru, theme, starts_at, ends_at, recurrence, status, parent_id, created_by)
      values
        (e.title_en, e.title_ms, e.title_ru, e.theme, e.starts_at + interval '7 days',
         e.ends_at + interval '7 days', 'weekly', 'scheduled', e.id, e.created_by);
      n_created := n_created + 1;
    end if;
  end loop;

  -- Live events and recently ended ones (matches can still be decided after the end).
  perform public.event_refresh_stats(id) from public.scheduled_events
  where status = 'live' or (status = 'ended' and ended_at > now() - interval '7 days');

  delete from public.event_participants p
  using public.scheduled_events se
  where se.id = p.event_id and se.status in ('ended', 'cancelled')
    and coalesce(se.ended_at, se.ends_at) < now() - interval '90 days';
  delete from public.event_reminders r
  using public.scheduled_events se
  where se.id = r.event_id and se.status in ('ended', 'cancelled')
    and coalesce(se.ended_at, se.ends_at) < now() - interval '90 days';

  return jsonb_build_object('started', n_started, 'ended', n_ended, 'created', n_created);
end;
$$;

-- Reminders to send now, stamped atomically so each is sent once:
--   reminder  the event starts within 15 minutes (not sent yet)
--   start     the event is live, started less than 20 minutes ago (not sent yet)
-- A user whose reminder was missed (job outage) gets only the start push.
create function public.event_push_due()
returns table (
  kind      text,
  event_id  uuid,
  user_id   uuid,
  title_en  text,
  title_ms  text,
  title_ru  text,
  theme     text,
  starts_at timestamptz
)
language sql
volatile
security definer
set search_path = ''
as $$
  with due as (
    select r.event_id, r.user_id,
      case when public.event_effective_status(e) = 'live' then 'start' else 'reminder' end as kind
    from public.event_reminders r
    join public.scheduled_events e on e.id = r.event_id
    where (public.event_effective_status(e) = 'live'
           and r.start_sent_at is null
           and e.starts_at > now() - interval '20 minutes')
       or (public.event_effective_status(e) = 'scheduled'
           and r.reminder_sent_at is null
           and e.starts_at <= now() + interval '15 minutes')
    order by e.starts_at, r.created_at
    limit 500
  ),
  stamped as (
    update public.event_reminders r
    set reminder_sent_at = case when due.kind = 'reminder' then now() else coalesce(r.reminder_sent_at, now()) end,
        start_sent_at    = case when due.kind = 'start' then now() else r.start_sent_at end
    from due
    where r.event_id = due.event_id and r.user_id = due.user_id
    returning due.kind, r.event_id, r.user_id
  )
  select s.kind, s.event_id, s.user_id, e.title_en, e.title_ms, e.title_ru, e.theme, e.starts_at
  from stamped s
  join public.scheduled_events e on e.id = s.event_id;
$$;

revoke execute on function public.event_tick() from public, anon, authenticated;
revoke execute on function public.event_push_due() from public, anon, authenticated;
grant execute on function public.event_tick() to service_role;
grant execute on function public.event_push_due() to service_role;

-- Every minute where pg_cron exists (Supabase; not the local test database).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('event-tick', '* * * * *', 'select public.event_tick()');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin RPCs (/admin/events): viewer reads, admin writes; every write is logged.

create function public.admin_list_events(p_admin uuid, p_limit int default 100)
returns table (
  id uuid, title_en text, title_ms text, title_ru text, theme text,
  starts_at timestamptz, ends_at timestamptz, recurrence text, status public.event_status,
  parent_id uuid, created_by uuid, ended_at timestamptz,
  joined int, pairs int, matches int, reminders int, in_room int, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  return query
  select e.id, e.title_en, e.title_ms, e.title_ru, e.theme, e.starts_at, e.ends_at, e.recurrence,
    public.event_effective_status(e), e.parent_id, e.created_by, e.ended_at,
    e.stats_joined, e.stats_pairs, e.stats_matches,
    (select count(*) from public.event_reminders r where r.event_id = e.id)::int,
    case when e.status = 'live' then public.event_room_count(e.id) else 0 end,
    e.created_at
  from public.scheduled_events e
  order by (e.status in ('scheduled', 'live')) desc,
    case when e.status in ('scheduled', 'live') then e.starts_at end asc,
    e.starts_at desc
  limit least(500, greatest(1, p_limit));
end;
$$;

-- Fresh numbers for one event (recomputed now, not the cached columns).
create function public.admin_event_stats(p_admin uuid, p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.scheduled_events;
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  select * into e from public.scheduled_events where id = p_event;
  if e.id is null then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;
  return jsonb_build_object(
    'joined',    (select count(*) from public.event_participants p where p.event_id = e.id),
    'pairs',     (select count(*) from public.random_chat_sessions s where s.event_id = e.id),
    'matches',   (select count(*) from public.random_chat_sessions s
                  where s.event_id = e.id and s.end_reason = 'matched'),
    'reminders', (select count(*) from public.event_reminders r where r.event_id = e.id),
    'in_room',   public.event_room_count(e.id),
    'status',    public.event_effective_status(e));
end;
$$;

-- Shared validation: at least 10 minutes, at most 12 hours (the table checks the latter too).
create function public.event_check_times(p_starts timestamptz, p_ends timestamptz)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_ends <= p_starts then
    raise exception 'The end must be after the start' using errcode = 'check_violation';
  end if;
  if p_ends - p_starts < interval '10 minutes' then
    raise exception 'An event lasts at least 10 minutes' using errcode = 'check_violation';
  end if;
  if p_ends - p_starts > interval '12 hours' then
    raise exception 'An event lasts at most 12 hours' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.event_check_times(timestamptz, timestamptz) from public, anon, authenticated;

-- Creates (p_id null) or edits an event. p_status: 'draft' or 'scheduled'. A live event keeps its
-- start and status; its titles, theme and end can still change. Ended and cancelled events are
-- read-only. Logged as event.create / event.update (reason: title and times, UTC).
create function public.admin_upsert_event(
  p_admin      uuid,
  p_id         uuid,
  p_title_en   text,
  p_title_ms   text,
  p_title_ru   text,
  p_theme      text,
  p_starts_at  timestamptz,
  p_ends_at    timestamptz,
  p_recurrence text,
  p_status     public.event_status default 'scheduled'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  old     public.scheduled_events;
  v_id    uuid;
  v_theme text := nullif(btrim(coalesce(p_theme, '')), '');
begin
  perform public.assert_admin_role(p_admin, 'admin');
  if p_status not in ('draft', 'scheduled') then
    raise exception 'Status must be draft or scheduled' using errcode = 'check_violation';
  end if;
  if p_recurrence is not null and p_recurrence <> 'weekly' then
    raise exception 'Unknown recurrence' using errcode = 'check_violation';
  end if;
  if p_starts_at is null or p_ends_at is null then
    raise exception 'Start and end required' using errcode = 'check_violation';
  end if;

  if p_id is null then
    perform public.event_check_times(p_starts_at, p_ends_at);
    if p_status = 'scheduled' and p_starts_at <= now() then
      raise exception 'The start must be in the future' using errcode = 'check_violation';
    end if;
    insert into public.scheduled_events
      (title_en, title_ms, title_ru, theme, starts_at, ends_at, recurrence, status, created_by)
    values (btrim(p_title_en), btrim(p_title_ms), btrim(p_title_ru), v_theme,
            p_starts_at, p_ends_at, p_recurrence, p_status, p_admin)
    returning id into v_id;
    perform public.log_moderation(p_admin, 'event.create', 'event', v_id,
      btrim(p_title_en) || ' ' || to_char(p_starts_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI')
      || ' - ' || to_char(p_ends_at at time zone 'Asia/Kuala_Lumpur', 'HH24:MI') || ' MYT'
      || case when p_recurrence = 'weekly' then ', weekly' else '' end
      || case when p_status = 'draft' then ', draft' else '' end);
    return v_id;
  end if;

  select * into old from public.scheduled_events where id = p_id for update;
  if old.id is null then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;
  if public.event_effective_status(old) in ('ended', 'cancelled') then
    raise exception 'This event is over' using errcode = 'check_violation';
  end if;

  if public.event_effective_status(old) = 'live' then
    -- Only what does not move the room: titles, theme, recurrence and the end (still ahead).
    perform public.event_check_times(old.starts_at, p_ends_at);
    if p_ends_at <= now() then
      raise exception 'The end must be in the future' using errcode = 'check_violation';
    end if;
    update public.scheduled_events
    set title_en = btrim(p_title_en), title_ms = btrim(p_title_ms), title_ru = btrim(p_title_ru),
        theme = v_theme, ends_at = p_ends_at, recurrence = p_recurrence, updated_at = now()
    where id = old.id;
  else
    perform public.event_check_times(p_starts_at, p_ends_at);
    if p_status = 'scheduled' and p_starts_at <= now() then
      raise exception 'The start must be in the future' using errcode = 'check_violation';
    end if;
    update public.scheduled_events
    set title_en = btrim(p_title_en), title_ms = btrim(p_title_ms), title_ru = btrim(p_title_ru),
        theme = v_theme, starts_at = p_starts_at, ends_at = p_ends_at,
        recurrence = p_recurrence, status = p_status, updated_at = now()
    where id = old.id;
    -- A moved event: reminders fire again at the new time.
    if old.starts_at <> p_starts_at then
      update public.event_reminders set reminder_sent_at = null, start_sent_at = null
      where event_id = old.id;
    end if;
  end if;

  perform public.log_moderation(p_admin, 'event.update', 'event', old.id,
    btrim(p_title_en) || ' ' || to_char(p_starts_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI')
    || ' - ' || to_char(p_ends_at at time zone 'Asia/Kuala_Lumpur', 'HH24:MI') || ' MYT'
    || case when p_recurrence = 'weekly' then ', weekly' else '' end
    || case when p_status = 'draft' then ', draft' else '' end);
  return old.id;
end;
$$;

-- Cancels a draft, scheduled or live event (a live one closes its queue; sessions in progress
-- continue). A weekly series stops here: no next occurrence is created. Logged as event.cancel.
create function public.admin_cancel_event(p_admin uuid, p_event uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.scheduled_events;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  select * into e from public.scheduled_events where id = p_event for update;
  if e.id is null then
    raise exception 'Event not found' using errcode = 'no_data_found';
  end if;
  if e.status in ('ended', 'cancelled') then
    raise exception 'This event is over' using errcode = 'check_violation';
  end if;
  update public.scheduled_events
  set status = 'cancelled', ended_at = now(), updated_at = now()
  where id = e.id;
  delete from public.random_chat_queue where event_id = e.id;
  perform public.event_refresh_stats(e.id);
  perform public.log_moderation(p_admin, 'event.cancel', 'event', e.id,
    e.title_en || case when nullif(btrim(coalesce(p_reason, '')), '') is null then '' else ': ' || btrim(p_reason) end);
end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'admin_list_events(uuid, int)',
    'admin_event_stats(uuid, uuid)',
    'admin_upsert_event(uuid, uuid, text, text, text, text, timestamptz, timestamptz, text, public.event_status)',
    'admin_cancel_event(uuid, uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
