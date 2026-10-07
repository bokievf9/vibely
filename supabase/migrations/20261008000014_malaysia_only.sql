-- Vibely is Malaysia-only: every account must use a Malaysian mobile number (+60 1x...).
-- Enforced in Supabase Auth itself, because the publishable key lets anyone call Auth directly.
create function public.is_malaysian_mobile(phone text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(phone, ''), '\D', '', 'g') ~ '^601[0-9]{8,9}$';
$$;

-- Auth hook (supabase/config.toml → [auth.hook.before_user_created]).
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_malaysian_mobile(event -> 'user' ->> 'phone') then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Vibely is available only for Malaysian mobile numbers (+60)'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- Second line of defence: no profile without a Malaysian phone on the auth user.
create function public.profiles_enforce_malaysian_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_malaysian_mobile((select phone from auth.users where id = new.id)) then
    raise exception 'Malaysian mobile number required' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_malaysian_phone
  before insert on public.profiles
  for each row execute function public.profiles_enforce_malaysian_phone();

revoke execute on function public.profiles_enforce_malaysian_phone() from public, anon, authenticated;
