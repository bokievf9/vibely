-- Call signalling and consent. Called by the Server Actions with the user's own client (auth.uid()),
-- which then talk to LiveKit (src/features/calls/server). Events go to the private Realtime topic
-- call:<user id> (20261008000122): incoming | answered | ended | permission.
-- Custom SQLSTATEs mapped to error keys in src/features/calls/errors.ts:
--   VC001 both participants must allow calls   VC002 recording notice not accepted   VC003 busy

-- Pushes a call event to one user. Internal only.
create function public.call_notify(p_user uuid, p_event text, p_call public.calls)
returns void
language sql
security definer
set search_path = ''
as $$
  select realtime.send(
    jsonb_build_object(
      'call_id', p_call.id, 'match_id', p_call.match_id, 'kind', p_call.kind,
      'status', p_call.status, 'caller_id', p_call.caller_id
    ),
    p_event, 'call:' || p_user::text, true
  )
  where p_user is not null;
$$;

-- Unanswered after 30 s = missed. Active rows a lost webhook left behind are closed after 6 hours.
create function public.expire_stale_calls()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.calls set status = 'missed', ended_at = now()
  where status = 'ringing' and started_at < now() - interval '30 seconds';
  update public.calls set status = 'ended', ended_at = now()
  where status = 'active' and coalesce(answered_at, started_at) < now() - interval '6 hours';
$$;

-- One-time "Calls are recorded and stored for up to 90 days for safety" notice.
create function public.accept_calls_notice()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.profiles set calls_consent_at = coalesce(calls_consent_at, now())
  where id = (select auth.uid())
  returning calls_consent_at;
$$;

