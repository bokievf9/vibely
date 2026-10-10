-- Plan interest: "Notify me when it launches" on the Plans screen and the upgrade sheet.
--
-- Payments are not connected yet, so Plus and VIP cannot be bought. A tap records that the user
-- wants a plan; the admin panel (/admin/plans) shows the counts per plan so the owner can see the
-- demand before prices are set. One row per user and plan: a repeated tap only refreshes it.
--
--   * register_plan_interest(p_plan): true when the row is new, false when it already existed.
--     Rate limited: one tap per 10 seconds per user (P0429, the app shows `rateLimited`).
--   * Users read their own rows (to show "We will let you know" instead of the button).
--   * admin_plan_stats (20261009000280) gains `interest`: {plus: {total, last_7d}, vip: {...}}.
--   * Rows go with the account (on delete cascade). Nothing else is stored.

create table public.plan_interest (
  user_id    uuid not null references auth.users (id) on delete cascade,
  plan       public.plan_level not null check (plan <> 'free'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, plan)
);

create index plan_interest_plan_idx on public.plan_interest (plan, created_at desc);
create index plan_interest_recent_idx on public.plan_interest (user_id, updated_at desc);

alter table public.plan_interest enable row level security;
revoke all on public.plan_interest from anon, authenticated;
grant select on public.plan_interest to authenticated;
create policy "plan_interest: own" on public.plan_interest
  for select to authenticated using (user_id = (select auth.uid()));

create function public.register_plan_interest(p_plan text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  fresh boolean;
begin
  if me is null or not exists (select 1 from public.profiles p where p.id = me) then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_plan is null or p_plan not in ('plus', 'vip') then
    raise exception 'Unknown plan' using errcode = '22023';
  end if;
  if exists (select 1 from public.plan_interest i
             where i.user_id = me and i.updated_at > now() - interval '10 seconds') then
    raise exception 'Rate limit exceeded: one tap per 10 seconds' using errcode = 'P0429';
  end if;
  insert into public.plan_interest (user_id, plan)
  values (me, p_plan::public.plan_level)
  on conflict (user_id, plan) do update set updated_at = now()
  returning (xmax = 0) into fresh;
  return fresh;
end;
$$;

revoke execute on function public.register_plan_interest(text) from public, anon;
grant execute on function public.register_plan_interest(text) to authenticated;

-- From 20261009000280, plus `interest`.
-- {by_plan: {free, plus, vip}, staff, by_source: [{source, active, total, last_30d}],
--  interest: {plus: {total, last_7d}, vip: {total, last_7d}}}
create or replace function public.admin_plan_stats(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  per_plan jsonb;
  per_source jsonb;
  per_interest jsonb;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  with active as (
    select g.user_id, max(g.plan) as plan
    from public.plan_grants g
    where g.revoked_at is null and g.starts_at <= now() and (g.ends_at is null or g.ends_at > now())
    group by g.user_id
  )
  select jsonb_build_object(
    'free', (select count(*) from public.profiles p where not exists (select 1 from active a where a.user_id = p.id)),
    'plus', (select count(*) from active where plan = 'plus'),
    'vip',  (select count(*) from active where plan = 'vip'))
  into per_plan;
  select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'active', s.active, 'total', s.total,
                                               'last_30d', s.recent) order by s.source), '[]'::jsonb)
  into per_source
  from (
    select g.source,
      count(*) filter (where g.revoked_at is null and g.starts_at <= now()
                       and (g.ends_at is null or g.ends_at > now())) as active,
      count(*) as total,
      count(*) filter (where g.created_at > now() - interval '30 days') as recent
    from public.plan_grants g
    group by g.source
  ) s;
  select jsonb_build_object(
    'plus', jsonb_build_object(
      'total',   count(*) filter (where i.plan = 'plus'),
      'last_7d', count(*) filter (where i.plan = 'plus' and i.created_at > now() - interval '7 days')),
    'vip', jsonb_build_object(
      'total',   count(*) filter (where i.plan = 'vip'),
      'last_7d', count(*) filter (where i.plan = 'vip' and i.created_at > now() - interval '7 days')))
  into per_interest
  from public.plan_interest i;
  return jsonb_build_object(
    'by_plan', per_plan,
    'staff', (select count(*) from public.admins),
    'by_source', per_source,
    'interest', per_interest);
end;
$$;

revoke execute on function public.admin_plan_stats(uuid) from public, anon, authenticated;
grant execute on function public.admin_plan_stats(uuid) to service_role;
