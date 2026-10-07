-- Randomizer presence: a waiting user pings every ~20s; only users seen in the last 45s get paired,
-- so nobody is matched with a closed tab.
alter table public.random_chat_queue
  add column last_seen_at timestamptz not null default now();

create index random_chat_queue_seen_idx on public.random_chat_queue (last_seen_at);

create or replace function public.randomizer_join(
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

  delete from public.random_chat_queue
  where user_id = me.id or last_seen_at < now() - interval '10 minutes';

  -- Compatibility must hold both ways: each side fits the other's filters.
  select q.user_id into partner
  from public.random_chat_queue q
  join public.profiles p on p.id = q.user_id
  where q.last_seen_at > now() - interval '45 seconds'
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

create function public.randomizer_ping()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.random_chat_queue set last_seen_at = now() where user_id = (select auth.uid());
$$;

revoke execute on function public.randomizer_ping() from public, anon;
grant execute on function public.randomizer_ping() to authenticated;
