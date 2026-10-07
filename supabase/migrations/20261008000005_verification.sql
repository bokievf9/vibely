-- Selfie verification: the user photographs themselves repeating a random gesture (`challenge`),
-- a moderator reviews it with the service role.
create table public.verification_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  selfie_path      text not null,
  challenge        text not null check (char_length(challenge) between 2 and 64),
  status           public.verification_status not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  reviewer_id      uuid references auth.users (id) on delete set null,
  rejection_reason text check (char_length(rejection_reason) <= 500),
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz
);

create unique index verification_requests_one_pending_idx
  on public.verification_requests (user_id) where status = 'pending';
create index verification_requests_queue_idx
  on public.verification_requests (created_at) where status = 'pending';

-- Mirror the request status onto the profile (the profile column is not client-writable).
create function public.sync_verification_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;

  update public.profiles
  set verification_status = new.status
  where id = new.user_id
    -- An approved user re-submitting must not lose access while pending.
    and not (verification_status = 'approved' and new.status = 'pending');

  return new;
end;
$$;

create trigger verification_requests_sync_status
  before insert or update of status on public.verification_requests
  for each row execute function public.sync_verification_status();

revoke execute on function public.sync_verification_status() from public, anon, authenticated;

alter table public.verification_requests enable row level security;

revoke all on public.verification_requests from anon, authenticated;
grant select (id, user_id, challenge, status, rejection_reason, created_at, reviewed_at)
  on public.verification_requests to authenticated;
grant insert (selfie_path, challenge) on public.verification_requests to authenticated;

create policy "verification: read own" on public.verification_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy "verification: create own" on public.verification_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and split_part(selfie_path, '/', 1) = (select auth.uid())::text
  );
