-- "N people searching now": how many other users are present in the random-chat queue (pinged
-- within the last 45 seconds, the same window randomizer_join pairs from). Counts only, no identities.
create function public.randomizer_stats()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.random_chat_queue
  where last_seen_at > now() - interval '45 seconds'
    and user_id <> (select auth.uid());
$$;

revoke execute on function public.randomizer_stats() from public, anon;
grant execute on function public.randomizer_stats() to authenticated;
