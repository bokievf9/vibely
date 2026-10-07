-- Extensions live in the `extensions` schema (Supabase convention).
create extension if not exists postgis with schema extensions;

create type public.gender as enum ('male', 'female', 'other');
create type public.verification_status as enum ('unverified', 'pending', 'approved', 'rejected');
create type public.swipe_direction as enum ('like', 'pass');
create type public.match_source as enum ('swipe', 'randomizer');
create type public.random_session_status as enum ('active', 'ended');
create type public.report_target as enum ('user', 'post', 'comment', 'random_session');

-- Shared trigger: keep updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Full years between birth_date and today.
create function public.age_in_years(birth_date date)
returns int
language sql
stable
set search_path = ''
as $$
  select extract(year from age(current_date, birth_date))::int;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
