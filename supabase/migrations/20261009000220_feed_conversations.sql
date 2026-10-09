-- Feed conversations: "Reply privately" on feed posts and the daily question (icebreaker).
--
-- Both reuse the Blind Dating engine (random_chat_sessions / random_chat_messages, 20261009000190):
--   kind 'post'   : replier <-> post author. Anonymous on both sides: the author keeps the post's
--                   pseudonym (or, for an "As me" post, the name the post already shows), the
--                   replier is "Partner #NNN". The post is pinned as context. Connect is renamed
--                   "Reveal identity" and unlocks only after 5 messages from each side
--                   (reveal_unlock_messages); mutual reveal = match + transcript copy as before.
--   kind 'prompt' : two people who chose the same answer to the question of the day. They already
--                   saw each other's name and photo on the feed card, so revealed_from_start = true
--                   and Connect = match as usual.
-- Blind dates stay kind 'blind'. Every conversation is stored with the same 90-day retention.
--
-- Applied after 20261009000210 (Blind Dating Nights). get_blind_session, blind_decide,
-- randomizer_join and event_requeue are redefined here from their 20261009000210 bodies, so the
-- event behaviour (event_id, event pools, re-queue after a Pass) is kept; post / prompt
-- conversations never carry an event_id and are never queued or re-queued.
--
-- Also: daily_prompts (queue rotated by pg_cron at 19:00 Asia/Kuala_Lumpur), prompt_answers,
-- notification preferences post_replies / daily_prompt, and the Russian admin RPCs for /admin/prompts.

-- ---------------------------------------------------------------------------------------------
-- Daily prompts
-- ---------------------------------------------------------------------------------------------