-- "Allow calls in this chat". Allowing requires the accepted recording notice.
create function public.set_call_permission(p_match uuid, p_allowed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  partner uuid;
begin
  select case when m.user_a = me then m.user_b else m.user_a end into partner
  from public.matches m where m.id = p_match and me in (m.user_a, m.user_b);
  if partner is null then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if p_allowed then
    if not public.is_verified() then
      raise exception 'not verified' using errcode = '42501';
    end if;
    if not exists (select 1 from public.profiles where id = me and calls_consent_at is not null) then
      raise exception 'recording notice not accepted' using errcode = 'VC002';
    end if;
    insert into public.call_permissions (match_id, user_id) values (p_match, me)
    on conflict do nothing;
  else
    delete from public.call_permissions where match_id = p_match and user_id = me;
  end if;
  perform realtime.send(jsonb_build_object('match_id', p_match), 'permission',
    'call:' || partner::text, true);
end;
$$;

-- The caller's view of a chat's call settings; no row for non-participants.
create function public.call_settings(p_match uuid)
returns table (consented boolean, me_allowed boolean, partner_allowed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    me.calls_consent_at is not null,
    exists (select 1 from public.call_permissions where match_id = m.id and user_id = me.id),
    exists (
      select 1 from public.call_permissions
      where match_id = m.id and user_id = case when m.user_a = me.id then m.user_b else m.user_a end
    )
  from public.matches m
  join public.profiles me on me.id = (select auth.uid())
  where m.id = p_match and me.id in (m.user_a, m.user_b);
$$;

-- Rings the partner. Both must be verified, visible to each other (not blocked, banned or
-- deactivated), have allowed calls in this chat, and neither may be in another call.
create function public.start_call(p_match uuid, p_kind public.call_kind)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  partner uuid;
  c public.calls;
begin
  select case when m.user_a = me then m.user_b else m.user_a end into partner
  from public.matches m where m.id = p_match and me in (m.user_a, m.user_b);
  if partner is null then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if not public.is_verified() or not public.can_view_profile(partner) then
    raise exception 'calls need two verified users who have not blocked each other'
      using errcode = '42501';
  end if;
  if (
    select count(*) from public.call_permissions cp
    join public.profiles p on p.id = cp.user_id
    where cp.match_id = p_match and cp.user_id in (me, partner) and p.calls_consent_at is not null
  ) < 2 then
    raise exception 'both participants must allow calls' using errcode = 'VC001';
  end if;

  perform public.expire_stale_calls();
  if exists (
    select 1 from public.calls
    where status in ('ringing', 'active')
      and (caller_id in (me, partner) or callee_id in (me, partner))
  ) then
    raise exception 'busy' using errcode = 'VC003';
  end if;
  if (
    select count(*) from public.calls
    where caller_id = me and started_at > now() - interval '10 minutes'
  ) >= 10 then
    raise exception 'Rate limit exceeded: at most 10 calls per 10 minutes' using errcode = 'P0429';
  end if;

  insert into public.calls (match_id, caller_id, callee_id, kind)
  values (p_match, me, partner, p_kind)
  returning * into c;
  perform public.call_notify(partner, 'incoming', c);
  return c.id;
end;
$$;

-- Callee picks up. Returns the resulting status: 'active' on success, otherwise what the call
-- already was ('missed' once the 30 s ring is over, 'ended', 'declined').
create function public.answer_call(p_call uuid)
returns public.call_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.calls;
begin
  select * into c from public.calls
  where id = p_call and callee_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'not the callee' using errcode = '42501';
  end if;
  if c.status = 'ringing' and c.started_at < now() - interval '30 seconds' then
    update public.calls set status = 'missed', ended_at = now() where id = c.id returning * into c;
    perform public.call_notify(c.caller_id, 'ended', c);
  end if;
  if c.status <> 'ringing' then
    return c.status;
  end if;
  if not public.is_verified() or not public.can_view_profile(c.caller_id) then
    raise exception 'caller is no longer reachable' using errcode = '42501';
  end if;
  update public.calls set status = 'active', answered_at = now() where id = c.id returning * into c;
  perform public.call_notify(c.caller_id, 'answered', c);
  return c.status;
end;
$$;

-- Hang up / cancel / decline, by either participant. Ringing + caller = missed (cancelled),
-- ringing + callee = declined, active = ended. Idempotent: returns the final status.
create function public.end_call(p_call uuid)
returns public.call_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.calls;
begin
  select * into c from public.calls where id = p_call and me in (caller_id, callee_id) for update;
  if not found then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if c.status not in ('ringing', 'active') then
    return c.status;
  end if;
  update public.calls
  set status = case
        when c.status = 'active' then 'ended'
        when me = c.caller_id then 'missed'
        else 'declined'
      end::public.call_status,
      ended_at = now()
  where id = c.id
  returning * into c;
  perform public.call_notify(case when me = c.caller_id then c.callee_id else c.caller_id end, 'ended', c);
  return c.status;
end;
$$;

-- Server-side end (LiveKit webhook: somebody left, room closed; failed recording start).
create function public.finish_call(p_call uuid)
returns public.call_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.calls;
begin
  update public.calls
  set status = case when status = 'active' then 'ended' else 'missed' end::public.call_status,
      ended_at = now()
  where id = p_call and status in ('ringing', 'active')
  returning * into c;
  if not found then
    return (select status from public.calls where id = p_call);
  end if;
  perform public.call_notify(c.caller_id, 'ended', c);
  perform public.call_notify(c.callee_id, 'ended', c);
  return c.status;
end;
$$;

revoke execute on function public.call_notify(uuid, text, public.calls) from public, anon, authenticated;
revoke execute on function public.expire_stale_calls() from public, anon, authenticated;
revoke execute on function public.finish_call(uuid) from public, anon, authenticated;
revoke execute on function public.accept_calls_notice() from public, anon;
revoke execute on function public.set_call_permission(uuid, boolean) from public, anon;
revoke execute on function public.call_settings(uuid) from public, anon;
revoke execute on function public.start_call(uuid, public.call_kind) from public, anon;
revoke execute on function public.answer_call(uuid) from public, anon;
revoke execute on function public.end_call(uuid) from public, anon;
grant execute on function public.accept_calls_notice() to authenticated;
grant execute on function public.set_call_permission(uuid, boolean) to authenticated;
grant execute on function public.call_settings(uuid) to authenticated;
grant execute on function public.start_call(uuid, public.call_kind) to authenticated;
grant execute on function public.answer_call(uuid) to authenticated;
grant execute on function public.end_call(uuid) to authenticated;
grant execute on function public.finish_call(uuid) to service_role;
