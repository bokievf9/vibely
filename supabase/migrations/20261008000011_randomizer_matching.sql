-- Pairs the caller with a compatible waiting user, or enqueues them.
-- Returns the session id, or null when the caller is now waiting in the queue
-- (they get a 'paired' broadcast on randomizer:<user id> later).
create function public.randomizer_join(
  p_genders public.gender[],
  p_min_age int,
  p_max_age int,
  p_tags    smallint[] default '{}'
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
begin
  select * into me from public.profiles where id = (select auth.uid());
  if me.id is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;

  p_min_age := greatest(18, p_min_age);
  p_max_age := least(99, greatest(p_min_age, p_max_age));
  p_tags := coalesce(p_tags[1:10], '{}');
  my_age := public.age_in_years(me.birth_date);
  select coalesce(array_agg(tag_id), '{}') into my_tags
  from public.profile_tags where profile_id = me.id;

  -- Serialize matchmaking: two users joining at once must see each other.
  perform pg_advisory_xact_lock(hashtext('randomizer_join'));

  select id into v_session from public.random_chat_sessions
  where status = 'active' and me.id in (user_a, user_b);
  if v_session is not null then
    return v_session;
  end if;

  delete from public.random_chat_queue where user_id = me.id;

  -- Compatibility must hold both ways: each side fits the other's filters.
  select q.user_id into partner
  from public.random_chat_queue q
  join public.profiles p on p.id = q.user_id
  where p.verification_status = 'approved'
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
    insert into public.random_chat_queue (user_id, want_genders, min_age, max_age, want_tags)
    values (me.id, p_genders, p_min_age, p_max_age, p_tags);
    return null;
  end if;

  delete from public.random_chat_queue where user_id = partner;
  insert into public.random_chat_sessions (user_a, user_b)
  values (partner, me.id)
  returning id into v_session;

  perform realtime.send(
    jsonb_build_object('session_id', v_session), 'paired', 'randomizer:' || partner::text, true);
  return v_session;
end;
$$;

create function public.randomizer_leave()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.random_chat_queue where user_id = (select auth.uid());
$$;

-- The caller's active session. The partner stays anonymous until both sides reveal:
-- only shared tags are exposed, and `partner` is null until then.
create function public.get_random_session()
returns table (
  id               uuid,
  my_side          text,
  my_revealed      boolean,
  partner_revealed boolean,
  common_tags      text[],
  partner          jsonb,
  match_id         uuid,
  started_at       timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select rs.*,
           case when rs.user_a = (select auth.uid()) then 'a' else 'b' end as side,
           case when rs.user_a = (select auth.uid()) then rs.user_b else rs.user_a end as other
    from public.random_chat_sessions rs
    where rs.status = 'active' and (select auth.uid()) in (rs.user_a, rs.user_b)
    order by rs.started_at desc
    limit 1
  )
  select
    s.id,
    s.side,
    case s.side when 'a' then s.a_revealed else s.b_revealed end,
    case s.side when 'a' then s.b_revealed else s.a_revealed end,
    coalesce((
      select array_agg(t.label order by t.label)
      from public.profile_tags mine
      join public.profile_tags theirs on theirs.tag_id = mine.tag_id and theirs.profile_id = s.other
      join public.tags t on t.id = mine.tag_id
      where mine.profile_id = (select auth.uid())
    ), '{}'),
    case when s.a_revealed and s.b_revealed then (
      select jsonb_build_object(
        'id', p.id, 'display_name', p.display_name,
        'age', public.age_in_years(p.birth_date), 'bio', p.bio, 'city', p.city)
      from public.profiles p where p.id = s.other
    ) end,
    s.match_id,
    s.started_at
  from s;
$$;

revoke execute on function public.randomizer_join(public.gender[], int, int, smallint[]) from public, anon;
revoke execute on function public.randomizer_leave() from public, anon;
revoke execute on function public.get_random_session() from public, anon;
grant execute on function public.randomizer_join(public.gender[], int, int, smallint[]) to authenticated;
grant execute on function public.randomizer_leave() to authenticated;
grant execute on function public.get_random_session() to authenticated;
