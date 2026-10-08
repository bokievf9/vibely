-- Sign-in with @username + password (src/features/auth/password*.ts).
--
-- Accounts are still created and verified by SMS OTP; the phone stays the identity. A password is
-- an optional second way in, set in Settings after a fresh SMS code. Supabase Auth stores and
-- checks the password (phone + password grant, with the Turnstile captcha); the app only maps the
-- username to the phone, with the service-role key.
--
-- * password_login_attempts: failed username sign-ins, for the rate limit (5 per username and 20
--   per IP in 15 minutes). Unknown usernames count like known ones, so the limit says nothing
--   about which usernames exist. Rows are kept one day (purged on every write); the IP address is
--   personal data and is not kept longer than the limit needs.
-- * password_login_check(): service role. Says whether the username or the IP is locked out and,
--   when not, returns the phone of the account (only if it has a password).
-- * password_login_record(): service role. Records a failure, or clears the username's failures
--   after a successful sign-in.
-- * my_has_password() / remove_my_password(): the caller's own password state. Removing sets
--   auth.users.encrypted_password to '' (what Supabase stores for OTP-only users), so the password
--   grant fails for that account until a new password is set.

create table public.password_login_attempts (
  id         bigint generated always as identity primary key,
  username   text not null check (char_length(username) <= 40),
  ip         inet,
  created_at timestamptz not null default now()
);

create index password_login_attempts_username_idx
  on public.password_login_attempts (username, created_at desc);
create index password_login_attempts_ip_idx
  on public.password_login_attempts (ip, created_at desc) where ip is not null;
create index password_login_attempts_created_idx
  on public.password_login_attempts (created_at);

alter table public.password_login_attempts enable row level security;
revoke all on public.password_login_attempts from anon, authenticated;

create function public.password_login_check(p_username text, p_ip inet)
returns table (limited boolean, phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  u text := left(public.normalize_username(p_username), 40);
  since timestamptz := now() - interval '15 minutes';
begin
  if (select count(*) from public.password_login_attempts a
      where a.username = u and a.created_at > since) >= 5
     or (p_ip is not null and (select count(*) from public.password_login_attempts a
      where a.ip = p_ip and a.created_at > since) >= 20) then
    return query select true, null::text;
    return;
  end if;

  return query
  select false,
    (select public.phone_e164(au.phone::text)
     from public.profiles p
     join auth.users au on au.id = p.id
     where p.username = u
       and au.phone is not null
       and coalesce(au.encrypted_password, '') <> ''
     limit 1);
end;
$$;

create function public.password_login_record(p_username text, p_ip inet, p_success boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u text := left(public.normalize_username(p_username), 40);
begin
  delete from public.password_login_attempts where created_at < now() - interval '1 day';
  if p_success then
    delete from public.password_login_attempts where username = u;
  else
    insert into public.password_login_attempts (username, ip) values (u, p_ip);
  end if;
end;
$$;

create function public.my_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select coalesce(u.encrypted_password, '') <> ''
                   from auth.users u where u.id = auth.uid()), false);
$$;

create function public.remove_my_password()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update auth.users set encrypted_password = '' where id = me;
  return found;
end;
$$;

revoke execute on function public.password_login_check(text, inet) from public, anon, authenticated;
revoke execute on function public.password_login_record(text, inet, boolean) from public, anon, authenticated;
grant execute on function public.password_login_check(text, inet) to service_role;
grant execute on function public.password_login_record(text, inet, boolean) to service_role;
revoke execute on function public.my_has_password() from public, anon;
revoke execute on function public.remove_my_password() from public, anon;
grant execute on function public.my_has_password() to authenticated;
grant execute on function public.remove_my_password() to authenticated;
