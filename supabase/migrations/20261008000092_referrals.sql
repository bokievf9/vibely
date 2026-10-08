-- Invite friends: one share code per user (https://vibelydate.com/{lang}?ref=<code>).
-- The landing page stores the code in a cookie; right after the profile is created the app calls
-- claim_referral(), which records who invited the new user in profiles.referred_by.

-- Not granted to clients (column grants on profiles are explicit, see 20261008000004).
alter table public.profiles
  add column referred_by uuid references public.profiles (id) on delete set null;

create index profiles_referred_by_idx on public.profiles (referred_by) where referred_by is not null;

create table public.referral_codes (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  code       text not null unique check (code ~ '^[a-z0-9]{8}$'),
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;
revoke all on public.referral_codes from anon, authenticated;
grant select on public.referral_codes to authenticated;

create policy "referral_codes: own" on public.referral_codes
  for select to authenticated using (user_id = (select auth.uid()));

-- The caller's code (created on first use) and how many people signed up with it.
create function public.get_my_referral()
returns table (code text, invited int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_code text;
begin
  if me is null or not exists (select 1 from public.profiles where profiles.id = me) then
    raise exception 'Profile required' using errcode = 'insufficient_privilege';
  end if;

  select rc.code into my_code from public.referral_codes rc where rc.user_id = me;
  while my_code is null loop
    insert into public.referral_codes (user_id, code)
    values (me, substr(md5(gen_random_uuid()::text), 1, 8))
    on conflict do nothing
    returning referral_codes.code into my_code;
    -- Conflict: either a parallel call created our code, or the random code is taken (retry).
    if my_code is null then
      select rc.code into my_code from public.referral_codes rc where rc.user_id = me;
    end if;
  end loop;

  return query
  select my_code, (select count(*)::int from public.profiles p where p.referred_by = me);
end;
$$;

revoke execute on function public.get_my_referral() from public, anon;
grant execute on function public.get_my_referral() to authenticated;

-- Records the inviter once, only for a profile created within the last day (i.e. at sign-up),
-- never the caller's own code. Returns whether it was recorded.
create function public.claim_referral(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  inviter uuid;
begin
  select rc.user_id into inviter from public.referral_codes rc where rc.code = lower(p_code);
  if me is null or inviter is null or inviter = me then
    return false;
  end if;

  update public.profiles
  set referred_by = inviter
  where id = me and referred_by is null and created_at > now() - interval '1 day';
  return found;
end;
$$;

revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
