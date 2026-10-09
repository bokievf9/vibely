-- Blind Dating (replaces "Random chat"). Same queue, sessions and messages, new ending:
--   * each side is shown only as an alias ("Partner #402"), stable per session and chosen here;
--   * no profile data, photo or user id reaches a client before BOTH press Connect;
--   * Pass ends the session for both; the other side only learns that it ended ("they moved on");
--   * mutual Connect creates (or reuses) the match, copies the transcript into public.messages and
--     reveals the profiles.
-- Messages stay in random_chat_messages with the existing 90-day retention (20261009000154).
-- Realtime authorization is unchanged: the database broadcasts on random:<session id> (participants)
-- and randomizer:<user id> (that user only).
--
-- Internal names (random_chat_*, randomizer_*) are kept. Old RPCs keep their signatures:
-- randomizer_reveal() = Connect, randomizer_end() = Pass, get_random_session() unchanged (its
-- partner/partner_revealed stay null/false while a session is active, see blind_decide below).

alter table public.random_chat_sessions
  add column decision_a boolean,
  add column decision_b boolean,
  add column decided_at timestamptz,
  add column alias_a    smallint,
  add column alias_b    smallint,
  -- Why an ended session ended. Internal: clients only see matched / passed (by me) / ended.
  add column end_reason text check (end_reason in ('pass', 'block', 'matched'));

-- Three-digit aliases, different for the two sides.
create function public.random_sessions_set_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.alias_a := 100 + floor(random() * 900)::int;
  new.alias_b := 100 + (new.alias_a - 100 + 1 + floor(random() * 899)::int) % 900;
  return new;
end;
$$;

revoke execute on function public.random_sessions_set_aliases() from public, anon, authenticated;

create trigger random_sessions_set_aliases
  before insert on public.random_chat_sessions
  for each row execute function public.random_sessions_set_aliases();

update public.random_chat_sessions
set alias_a = 100 + floor(random() * 900)::int
where alias_a is null;
update public.random_chat_sessions
set alias_b = 100 + (alias_a - 100 + 1 + floor(random() * 899)::int) % 900
where alias_b is null;

alter table public.random_chat_sessions
  alter column alias_a set not null,
  alter column alias_b set not null,
  add constraint random_sessions_aliases check (
    alias_a between 100 and 999 and alias_b between 100 and 999 and alias_a <> alias_b);

-- The transcript copy below is a system action: the messages were already rate limited, mute
-- checked and risk flagged when they were sent in the blind chat. These three triggers skip rows
-- inserted while blind_decide() sets the transaction-local flag. Clients cannot set it (PostgREST
-- exposes no way to run set_config).
drop trigger messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row
  when (coalesce(current_setting('vibely.blind_copy', true), '') <> 'on')
  execute function public.enforce_rate_limit('sender_id', '30', '1 minute');

drop trigger messages_enforce_not_muted on public.messages;
create trigger messages_enforce_not_muted
  before insert on public.messages
  for each row
  when (coalesce(current_setting('vibely.blind_copy', true), '') <> 'on')
  execute function public.enforce_not_muted('sender_id');

drop trigger messages_flag_risk on public.messages;
create trigger messages_flag_risk
  after insert or update of body on public.messages
  for each row
  when (coalesce(current_setting('vibely.blind_copy', true), '') <> 'on')
  execute function public.messages_flag_risk();

-- What the caller may know about how a session ended.
create function public.blind_state(s public.random_chat_sessions, side text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when s.status = 'active' then 'active'
    when s.end_reason = 'matched' then 'matched'
    when (case side when 'a' then s.decision_a else s.decision_b end) is false then 'passed'
    else 'ended'
  end;
$$;

revoke execute on function public.blind_state(public.random_chat_sessions, text) from public, anon, authenticated;

-- The caller's session: p_session when given (any state, e.g. to show the reveal after a match),
-- otherwise the newest active one. Before a match there is no profile data, no user id and nothing
-- about the partner's decision: only the aliases, my own decision and shared interests.
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
  started_at    timestamptz
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
    s.started_at
  from s;
$$;

-- Connect (p_connect = true) or Pass (false). Atomic: the session row is locked, so two
-- simultaneous Connects produce exactly one match and one transcript copy. Idempotent: deciding
-- on a session that already ended returns its outcome and changes nothing.
-- Returns {"state": "waiting" | "matched" | "passed" | "ended", "match_id": uuid | null}, plus
-- "just_matched": true on the one call that completed the match.
-- Broadcasts:
--   decided  on randomizer:<caller>  {session_id, decision}   (the caller's other tabs/devices)
--   matched  on random:<session>     {match_id}               (both, on mutual Connect)
--   ended    on random:<session>     {}                       (both, on Pass; same as before)
-- The partner never receives anything about a Connect until it is mutual.
create function public.blind_decide(p_session uuid, p_connect boolean)
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

-- Blocks the other participant without learning who they are. Works during and after the session
-- (e.g. from the "they moved on" screen). Ends an active session like a Pass and, as the app's
-- regular block does, removes a match between the two.
create function public.blind_block(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    uuid := (select auth.uid());
  s     public.random_chat_sessions;
  other uuid;
begin
  select * into s from public.random_chat_sessions
  where id = p_session and me in (user_a, user_b)
  for update;
  if s.id is null then
    raise exception 'Not a participant' using errcode = 'insufficient_privilege';
  end if;
  other := case when s.user_a = me then s.user_b else s.user_a end;

  insert into public.blocks (blocker_id, blocked_id) values (me, other)
  on conflict do nothing;
  delete from public.matches where user_a = least(me, other) and user_b = greatest(me, other);

  if s.status = 'active' then
    update public.random_chat_sessions
    set decision_a = case when s.user_a = me then false else decision_a end,
        decision_b = case when s.user_b = me then false else decision_b end,
        decided_at = now(), status = 'ended', ended_at = now(), end_reason = 'block'
    where id = s.id;
    perform realtime.send('{}'::jsonb, 'ended', 'random:' || s.id::text, true);
  end if;
end;
$$;

-- Old entry points, kept for clients from before this migration.
-- Reveal = Connect. No more 'reveal_requested' broadcast: the partner learns nothing until mutual.
create or replace function public.randomizer_reveal(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if public.random_session_side(p_session_id) is null then
    raise exception 'Not a participant' using errcode = 'insufficient_privilege';
  end if;
  r := public.blind_decide(p_session_id, true);
  if r ->> 'state' = 'matched' then
    return true;
  elsif r ->> 'state' = 'waiting' then
    return false;
  end if;
  raise exception 'Session not active' using errcode = 'insufficient_privilege';
end;
$$;

-- End = Pass (silently ignores sessions that are not the caller's or already ended, as before).
create or replace function public.randomizer_end(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.random_session_side(p_session_id) is not null then
    perform public.blind_decide(p_session_id, false);
  end if;
end;
$$;

revoke execute on function public.get_blind_session(uuid) from public, anon;
revoke execute on function public.blind_decide(uuid, boolean) from public, anon;
revoke execute on function public.blind_block(uuid) from public, anon;
grant execute on function public.get_blind_session(uuid) to authenticated;
grant execute on function public.blind_decide(uuid, boolean) to authenticated;
grant execute on function public.blind_block(uuid) to authenticated;