create table public.daily_prompts (
  id           uuid primary key default gen_random_uuid(),
  -- Queue position (lowest unused goes next). Unique so reordering is a plain swap.
  sort_order   int not null unique,
  question_en  text not null check (char_length(btrim(question_en)) between 3 and 200),
  question_ms  text not null check (char_length(btrim(question_ms)) between 3 and 200),
  question_ru  text not null check (char_length(btrim(question_ru)) between 3 and 200),
  options_en   text[] not null check (cardinality(options_en) between 2 and 4),
  options_ms   text[] not null check (cardinality(options_ms) = cardinality(options_en)),
  options_ru   text[] not null check (cardinality(options_ru) = cardinality(options_en)),
  -- The "prompt day" (starts at 19:00 MYT) this question was shown; null = still queued.
  show_date    date unique,
  activated_at timestamptz,
  -- Set once by the push job (daily_prompt_push_recipients) so a retried job never sends twice.
  pushed_at    timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index daily_prompts_queue_idx on public.daily_prompts (sort_order) where show_date is null;

create trigger daily_prompts_set_updated_at
  before update on public.daily_prompts
  for each row execute function public.set_updated_at();

create table public.prompt_answers (
  prompt_id  uuid not null references public.daily_prompts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  option_idx smallint not null check (option_idx between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (prompt_id, user_id)
);

create index prompt_answers_option_idx on public.prompt_answers (prompt_id, option_idx);
create index prompt_answers_created_idx on public.prompt_answers (created_at);

alter table public.daily_prompts enable row level security;
alter table public.prompt_answers enable row level security;
-- Closed to clients: reads and writes go through the RPCs below (service role for the admin panel).
revoke all on public.daily_prompts, public.prompt_answers from anon, authenticated;

-- The date of the 19:00 MYT boundary that started the window containing p_at: 18:59 MYT still
-- belongs to yesterday's question, 19:00 MYT starts today's.
create function public.prompt_day(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select ((p_at at time zone 'Asia/Kuala_Lumpur') - interval '19 hours')::date;
$$;

-- When the window of prompt day d ends (19:00 MYT of the next day).
create function public.prompt_window_end(d date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((d + 1)::timestamp + interval '19 hours') at time zone 'Asia/Kuala_Lumpur';
$$;

revoke execute on function public.prompt_day(timestamptz) from public, anon;
revoke execute on function public.prompt_window_end(date) from public, anon;
grant execute on function public.prompt_day(timestamptz) to authenticated, service_role;
grant execute on function public.prompt_window_end(date) to authenticated, service_role;

-- Activates the next queued question for the prompt day of p_at (idempotent: a day has one
-- question; running twice, or from both pg_cron and the push job, changes nothing). Also drops
-- answers older than 90 days (retention). Returns the active question's id, null when the queue
-- is empty.
create function public.rotate_daily_prompt(p_at timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d  date := public.prompt_day(p_at);
  v  uuid;
begin
  perform pg_advisory_xact_lock(hashtext('rotate_daily_prompt'));
  select id into v from public.daily_prompts where show_date = d;
  if v is null then
    select id into v from public.daily_prompts
    where show_date is null
    order by sort_order
    limit 1;
    if v is not null then
      update public.daily_prompts set show_date = d, activated_at = p_at where id = v;
    end if;
  end if;
  delete from public.prompt_answers where created_at < p_at - interval '90 days';
  return v;
end;
$$;

revoke execute on function public.rotate_daily_prompt(timestamptz) from public, anon, authenticated;
grant execute on function public.rotate_daily_prompt(timestamptz) to service_role;

-- The question of the day for the feed card: texts in all three languages, the caller's answer,
-- and (only once the caller answered) how many people chose each option. Null when there is no
-- active question or the caller is not verified.
create function public.get_daily_prompt()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'question', jsonb_build_object('en', p.question_en, 'ms', p.question_ms, 'ru', p.question_ru),
    'options', jsonb_build_object(
      'en', to_jsonb(p.options_en), 'ms', to_jsonb(p.options_ms), 'ru', to_jsonb(p.options_ru)),
    'my_option', a.option_idx,
    'counts', case when a.option_idx is not null then (
      select jsonb_agg(c.n order by c.i)
      from (
        select i, (select count(*) from public.prompt_answers x
                   where x.prompt_id = p.id and x.option_idx = i) as n
        from generate_series(0, cardinality(p.options_en) - 1) i
      ) c
    ) end,
    'ends_at', public.prompt_window_end(p.show_date)
  )
  from public.daily_prompts p
  left join public.prompt_answers a on a.prompt_id = p.id and a.user_id = (select auth.uid())
  where p.show_date = public.prompt_day(now()) and public.is_verified();
$$;

-- Records (or changes) the caller's answer to today's question.
create function public.answer_daily_prompt(p_prompt uuid, p_option int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n  int;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  select cardinality(options_en) into n from public.daily_prompts
  where id = p_prompt and show_date = public.prompt_day(now());
  if n is null then
    raise exception 'No such question today' using errcode = 'no_data_found';
  end if;
  if p_option is null or p_option < 0 or p_option >= n then
    raise exception 'Option out of range' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.prompt_answers (prompt_id, user_id, option_idx)
  values (p_prompt, me, p_option)
  on conflict (prompt_id, user_id) do update set option_idx = excluded.option_idx;
  return public.get_daily_prompt();
end;
$$;

-- Internal: people who chose the same option as p_me on p_prompt and whom p_me could meet in
-- Discover: verified, active in the last 30 days, discoverable, not shadow-banned, interested in
-- each other, inside each other's saved age range and distance (new_people_alerts filters when
-- saved, otherwise 18-99 and 50 km), not blocked either way and not already a match.
create function public.prompt_match_pool(p_me uuid, p_prompt uuid)
returns table (id uuid, distance_m double precision)
language sql
stable
set search_path = ''
as $$
  select p.id,
    case when me.location is not null and p.location is not null
         then extensions.st_distance(me.location, p.location) end
  from public.prompt_answers mine
  join public.profiles me on me.id = mine.user_id
  join public.prompt_answers a on a.prompt_id = mine.prompt_id and a.option_idx = mine.option_idx
  join public.profiles p on p.id = a.user_id and p.id <> me.id
  left join public.new_people_alerts mf on mf.user_id = me.id
  left join public.new_people_alerts pf on pf.user_id = p.id
  where mine.prompt_id = p_prompt and mine.user_id = p_me
    and p.verification_status = 'approved'
    and p.is_active
    and p.discoverable
    and not p.shadow_banned
    and p.last_active_at > now() - interval '30 days'
    and p.gender = any (me.interested_in)
    and me.gender = any (p.interested_in)
    and public.age_in_years(p.birth_date) between coalesce(mf.min_age, 18) and coalesce(mf.max_age, 99)
    and public.age_in_years(me.birth_date) between coalesce(pf.min_age, 18) and coalesce(pf.max_age, 99)
    and (me.location is null or p.location is null
         or extensions.st_dwithin(me.location, p.location,
              least(coalesce(mf.max_km, 50), coalesce(pf.max_km, 50)) * 1000))
    and not public.is_blocked_between(me.id, p.id)
    and not exists (
      select 1 from public.matches m
      where m.user_a = least(me.id, p.id) and m.user_b = greatest(me.id, p.id)
    );
$$;

revoke execute on function public.prompt_match_pool(uuid, uuid) from public, anon, authenticated;

-- Up to 8 compatible people who chose the same answer: name, age and main photo (the viewer may
-- see these profiles, so the paths are signed with the viewer's own client). Nearest first.
create function public.get_prompt_matches(p_prompt uuid, p_limit int default 8)
returns table (id uuid, display_name text, age int, photo jsonb)
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
  select p.id, p.display_name, public.age_in_years(p.birth_date),
    (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
     from public.profile_photos ph where ph.profile_id = p.id order by ph.position limit 1)
  from public.prompt_match_pool(me, p_prompt) c
  join public.profiles p on p.id = c.id
  where exists (select 1 from public.daily_prompts d
                where d.id = p_prompt and d.show_date = public.prompt_day(now()))
  order by c.distance_m nulls last, p.last_active_at desc
  limit least(8, greatest(1, coalesce(p_limit, 8)));
end;
$$;

revoke execute on function public.get_daily_prompt() from public, anon;
revoke execute on function public.answer_daily_prompt(uuid, int) from public, anon;
revoke execute on function public.get_prompt_matches(uuid, int) from public, anon;
grant execute on function public.get_daily_prompt() to authenticated;
grant execute on function public.answer_daily_prompt(uuid, int) to authenticated;
grant execute on function public.get_prompt_matches(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Session kinds and context
-- ---------------------------------------------------------------------------------------------

alter table public.random_chat_sessions
  add column kind text not null default 'blind' check (kind in ('blind', 'post', 'prompt')),
  -- set null, not cascade: deleting a post must not delete a stored conversation (CLAUDE.md).
  add column post_id uuid references public.posts (id) on delete set null,
  add column prompt_id uuid references public.daily_prompts (id) on delete set null,
  -- Who started a post / prompt conversation (daily limits). Null for blind dates.
  add column started_by uuid references public.profiles (id) on delete set null,
  -- Names and photos shown from the first message (prompt conversations).
  add column revealed_from_start boolean not null default false,
  -- Throttles "new message" pushes for post / prompt conversations (one per 10 minutes).
  add column last_push_at timestamptz,
  add constraint random_sessions_kind_context check (
    (kind = 'blind' and post_id is null and prompt_id is null and started_by is null)
    or (kind = 'post' and prompt_id is null and started_by is not null)
    or (kind = 'prompt' and post_id is null and started_by is not null and prompt_id is not null)),
  -- Blind Dating Nights (20261009000210) pair blind dates only.
  add constraint random_sessions_event_blind check (event_id is null or kind = 'blind');

-- One conversation per post and pair, one per question and pair (reused, whatever its state).
create unique index random_sessions_post_pair_idx
  on public.random_chat_sessions (post_id, least(user_a, user_b), greatest(user_a, user_b))
  where kind = 'post';
create unique index random_sessions_prompt_pair_idx
  on public.random_chat_sessions (prompt_id, least(user_a, user_b), greatest(user_a, user_b))
  where kind = 'prompt';
create index random_sessions_started_by_idx
  on public.random_chat_sessions (started_by, started_at desc) where started_by is not null;
create index random_sessions_kind_active_idx
  on public.random_chat_sessions (kind) where status = 'active';

-- Messages each side must send before "Reveal identity" unlocks in a post conversation.
create function public.reveal_unlock_messages()
returns int
language sql
immutable
set search_path = ''
as $$ select 5 $$;

revoke execute on function public.reveal_unlock_messages() from public, anon;
grant execute on function public.reveal_unlock_messages() to authenticated;

-- What a participant may see about the context of a post / prompt conversation. For a post, the
-- replier sees the post (live: null once deleted or hidden) and the author as the post shows them:
-- the thread pseudonym, or the real card for an "As me" post the viewer may see. The author sees
-- only that they are the author; nothing about the replier is ever included here.
create function public.session_context(s public.random_chat_sessions, viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case s.kind
    when 'post' then (
      select jsonb_build_object(
        'post_id', s.post_id,
        'body', case when p.id is not null and not p.is_hidden then p.body end,
        'i_am_author', s.user_a = viewer,
        'author', case
          when s.user_a <> viewer and p.id is not null and p.is_named
               and public.can_view_profile(p.author_id)
          then jsonb_build_object(
            'id', pr.id, 'display_name', pr.display_name, 'username', pr.username,
            'age', public.age_in_years(pr.birth_date),
            'verified', pr.verification_status = 'approved',
            'photo', (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
                      from public.profile_photos ph where ph.profile_id = pr.id
                      order by ph.position limit 1))
          end,
        'author_pseudonym', case
          when s.user_a <> viewer and s.post_id is not null
               and not (p.id is not null and p.is_named and public.can_view_profile(p.author_id))
          then to_jsonb(public.feed_pseudonym(s.post_id, 0))
          end)
      from (select 1) x
      left join public.posts p on p.id = s.post_id
      left join public.profiles pr on pr.id = p.author_id)
    when 'prompt' then (
      select jsonb_build_object(
        'prompt_id', d.id,
        'question', jsonb_build_object('en', d.question_en, 'ms', d.question_ms, 'ru', d.question_ru),
        'options', jsonb_build_object(
          'en', to_jsonb(d.options_en), 'ms', to_jsonb(d.options_ms), 'ru', to_jsonb(d.options_ru)),
        'my_option', (select option_idx from public.prompt_answers
                      where prompt_id = d.id and user_id = viewer),
        'partner_option', (select option_idx from public.prompt_answers
                           where prompt_id = d.id
                             and user_id = case when s.user_a = viewer then s.user_b else s.user_a end))
      from public.daily_prompts d where d.id = s.prompt_id)
  end;
$$;

revoke execute on function public.session_context(public.random_chat_sessions, uuid) from public, anon, authenticated;

-- get_blind_session: the 20261009000210 definition (with event_id) plus kind, context, message
-- counts (the reveal unlock) and revealed_from_start. The return type grows, so drop and recreate.
-- Without an id it returns only the newest active BLIND date (post / prompt conversations have
-- their own list and pages, and must not hijack the Blind Dating screen). The partner profile is
-- included after a match, or from the start for prompt conversations; never otherwise.
drop function public.get_blind_session(uuid);

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
  event_id            uuid,
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
    s.event_id,
    s.kind,
    public.session_context(s.sess, (select auth.uid())),
    (select count(*) from public.random_chat_messages m
     where m.session_id = s.id and m.sender_id = (select auth.uid()))::int,
    (select count(*) from public.random_chat_messages m
     where m.session_id = s.id and m.sender_id <> (select auth.uid()))::int,
    s.revealed_from_start
  from s;
$$;

revoke execute on function public.get_blind_session(uuid) from public, anon;
grant execute on function public.get_blind_session(uuid) to authenticated;

-- blind_decide: the 20261009000210 definition (event re-queue after a Pass during a live night)
-- plus the reveal unlock for post conversations (Connect = "Reveal identity" needs
-- reveal_unlock_messages() from each side; SQLSTATE P0423 before that). Prompt conversations
-- decide like blind dates. Only blind dates are re-queued.
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
  mine    int;
  theirs  int;
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

  if p_connect and s.kind = 'post' then
    select count(*) filter (where sender_id = me), count(*) filter (where sender_id <> me)
    into mine, theirs
    from public.random_chat_messages where session_id = s.id;
    if mine < public.reveal_unlock_messages() or theirs < public.reveal_unlock_messages() then
      raise exception 'Reveal locked: % messages from each side first', public.reveal_unlock_messages()
        using errcode = 'P0423';
    end if;
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
    -- Only blind dates belong to a night (random_sessions_event_blind); post / prompt
    -- conversations are never re-queued.
    if s.event_id is not null and s.kind = 'blind' then
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
-- Reply privately
-- ---------------------------------------------------------------------------------------------

-- Starts (or continues) the caller's private conversation on a post with its author, sending
-- p_body as the first message. Not allowed: own post, hidden or missing post, an author the
-- caller may not see (banned, paused, blocked either way, shadow-banned), more than 10 new
-- conversations in 24 hours (P0429), muted (VS001 from the message trigger). An existing
-- conversation on the same post with the same author is reused whatever its state: when it is
-- still active the message goes there; when it ended nothing is sent and its state is returned.
-- The author learns nothing about the replier: user_a is always the author, user_b the replier.
-- Returns {"session_id", "message_id" | null, "created": bool, "state"}.
create function public.start_post_conversation(p_post uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        uuid := (select auth.uid());
  post      public.posts;
  s         public.random_chat_sessions;
  v_msg     uuid;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(coalesce(p_body, '')), '') is null then
    raise exception 'Message required' using errcode = 'invalid_parameter_value';
  end if;

  select * into post from public.posts where id = p_post and not is_hidden;
  if post.id is null then
    raise exception 'Post not found' using errcode = 'no_data_found';
  end if;
  if post.author_id = me then
    raise exception 'Cannot reply to your own post' using errcode = 'insufficient_privilege';
  end if;
  -- Same visibility as the feed: an author who is paused, banned, blocked or shadow-banned
  -- cannot be reached (and the post is not shown anyway).
  if not public.can_view_profile(post.author_id) or exists (
    select 1 from public.profiles where id = post.author_id and shadow_banned
  ) then
    raise exception 'Post not found' using errcode = 'no_data_found';
  end if;

  select * into s from public.random_chat_sessions
  where kind = 'post' and post_id = p_post and user_a = post.author_id and user_b = me
  for update;

  if s.id is null then
    if (select count(*) from public.random_chat_sessions
        where started_by = me and kind = 'post' and started_at > now() - interval '24 hours') >= 10 then
      raise exception 'Too many private replies today' using errcode = 'P0429';
    end if;
    insert into public.random_chat_sessions (user_a, user_b, kind, post_id, started_by)
    values (post.author_id, me, 'post', p_post, me)
    returning * into s;
    v_msg := public.randomizer_send(s.id, p_body);
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

-- "Say hi" from the daily question card: a conversation with someone who chose the same answer
-- (p_target must be in prompt_match_pool for the caller, i.e. visible on the card). Names and
-- photos were already on the card, so revealed_from_start = true. One per question and pair
-- (reused); at most 10 new ones in 24 hours (P0429). The caller is user_b, the target user_a.
-- Returns {"session_id", "created": bool, "state"}.
create function public.start_prompt_conversation(p_prompt uuid, p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s  public.random_chat_sessions;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if p_target is null or p_target = me then
    raise exception 'Invalid target' using errcode = 'invalid_parameter_value';
  end if;

  select * into s from public.random_chat_sessions
  where kind = 'prompt' and prompt_id = p_prompt
    and least(user_a, user_b) = least(me, p_target) and greatest(user_a, user_b) = greatest(me, p_target)
  for update;
  if s.id is not null then
    return jsonb_build_object('session_id', s.id, 'created', false,
      'state', public.blind_state(s, case when s.user_a = me then 'a' else 'b' end));
  end if;

  if not exists (select 1 from public.daily_prompts
                 where id = p_prompt and show_date = public.prompt_day(now())) then
    raise exception 'No such question today' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.prompt_match_pool(me, p_prompt) c where c.id = p_target) then
    raise exception 'Not available' using errcode = 'no_data_found';
  end if;
  if (select count(*) from public.random_chat_sessions
      where started_by = me and kind = 'prompt' and started_at > now() - interval '24 hours') >= 10 then
    raise exception 'Too many conversations today' using errcode = 'P0429';
  end if;

  insert into public.random_chat_sessions (user_a, user_b, kind, prompt_id, started_by, revealed_from_start)
  values (p_target, me, 'prompt', p_prompt, me, true)
  returning * into s;
  perform realtime.send(jsonb_build_object('session_id', s.id), 'conversation', 'randomizer:' || p_target::text, true);
  return jsonb_build_object('session_id', s.id, 'created', true, 'state', 'active');
end;
$$;

-- The caller's open post / prompt conversations for the Chats screen ("Private replies"):
-- context as in get_blind_session, the partner only when revealed_from_start, the latest message.
create function public.list_my_conversations()
returns table (
  id                  uuid,
  kind                text,
  my_side             text,
  partner_alias       int,
  context             jsonb,
  partner             jsonb,
  revealed_from_start boolean,
  last_body           text,
  last_at             timestamptz,
  last_mine           boolean,
  started_at          timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rs.id,
    rs.kind,
    case when rs.user_a = (select auth.uid()) then 'a' else 'b' end,
    (case when rs.user_a = (select auth.uid()) then rs.alias_b else rs.alias_a end)::int,
    public.session_context(rs, (select auth.uid())),
    case when rs.revealed_from_start and public.can_view_profile(o.id) then
      jsonb_build_object('id', o.id, 'display_name', o.display_name,
        'age', public.age_in_years(o.birth_date),
        'photo', (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
                  from public.profile_photos ph where ph.profile_id = o.id order by ph.position limit 1))
    end,
    rs.revealed_from_start,
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
  where rs.kind in ('post', 'prompt')
    and rs.status = 'active'
    and (select auth.uid()) in (rs.user_a, rs.user_b)
  order by coalesce(lm.created_at, rs.started_at) desc
  limit 100;
$$;

revoke execute on function public.start_post_conversation(uuid, text) from public, anon;
revoke execute on function public.start_prompt_conversation(uuid, uuid) from public, anon;
revoke execute on function public.list_my_conversations() from public, anon;
grant execute on function public.start_post_conversation(uuid, text) to authenticated;
grant execute on function public.start_prompt_conversation(uuid, uuid) to authenticated;
grant execute on function public.list_my_conversations() to authenticated;

-- randomizer_join: the 20261009000210 definition (optional event pool, relaxed event filters),
-- with one change: the "already in a session" check only looks at blind dates, otherwise anyone
-- with an open private reply / prompt conversation could never start a blind date. Sessions it
-- creates are always kind 'blind'. Same signature, so grants are kept.
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
  insert into public.random_chat_sessions (user_a, user_b, kind, event_id)
  values (partner, me.id, 'blind', p_event_id)
  returning id into v_session;

  perform realtime.send(
    jsonb_build_object('session_id', v_session), 'paired', 'randomizer:' || partner::text, true);
  return v_session;
end;
$$;

-- event_requeue: the 20261009000210 definition; the "in another session" check likewise only
-- looks at blind dates, so an open private reply does not stop the re-queue after a Pass.
create or replace function public.event_requeue(p_event uuid, p_user uuid)
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
             where s.status = 'active' and s.kind = 'blind' and p_user in (s.user_a, s.user_b)) then
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

-- ---------------------------------------------------------------------------------------------
-- Pushes
-- ---------------------------------------------------------------------------------------------

alter table public.notification_prefs
  add column post_replies boolean not null default true,
  add column daily_prompt boolean not null default true;
grant insert (post_replies, daily_prompt), update (post_replies, daily_prompt)
  on public.notification_prefs to authenticated;

-- Server only (after a message in a post / prompt conversation): who to notify, or null when
-- nobody should be (blind dates, ended sessions, blocked pairs, inactive recipients, or a push
-- for this session went out in the last 10 minutes). Claims the slot atomically. The sender's
-- name is included only for conversations that show names (revealed_from_start).
create function public.claim_session_push(p_message uuid)
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
  if s.kind = 'blind' or s.status <> 'active' then
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
    'kind', s.kind,
    'session_id', s.id,
    'sender_name', case when s.revealed_from_start
      then (select display_name from public.profiles where id = m.sender_id) end,
    'is_first', (select count(*) from public.random_chat_messages where session_id = s.id) = 1);
end;
$$;

-- Server only (the 19:00 MYT push job): everyone with a push subscription who may get today's
-- question (verified, active, daily_prompt preference on). Claims the prompt's pushed_at, so a
-- retried job gets an empty list. Returns nothing when p_prompt is not today's question.
create function public.daily_prompt_push_recipients(p_prompt uuid)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.daily_prompts set pushed_at = now()
  where id = p_prompt and pushed_at is null and show_date = public.prompt_day(now());
  if not found then
    return;
  end if;
  return query
  select distinct ps.user_id
  from public.push_subscriptions ps
  join public.profiles p on p.id = ps.user_id
  left join public.notification_prefs np on np.user_id = ps.user_id
  where p.verification_status = 'approved' and p.is_active and coalesce(np.daily_prompt, true);
end;
$$;

revoke execute on function public.claim_session_push(uuid) from public, anon, authenticated;
revoke execute on function public.daily_prompt_push_recipients(uuid) from public, anon, authenticated;
grant execute on function public.claim_session_push(uuid) to service_role;
grant execute on function public.daily_prompt_push_recipients(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Admin (/admin/prompts): queue, add / edit, reorder, delete (unused only). Moderator and up.
-- ---------------------------------------------------------------------------------------------

-- p_question: {"en","ms","ru"}; p_options: {"en": [...], "ms": [...], "ru": [...]} (2-4 each, same
-- count). With p_id, edits that question (texts only; a question already shown keeps its date).
create function public.admin_upsert_daily_prompt(
  p_admin    uuid,
  p_question jsonb,
  p_options  jsonb,
  p_id       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q_en text := btrim(p_question ->> 'en');
  q_ms text := btrim(p_question ->> 'ms');
  q_ru text := btrim(p_question ->> 'ru');
  o_en text[];
  o_ms text[];
  o_ru text[];
  v    uuid;
  o    text;
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  select array_agg(btrim(x)) into o_en from jsonb_array_elements_text(p_options -> 'en') x;
  select array_agg(btrim(x)) into o_ms from jsonb_array_elements_text(p_options -> 'ms') x;
  select array_agg(btrim(x)) into o_ru from jsonb_array_elements_text(p_options -> 'ru') x;
  if coalesce(cardinality(o_en), 0) not between 2 and 4
     or cardinality(o_ms) is distinct from cardinality(o_en)
     or cardinality(o_ru) is distinct from cardinality(o_en) then
    raise exception 'Нужно от 2 до 4 вариантов, одинаково на всех языках' using errcode = 'invalid_parameter_value';
  end if;
  foreach o in array o_en || o_ms || o_ru loop
    if o is null or char_length(o) not between 1 and 60 then
      raise exception 'Вариант ответа: от 1 до 60 символов' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if q_en is null or q_ms is null or q_ru is null
     or char_length(q_en) not between 3 and 200 or char_length(q_ms) not between 3 and 200
     or char_length(q_ru) not between 3 and 200 then
    raise exception 'Вопрос: от 3 до 200 символов на каждом языке' using errcode = 'invalid_parameter_value';
  end if;

  if p_id is null then
    insert into public.daily_prompts (sort_order, question_en, question_ms, question_ru,
      options_en, options_ms, options_ru, created_by)
    values ((select coalesce(max(sort_order), 0) + 1 from public.daily_prompts),
      q_en, q_ms, q_ru, o_en, o_ms, o_ru, p_admin)
    returning id into v;
    perform public.log_moderation(p_admin, 'prompt.add', 'daily_prompt', v, left(q_ru, 200));
  else
    update public.daily_prompts
    set question_en = q_en, question_ms = q_ms, question_ru = q_ru,
        options_en = o_en, options_ms = o_ms, options_ru = o_ru
    where id = p_id
    returning id into v;
    if v is null then
      raise exception 'Вопрос не найден' using errcode = 'no_data_found';
    end if;
    perform public.log_moderation(p_admin, 'prompt.edit', 'daily_prompt', v, left(q_ru, 200));
  end if;
  return v;
end;
$$;

-- Only questions that were never shown can be deleted (answers of shown ones are kept).
create function public.admin_delete_daily_prompt(p_admin uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  delete from public.daily_prompts where id = p_id and show_date is null;
  if not found then
    raise exception 'Вопрос не найден или уже показан' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, 'prompt.delete', 'daily_prompt', p_id, null);
end;
$$;

-- Moves a queued question one step up (earlier) or down in the queue.
create function public.admin_move_daily_prompt(p_admin uuid, p_id uuid, p_up boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur   int;
  other public.daily_prompts;
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  select sort_order into cur from public.daily_prompts where id = p_id and show_date is null;
  if cur is null then
    raise exception 'Вопрос не найден или уже показан' using errcode = 'no_data_found';
  end if;
  if p_up then
    select * into other from public.daily_prompts
    where show_date is null and sort_order < cur order by sort_order desc limit 1;
  else
    select * into other from public.daily_prompts
    where show_date is null and sort_order > cur order by sort_order limit 1;
  end if;
  if other.id is null then
    return;
  end if;
  -- Swap through a free slot (sort_order is unique).
  update public.daily_prompts set sort_order = -1 where id = p_id;
  update public.daily_prompts set sort_order = cur where id = other.id;
  update public.daily_prompts set sort_order = other.sort_order where id = p_id;
  perform public.log_moderation(p_admin, 'prompt.move', 'daily_prompt', p_id, null);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_upsert_daily_prompt(uuid, jsonb, jsonb, uuid)',
    'admin_delete_daily_prompt(uuid, uuid)',
    'admin_move_daily_prompt(uuid, uuid, boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Scheduling: rotate at 19:00 Asia/Kuala_Lumpur (11:00 UTC). The push follows from the app
-- (.github/workflows/daily-prompt.yml -> POST /api/cron/daily-prompt), which also rotates, so a
-- missed pg_cron run is harmless.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'rotate-daily-prompt',
      '0 11 * * *',
      'select public.rotate_daily_prompt()'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Seed: 60 Malaysia-flavoured questions (en / ms / ru), in queue order.
-- ---------------------------------------------------------------------------------------------
insert into public.daily_prompts (sort_order, question_en, question_ms, question_ru, options_en, options_ms, options_ru) values
(1, 'Mamak or cafe for a first date?', 'Mamak atau kafe untuk temu janji pertama?', 'Мамак или кафе для первого свидания?',
  array['Mamak', 'Cafe'], array['Mamak', 'Kafe'], array['Мамак', 'Кафе']),
(2, 'Nasi lemak: breakfast or dinner?', 'Nasi lemak: sarapan atau makan malam?', 'Наси лемак: на завтрак или на ужин?',
  array['Breakfast', 'Dinner', 'Any time'], array['Sarapan', 'Makan malam', 'Bila-bila masa'], array['На завтрак', 'На ужин', 'В любое время']),
(3, 'KL or Penang for a weekend?', 'KL atau Pulau Pinang untuk hujung minggu?', 'КЛ или Пенанг на выходные?',
  array['KL', 'Penang'], array['KL', 'Pulau Pinang'], array['КЛ', 'Пенанг']),
(4, 'Ramadan bazaar or night market?', 'Bazar Ramadan atau pasar malam?', 'Базар Рамадана или ночной рынок?',
  array['Ramadan bazaar', 'Night market'], array['Bazar Ramadan', 'Pasar malam'], array['Базар Рамадана', 'Ночной рынок']),
(5, 'Teh tarik or kopi?', 'Teh tarik atau kopi?', 'Те тарик или кофе?',
  array['Teh tarik', 'Kopi', 'Just water'], array['Teh tarik', 'Kopi', 'Air kosong saja'], array['Те тарик', 'Кофе', 'Просто вода']),
(6, 'Beach or highlands?', 'Pantai atau tanah tinggi?', 'Пляж или горы?',
  array['Beach', 'Highlands'], array['Pantai', 'Tanah tinggi'], array['Пляж', 'Горы']),
(7, 'Grab, drive yourself or LRT?', 'Grab, pandu sendiri atau LRT?', 'Grab, своя машина или LRT?',
  array['Grab', 'Drive myself', 'LRT or MRT'], array['Grab', 'Pandu sendiri', 'LRT atau MRT'], array['Grab', 'Своя машина', 'LRT или MRT']),
(8, 'Durian: yes or no?', 'Durian: ya atau tidak?', 'Дуриан: да или нет?',
  array['Yes, love it', 'No way', 'Only a little'], array['Ya, sangat suka', 'Tidak sama sekali', 'Sikit saja'], array['Да, обожаю', 'Ни за что', 'Совсем чуть-чуть']),
(9, 'Roti canai: plain, with egg or roti tisu?', 'Roti canai: kosong, telur atau roti tisu?', 'Роти чанай: простой, с яйцом или роти тису?',
  array['Plain', 'With egg', 'Roti tisu'], array['Kosong', 'Telur', 'Roti tisu'], array['Простой', 'С яйцом', 'Роти тису']),
(10, 'Satay: chicken or beef?', 'Sate: ayam atau daging?', 'Сатэй: курица или говядина?',
  array['Chicken', 'Beef', 'Both'], array['Ayam', 'Daging', 'Kedua-duanya'], array['Курица', 'Говядина', 'И то и другое']),
(11, 'Char kuey teow or nasi goreng?', 'Char kuey teow atau nasi goreng?', 'Чар куэй тиау или наси горенг?',
  array['Char kuey teow', 'Nasi goreng'], array['Char kuey teow', 'Nasi goreng'], array['Чар куэй тиау', 'Наси горенг']),
(12, 'Shopping: Pavilion, Mid Valley or online?', 'Membeli-belah: Pavilion, Mid Valley atau online?', 'Шопинг: Pavilion, Mid Valley или онлайн?',
  array['Pavilion', 'Mid Valley', 'Online'], array['Pavilion', 'Mid Valley', 'Online'], array['Pavilion', 'Mid Valley', 'Онлайн']),
(13, 'Raining outside: stay in or go out anyway?', 'Hujan di luar: duduk rumah atau keluar juga?', 'Дождь за окном: остаться дома или всё равно пойти?',
  array['Stay in', 'Go out anyway'], array['Duduk rumah', 'Keluar juga'], array['Остаться дома', 'Всё равно пойти']),
(14, 'Langkawi, Redang or Perhentian?', 'Langkawi, Redang atau Perhentian?', 'Лангкави, Реданг или Перхентиан?',
  array['Langkawi', 'Redang', 'Perhentian'], array['Langkawi', 'Redang', 'Perhentian'], array['Лангкави', 'Реданг', 'Перхентиан']),
(15, 'Cendol or ais kacang?', 'Cendol atau ais kacang?', 'Чендол или айс качанг?',
  array['Cendol', 'Ais kacang'], array['Cendol', 'Ais kacang'], array['Чендол', 'Айс качанг']),
(16, 'Morning person or night owl?', 'Orang pagi atau burung hantu malam?', 'Жаворонок или сова?',
  array['Morning person', 'Night owl'], array['Orang pagi', 'Burung hantu malam'], array['Жаворонок', 'Сова']),
(17, 'Badminton or futsal?', 'Badminton atau futsal?', 'Бадминтон или футзал?',
  array['Badminton', 'Futsal', 'Just watching'], array['Badminton', 'Futsal', 'Tengok saja'], array['Бадминтон', 'Футзал', 'Только смотреть']),
(18, 'Milo ais or Milo panas?', 'Milo ais atau Milo panas?', 'Майло со льдом или горячий?',
  array['Milo ais', 'Milo panas'], array['Milo ais', 'Milo panas'], array['Со льдом', 'Горячий']),
(19, 'Hari Raya: balik kampung or stay in the city?', 'Hari Raya: balik kampung atau duduk bandar?', 'Хари Райя: в деревню к родным или остаться в городе?',
  array['Balik kampung', 'Stay in the city'], array['Balik kampung', 'Duduk bandar'], array['В деревню', 'Остаться в городе']),
(20, 'Hiking Bukit Gasing or a mall walk?', 'Mendaki Bukit Gasing atau jalan-jalan di mall?', 'Поход на Букит Гасинг или прогулка по молу?',
  array['Hiking', 'Mall walk'], array['Mendaki', 'Jalan di mall'], array['Поход', 'Прогулка по молу']),
(21, 'Genting or Cameron Highlands?', 'Genting atau Cameron Highlands?', 'Гентинг или Кэмерон Хайлендс?',
  array['Genting', 'Cameron Highlands'], array['Genting', 'Cameron Highlands'], array['Гентинг', 'Кэмерон Хайлендс']),
(22, 'Fried chicken: ayam goreng berempah or KFC?', 'Ayam goreng: berempah atau KFC?', 'Жареная курица: аям горенг берэмпах или KFC?',
  array['Ayam goreng berempah', 'KFC'], array['Ayam goreng berempah', 'KFC'], array['Аям горенг берэмпах', 'KFC']),
(23, 'Date budget: street food or fine dining?', 'Bajet temu janji: makanan jalanan atau restoran mewah?', 'Бюджет свидания: уличная еда или ресторан?',
  array['Street food', 'Fine dining'], array['Makanan jalanan', 'Restoran mewah'], array['Уличная еда', 'Ресторан']),
(24, 'Sambal: extra, a little or none?', 'Sambal: lebih, sikit atau tanpa?', 'Самбал: побольше, немного или без него?',
  array['Extra', 'A little', 'None'], array['Lebih', 'Sikit', 'Tanpa'], array['Побольше', 'Немного', 'Без него']),
(25, 'Cats or dogs?', 'Kucing atau anjing?', 'Кошки или собаки?',
  array['Cats', 'Dogs', 'Both'], array['Kucing', 'Anjing', 'Kedua-duanya'], array['Кошки', 'Собаки', 'И те и другие']),
(26, 'Weekend plans: planned or spontaneous?', 'Rancangan hujung minggu: dirancang atau spontan?', 'Планы на выходные: по плану или спонтанно?',
  array['Planned', 'Spontaneous'], array['Dirancang', 'Spontan'], array['По плану', 'Спонтанно']),
(27, 'Texting, calling or voice notes?', 'Mesej, panggilan atau nota suara?', 'Переписка, звонки или голосовые?',
  array['Texting', 'Calling', 'Voice notes'], array['Mesej', 'Panggilan', 'Nota suara'], array['Переписка', 'Звонки', 'Голосовые']),
(28, 'Laksa: Penang, Sarawak or curry?', 'Laksa: Penang, Sarawak atau kari?', 'Лакса: пенангская, саравакская или карри?',
  array['Penang laksa', 'Sarawak laksa', 'Curry laksa'], array['Laksa Penang', 'Laksa Sarawak', 'Laksa kari'], array['Пенангская', 'Саравакская', 'Карри-лакса']),
(29, 'Movie night: cinema or Netflix at home?', 'Malam wayang: panggung atau Netflix di rumah?', 'Киновечер: кинотеатр или Netflix дома?',
  array['Cinema', 'Netflix at home'], array['Panggung', 'Netflix di rumah'], array['Кинотеатр', 'Netflix дома']),
(30, 'Kopitiam toast: kaya or butter?', 'Roti bakar kopitiam: kaya atau mentega?', 'Тост в копитиаме: с кайей или с маслом?',
  array['Kaya', 'Butter', 'Both'], array['Kaya', 'Mentega', 'Kedua-duanya'], array['С кайей', 'С маслом', 'С тем и другим']),
(31, 'Food trip: Ipoh or Melaka?', 'Trip makan: Ipoh atau Melaka?', 'Гастротур: Ипох или Малакка?',
  array['Ipoh', 'Melaka'], array['Ipoh', 'Melaka'], array['Ипох', 'Малакка']),
(32, 'Cycling in Putrajaya or jogging at KLCC park?', 'Berbasikal di Putrajaya atau berjoging di taman KLCC?', 'Велосипед в Путраджае или пробежка в парке KLCC?',
  array['Cycling', 'Jogging'], array['Berbasikal', 'Berjoging'], array['Велосипед', 'Пробежка']),
(33, 'Durian season: Musang King or D24?', 'Musim durian: Musang King atau D24?', 'Сезон дуриана: Musang King или D24?',
  array['Musang King', 'D24', 'Any durian'], array['Musang King', 'D24', 'Apa-apa durian'], array['Musang King', 'D24', 'Любой дуриан']),
(34, 'Karaoke: yes or no?', 'Karaoke: ya atau tidak?', 'Караоке: да или нет?',
  array['Yes', 'No', 'Only after dinner'], array['Ya', 'Tidak', 'Lepas makan malam saja'], array['Да', 'Нет', 'Только после ужина']),
(35, 'Mee goreng mamak or maggi goreng?', 'Mee goreng mamak atau maggi goreng?', 'Ми горенг мамак или магги горенг?',
  array['Mee goreng', 'Maggi goreng'], array['Mee goreng', 'Maggi goreng'], array['Ми горенг', 'Магги горенг']),
(36, 'Football: Liverpool, Man United or neither?', 'Bola sepak: Liverpool, Man United atau tak kisah?', 'Футбол: Ливерпуль, Манчестер Юнайтед или всё равно?',
  array['Liverpool', 'Man United', 'Neither'], array['Liverpool', 'Man United', 'Tak kisah'], array['Ливерпуль', 'Манчестер Юнайтед', 'Всё равно']),
(37, 'Ice cream: ais krim potong or gelato?', 'Aiskrim: ais krim potong atau gelato?', 'Мороженое: айс крим потонг или джелато?',
  array['Ais krim potong', 'Gelato'], array['Ais krim potong', 'Gelato'], array['Айс крим потонг', 'Джелато']),
(38, 'Island trip or city trip?', 'Trip pulau atau trip bandar?', 'Поездка на остров или в город?',
  array['Island', 'City'], array['Pulau', 'Bandar'], array['На остров', 'В город']),
(39, 'Pasar malam snack: apam balik or keropok lekor?', 'Snek pasar malam: apam balik atau keropok lekor?', 'Перекус на ночном рынке: апам балик или керопок лекор?',
  array['Apam balik', 'Keropok lekor'], array['Apam balik', 'Keropok lekor'], array['Апам балик', 'Керопок лекор']),
(40, 'First date: dinner, coffee or a walk?', 'Temu janji pertama: makan malam, kopi atau berjalan?', 'Первое свидание: ужин, кофе или прогулка?',
  array['Dinner', 'Coffee', 'A walk'], array['Makan malam', 'Kopi', 'Berjalan'], array['Ужин', 'Кофе', 'Прогулка']),
(41, 'Nasi kandar: Line Clear, Pelita or any?', 'Nasi kandar: Line Clear, Pelita atau mana-mana?', 'Наси кандар: Line Clear, Pelita или любой?',
  array['Line Clear', 'Pelita', 'Any nasi kandar'], array['Line Clear', 'Pelita', 'Mana-mana nasi kandar'], array['Line Clear', 'Pelita', 'Любой наси кандар']),
(42, 'Rooftop bar or kopitiam chat?', 'Bar bumbung atau sembang kopitiam?', 'Бар на крыше или разговор в копитиаме?',
  array['Rooftop', 'Kopitiam'], array['Bar bumbung', 'Kopitiam'], array['Бар на крыше', 'Копитиам']),
(43, 'Chili: Thai hot, Malaysian hot or mild?', 'Cili: pedas Thai, pedas Malaysia atau kurang pedas?', 'Перец: по-тайски, по-малайзийски или неострое?',
  array['Thai hot', 'Malaysian hot', 'Mild please'], array['Pedas Thai', 'Pedas Malaysia', 'Kurang pedas'], array['По-тайски', 'По-малайзийски', 'Неострое']),
(44, 'Long weekend: save or spend?', 'Cuti panjang: simpan atau belanja?', 'Длинные выходные: копить или тратить?',
  array['Save', 'Spend'], array['Simpan', 'Belanja'], array['Копить', 'Тратить']),
(45, 'Road trip: highway or trunk road?', 'Road trip: lebuhraya atau jalan lama?', 'Автопутешествие: по шоссе или по старой дороге?',
  array['Highway', 'Trunk road'], array['Lebuhraya', 'Jalan lama'], array['По шоссе', 'По старой дороге']),
(46, 'Dessert first: yes or no?', 'Pencuci mulut dulu: ya atau tidak?', 'Десерт первым: да или нет?',
  array['Yes', 'No'], array['Ya', 'Tidak'], array['Да', 'Нет']),
(47, 'Sunday breakfast: dim sum or nasi lemak?', 'Sarapan Ahad: dim sum atau nasi lemak?', 'Воскресный завтрак: димсам или наси лемак?',
  array['Dim sum', 'Nasi lemak'], array['Dim sum', 'Nasi lemak'], array['Димсам', 'Наси лемак']),
(48, 'Driving playlist: Malay hits, K-pop or English hits?', 'Playlist memandu: lagu Melayu, K-pop atau lagu Inggeris?', 'Плейлист в дороге: малайские хиты, K-pop или английские хиты?',
  array['Malay hits', 'K-pop', 'English hits'], array['Lagu Melayu', 'K-pop', 'Lagu Inggeris'], array['Малайские хиты', 'K-pop', 'Английские хиты']),
(49, 'Rendang: chicken or beef?', 'Rendang: ayam atau daging?', 'Ренданг: с курицей или с говядиной?',
  array['Chicken', 'Beef'], array['Ayam', 'Daging'], array['С курицей', 'С говядиной']),
(50, 'Sunrise at Broga Hill or sunset at Batu Ferringhi?', 'Matahari terbit di Broga Hill atau terbenam di Batu Ferringhi?', 'Рассвет на Брога Хилл или закат на Бату Ферринги?',
  array['Sunrise at Broga', 'Sunset at Batu Ferringhi'], array['Terbit di Broga', 'Terbenam di Batu Ferringhi'], array['Рассвет на Брога', 'Закат на Бату Ферринги']),
(51, 'Bubble tea or fresh coconut?', 'Bubble tea atau kelapa segar?', 'Бабл-ти или свежий кокос?',
  array['Bubble tea', 'Fresh coconut'], array['Bubble tea', 'Kelapa segar'], array['Бабл-ти', 'Свежий кокос']),
(52, 'Weekend getaway: Port Dickson or Fraser''s Hill?', 'Percutian hujung minggu: Port Dickson atau Fraser''s Hill?', 'Выходные за городом: Порт-Диксон или Фрейзерс Хилл?',
  array['Port Dickson', 'Fraser''s Hill'], array['Port Dickson', 'Fraser''s Hill'], array['Порт-Диксон', 'Фрейзерс Хилл']),
(53, 'Work from home or office?', 'Kerja dari rumah atau pejabat?', 'Работа из дома или из офиса?',
  array['Home', 'Office', 'A mix'], array['Rumah', 'Pejabat', 'Campur'], array['Из дома', 'Из офиса', 'И так и так']),
(54, 'Nasi lemak topping: sotong, ayam or plain?', 'Lauk nasi lemak: sotong, ayam atau kosong?', 'Наси лемак: с кальмаром, с курицей или без добавок?',
  array['Sotong', 'Ayam', 'Plain'], array['Sotong', 'Ayam', 'Kosong'], array['С кальмаром', 'С курицей', 'Без добавок']),
(55, 'KTM to Ipoh or fly to Kota Kinabalu?', 'KTM ke Ipoh atau terbang ke Kota Kinabalu?', 'Поезд KTM в Ипох или самолёт в Кота-Кинабалу?',
  array['KTM to Ipoh', 'Fly to KK'], array['KTM ke Ipoh', 'Terbang ke KK'], array['Поезд в Ипох', 'Самолёт в КК']),
(56, 'Chinese New Year: open house or quiet holiday?', 'Tahun Baru Cina: rumah terbuka atau cuti tenang?', 'Китайский Новый год: открытый дом или тихий отдых?',
  array['Open house', 'Quiet holiday'], array['Rumah terbuka', 'Cuti tenang'], array['Открытый дом', 'Тихий отдых']),
(57, 'Petai: love it or leave it?', 'Petai: suka atau tak?', 'Петай: любите или нет?',
  array['Love it', 'Leave it'], array['Suka', 'Tak suka'], array['Люблю', 'Нет, спасибо']),
(58, 'Sports day: sepak takraw or badminton?', 'Hari sukan: sepak takraw atau badminton?', 'Спортивный день: сепак такро или бадминтон?',
  array['Sepak takraw', 'Badminton'], array['Sepak takraw', 'Badminton'], array['Сепак такро', 'Бадминтон']),
(59, 'Deepavali sweets: murukku or ladoo?', 'Manisan Deepavali: murukku atau ladoo?', 'Сладости на Дипавали: мурукку или ладду?',
  array['Murukku', 'Ladoo', 'Both'], array['Murukku', 'Ladoo', 'Kedua-duanya'], array['Мурукку', 'Ладду', 'И то и другое']),
(60, 'Teh o ais limau or sirap bandung?', 'Teh o ais limau atau sirap bandung?', 'Те о айс лимау или сирап бандунг?',
  array['Teh o ais limau', 'Sirap bandung'], array['Teh o ais limau', 'Sirap bandung'], array['Те о айс лимау', 'Сирап бандунг']);
