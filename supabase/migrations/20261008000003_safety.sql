create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 3 and 1000),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index reports_open_idx on public.reports (created_at) where resolved_at is null;

-- True when either user has blocked the other.
create function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

alter table public.blocks enable row level security;
alter table public.reports enable row level security;

revoke all on public.blocks, public.reports from anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;
grant insert (target_type, target_id, reason) on public.reports to authenticated;

create policy "blocks: own rows" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks: create own" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "blocks: remove own" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- Reports are write-only for users; moderators read them with the service role.
create policy "reports: create own" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
