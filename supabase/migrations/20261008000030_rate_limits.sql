-- Anti-bot rate limits, enforced in the database so they also hold for direct API calls.
-- Raises SQLSTATE P0429 (the app maps it to the `rateLimited` error key).
-- Trigger arguments: the column holding the acting user, the max rows, the time window.
create function public.enforce_rate_limit()
returns trigger
language plpgsql
-- Definer: users can't SELECT their own reports, but the count must see them.
security definer
set search_path = ''
as $$
declare
  user_col  text := tg_argv[0];
  max_rows  int := tg_argv[1]::int;
  win       interval := tg_argv[2]::interval;
  actor     uuid := (to_jsonb(new) ->> user_col)::uuid;
  recent    int;
begin
  execute format(
    'select count(*) from (select 1 from %I.%I where %I = $1 and created_at > now() - $2 limit $3) r',
    tg_table_schema, tg_table_name, user_col
  ) into recent using actor, win, max_rows;
  if recent >= max_rows then
    raise exception 'Rate limit exceeded: at most % per %', max_rows, win using errcode = 'P0429';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

-- Indexes so each check is a short range scan.
create index swipes_swiper_recent_idx on public.swipes (swiper_id, created_at desc);
create index messages_sender_recent_idx on public.messages (sender_id, created_at desc);
create index random_messages_sender_recent_idx
  on public.random_chat_messages (sender_id, created_at desc);
create index reports_reporter_recent_idx on public.reports (reporter_id, created_at desc);

create trigger swipes_rate_limit
  before insert on public.swipes
  for each row execute function public.enforce_rate_limit('swiper_id', '300', '24 hours');

create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_rate_limit('sender_id', '30', '1 minute');

-- Fires inside randomizer_send(), so the RPC fails with P0429 too.
create trigger random_chat_messages_rate_limit
  before insert on public.random_chat_messages
  for each row execute function public.enforce_rate_limit('sender_id', '30', '1 minute');

create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.enforce_rate_limit('reporter_id', '20', '24 hours');
