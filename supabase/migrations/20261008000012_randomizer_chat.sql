-- Messages are persisted, then broadcast without sender ids: clients learn only `from` ('a'/'b')
-- and compare it with `my_side` from get_random_session().
create function public.randomizer_send(p_session_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  side text := public.random_session_side(p_session_id);
  msg public.random_chat_messages;
begin
  if side is null or not exists (
    select 1 from public.random_chat_sessions where id = p_session_id and status = 'active'
  ) then
    raise exception 'Session not active' using errcode = 'insufficient_privilege';
  end if;

  insert into public.random_chat_messages (session_id, sender_id, body)
  values (p_session_id, (select auth.uid()), btrim(p_body))
  returning * into msg;

  perform realtime.send(
    jsonb_build_object('id', msg.id, 'body', msg.body, 'from', side, 'created_at', msg.created_at),
    'message', 'random:' || p_session_id::text, true);
  return msg.id;
end;
$$;

create function public.get_random_messages(
  p_session_id uuid,
  p_before     timestamptz default null,
  p_limit      int default 50
)
returns table (id uuid, body text, is_mine boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.body, m.sender_id = (select auth.uid()), m.created_at
  from public.random_chat_messages m
  where m.session_id = p_session_id
    and public.random_session_side(p_session_id) is not null
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit least(100, greatest(1, p_limit));
$$;

-- Records the caller's consent. When both sides agree, creates the match.
create function public.randomizer_reveal(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  side text := public.random_session_side(p_session_id);
  s public.random_chat_sessions;
begin
  if side is null then
    raise exception 'Not a participant' using errcode = 'insufficient_privilege';
  end if;

  update public.random_chat_sessions
  set a_revealed = a_revealed or side = 'a',
      b_revealed = b_revealed or side = 'b'
  where id = p_session_id and status = 'active'
  returning * into s;
  if s.id is null then
    raise exception 'Session not active' using errcode = 'insufficient_privilege';
  end if;

  if s.a_revealed and s.b_revealed then
    if s.match_id is null then
      update public.random_chat_sessions
      set match_id = public.ensure_match(s.user_a, s.user_b, 'randomizer'), revealed_at = now()
      where id = s.id;
    end if;
    perform realtime.send('{}'::jsonb, 'revealed', 'random:' || s.id::text, true);
    return true;
  end if;

  perform realtime.send(jsonb_build_object('from', side), 'reveal_requested', 'random:' || s.id::text, true);
  return false;
end;
$$;

create function public.randomizer_end(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.random_chat_sessions
  set status = 'ended', ended_at = now()
  where id = p_session_id and status = 'active'
    and (select auth.uid()) in (user_a, user_b);
  if found then
    perform realtime.send('{}'::jsonb, 'ended', 'random:' || p_session_id::text, true);
  end if;
end;
$$;

revoke execute on function public.randomizer_send(uuid, text) from public, anon;
revoke execute on function public.get_random_messages(uuid, timestamptz, int) from public, anon;
revoke execute on function public.randomizer_reveal(uuid) from public, anon;
revoke execute on function public.randomizer_end(uuid) from public, anon;
grant execute on function public.randomizer_send(uuid, text) to authenticated;
grant execute on function public.get_random_messages(uuid, timestamptz, int) to authenticated;
grant execute on function public.randomizer_reveal(uuid) to authenticated;
grant execute on function public.randomizer_end(uuid) to authenticated;
