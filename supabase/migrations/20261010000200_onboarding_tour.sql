-- Onboarding tour: the in-app guided tour for new users and the one-time feature tips.
--
-- One row per user, written only through the functions below, so the tour does not start again on
-- a second phone and a tip seen on one device stays seen on the others. Nothing here is user
-- content: it is UI state, it goes with the account (on delete cascade) and is not exported.
--
--   * my_tour_state(): the caller's state as jsonb
--       {completed_at, skipped_at, seen_tips: text[], auto: boolean}
--     `auto` is true when the tour should open by itself: the tour was never completed or skipped
--     and the profile was created in the last 7 days. Accounts older than that (everyone who
--     signed up before this migration) are never interrupted; Settings still offers a replay.
--   * tour_mark(p_event, p_step): 'complete' or 'skip' (with the step index it was skipped at).
--     A replay completed later sets completed_at again; the first skip is kept for stats.
--   * tour_tip_seen(p_key): adds a tip key (lowercase, at most 32 characters, at most 32 keys).
--   * Users read their own row (RLS); no client writes the table directly.

create table public.onboarding_tour (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  completed_at timestamptz,
  skipped_at   timestamptz,
  skipped_step smallint check (skipped_step between 0 and 50),
  seen_tips    text[] not null default '{}' check (cardinality(seen_tips) <= 32),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.onboarding_tour enable row level security;
revoke all on public.onboarding_tour from anon, authenticated;
grant select on public.onboarding_tour to authenticated;
create policy "onboarding_tour: own" on public.onboarding_tour
  for select to authenticated using (user_id = (select auth.uid()));

create function public.my_tour_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  joined timestamptz;
  t public.onboarding_tour;
begin
  select p.created_at into joined from public.profiles p where p.id = me;
  if me is null or joined is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into t from public.onboarding_tour o where o.user_id = me;
  return jsonb_build_object(
    'completed_at', t.completed_at,
    'skipped_at', t.skipped_at,
    'seen_tips', to_jsonb(coalesce(t.seen_tips, '{}'::text[])),
    'auto', t.completed_at is null and t.skipped_at is null and joined > now() - interval '7 days');
end;
$$;

create function public.tour_mark(p_event text, p_step integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from public.profiles p where p.id = me) then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_event is null or p_event not in ('complete', 'skip') then
    raise exception 'Unknown tour event' using errcode = '22023';
  end if;
  if p_step is not null and (p_step < 0 or p_step > 50) then
    raise exception 'Step out of range' using errcode = '22023';
  end if;
  insert into public.onboarding_tour as o (user_id, completed_at, skipped_at, skipped_step)
  values (me,
          case when p_event = 'complete' then now() end,
          case when p_event = 'skip' then now() end,
          case when p_event = 'skip' then p_step end)
  on conflict (user_id) do update set
    completed_at = case when p_event = 'complete' then now() else o.completed_at end,
    skipped_at   = case when p_event = 'skip' then coalesce(o.skipped_at, now()) else o.skipped_at end,
    skipped_step = case when p_event = 'skip' and o.skipped_at is null then p_step else o.skipped_step end,
    updated_at   = now();
end;
$$;

create function public.tour_tip_seen(p_key text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from public.profiles p where p.id = me) then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[a-z][a-z_]{0,31}$' then
    raise exception 'Invalid tip key' using errcode = '22023';
  end if;
  insert into public.onboarding_tour as o (user_id, seen_tips)
  values (me, array[p_key])
  on conflict (user_id) do update set
    seen_tips  = case when p_key = any (o.seen_tips) or cardinality(o.seen_tips) >= 32
                      then o.seen_tips else o.seen_tips || p_key end,
    updated_at = now();
end;
$$;

revoke execute on function public.my_tour_state() from public, anon;
revoke execute on function public.tour_mark(text, integer) from public, anon;
revoke execute on function public.tour_tip_seen(text) from public, anon;
grant execute on function public.my_tour_state() to authenticated;
grant execute on function public.tour_mark(text, integer) to authenticated;
grant execute on function public.tour_tip_seen(text) to authenticated;
