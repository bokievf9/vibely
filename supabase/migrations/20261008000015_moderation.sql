-- Moderators. Managed only with the service role (e.g. Supabase Studio); no client access.
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Audit trail of every moderation decision.
create table public.moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   uuid not null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index moderation_actions_created_idx on public.moderation_actions (created_at desc);
create index moderation_actions_target_idx on public.moderation_actions (target_id);

alter table public.admins enable row level security;
alter table public.moderation_actions enable row level security;
revoke all on public.admins, public.moderation_actions from anon, authenticated;

-- Bans. Clients cannot write these columns (no column grant).
alter table public.profiles
  add column banned_at  timestamptz,
  add column ban_reason text check (char_length(ban_reason) <= 500);

-- A banned profile is forced inactive, which every visibility check already respects
-- (can_view_profile, is_verified, swipe candidates, randomizer matching).
create function public.profiles_enforce_ban()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.banned_at is not null then
    new.is_active := false;
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_ban
  before insert or update on public.profiles
  for each row execute function public.profiles_enforce_ban();

revoke execute on function public.profiles_enforce_ban() from public, anon, authenticated;

alter table public.reports
  add column resolved_by uuid references auth.users (id) on delete set null,
  add column resolution  text check (char_length(resolution) <= 500);

create index reports_target_idx on public.reports (target_type, target_id);

-- Users can report anything they interact with; one open report per target per reporter.
create unique index reports_one_open_per_target_idx
  on public.reports (reporter_id, target_type, target_id) where resolved_at is null;

-- The owner may see their own ban (others can't see banned profiles at all: they are inactive).
grant select (banned_at, ban_reason) on public.profiles to authenticated;
