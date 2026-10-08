-- Moderator roles (batch-4, admin sanctions).
--
--   viewer     read only (queues, users, log, stats)
--   moderator  + verification, content, reports, warnings, mutes, temporary bans up to 7 days
--   admin      + permanent bans, unban, revoke verification, shadow-ban, phone blocklist,
--                evidence hold, deleting anyone's notes, audit log CSV export
--   owner      + managing the team (public.admins) and legal data exports
--
-- The enum order is the rank: a role includes every permission of the roles before it.
-- Every row that existed before this migration was a full moderator managed in Studio: it becomes
-- 'owner' so nobody loses access on deploy. Rows inserted later without a role (Studio, scripts)
-- get 'admin', i.e. exactly the powers a moderator had before roles existed; the team page
-- (admin_set_member_role) always sets the role explicitly.
create type public.admin_role as enum ('viewer', 'moderator', 'admin', 'owner');

alter table public.admins
  add column role     public.admin_role not null default 'owner',
  add column added_by uuid references auth.users (id) on delete set null;
alter table public.admins alter column role set default 'admin';

-- Role of a panel member, or null for everyone else.
create function public.admin_role_of(p_user uuid)
returns public.admin_role
language sql
stable
set search_path = ''
as $$
  select role from public.admins where user_id = p_user;
$$;

-- Raises unless p_admin has at least p_min. Same errcode as before (42501), so the panel's
-- error handling is unchanged.
create function public.assert_admin_role(p_admin uuid, p_min public.admin_role)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  r public.admin_role := public.admin_role_of(p_admin);
begin
  if r is null then
    raise exception 'Not a moderator' using errcode = 'insufficient_privilege';
  end if;
  if r < p_min then
    raise exception 'Role % required', p_min using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- assert_admin() is what every existing moderation RPC calls before it writes (verification,
-- content, reports, photos, call recordings): from now on it means "moderator or higher", so a
-- viewer can read the panel but change nothing. Read-only RPCs use assert_admin_role(.., 'viewer').
create or replace function public.assert_admin(p_admin uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'moderator');
end;
$$;

-- Revoking verification is an admin decision. Body copied from 20261008000016.
create or replace function public.admin_revoke_verification(p_admin uuid, p_user uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  update public.profiles set verification_status = 'unverified' where id = p_user;
  perform public.log_moderation(p_admin, 'user.revoke_verification', 'user', p_user, p_reason);
end;
$$;

-- User search is a read: viewers may use it. Copied from 20261009000140 (usernames).
create or replace function public.admin_find_users(p_admin uuid, p_query text default '', p_limit int default 50)
returns table (
  id uuid, display_name text, username text, phone text,
  verification_status public.verification_status,
  banned_at timestamptz, created_at timestamptz, open_reports bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  return query
  select p.id, p.display_name, p.username, u.phone::text, p.verification_status, p.banned_at,
    p.created_at,
    (select count(*) from public.reports r
     where r.target_type = 'user' and r.target_id = p.id and r.resolved_at is null)
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(btrim(p_query), '') = ''
     or p.display_name ilike '%' || btrim(p_query) || '%'
     or (public.normalize_username(p_query) <> ''
         and strpos(p.username, public.normalize_username(p_query)) > 0)
     or u.phone like '%' || regexp_replace(p_query, '\D', '', 'g') || '%'
        and regexp_replace(p_query, '\D', '', 'g') <> ''
     or p.id::text = btrim(p_query)
  order by p.created_at desc
  limit least(200, greatest(1, p_limit));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Team management (/admin/team), owner only. Every change is logged.

-- Finds exactly one account by user id, phone (any format, digits compared) or @username.
create function public.admin_resolve_user(p_admin uuid, p_query text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  digits text := regexp_replace(q, '\D', '', 'g');
  found_id uuid;
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  if q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into found_id from auth.users where id = q::uuid;
  elsif q ~ '^\+?[0-9 ()-]{8,20}$' and digits <> '' then
    select id into found_id from auth.users where phone = digits;
  else
    select id into found_id from public.profiles where username = public.normalize_username(q);
  end if;
  return found_id;
end;
$$;

create function public.admin_list_team(p_admin uuid)
returns table (
  user_id uuid, role public.admin_role, display_name text, username text, phone text,
  added_by uuid, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'owner');
  return query
  select a.user_id, a.role, p.display_name, p.username, u.phone::text, a.added_by, a.created_at
  from public.admins a
  join auth.users u on u.id = a.user_id
  left join public.profiles p on p.id = a.user_id
  order by a.role desc, a.created_at;
end;
$$;

-- Adds a member or changes their role. The last owner can never be demoted.
create function public.admin_set_member_role(p_admin uuid, p_user uuid, p_role public.admin_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.admin_role;
begin
  perform public.assert_admin_role(p_admin, 'owner');
  if p_role is null then
    raise exception 'Role required' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;
  -- Serialises concurrent team changes so the "last owner" check below can't race.
  perform 1 from public.admins where role = 'owner' for update;
  old_role := public.admin_role_of(p_user);
  if old_role = 'owner' and p_role <> 'owner'
     and (select count(*) from public.admins where role = 'owner') <= 1 then
    raise exception 'The last owner cannot be demoted' using errcode = 'check_violation';
  end if;
  if old_role is not distinct from p_role then
    return;
  end if;

  insert into public.admins (user_id, role, added_by) values (p_user, p_role, p_admin)
  on conflict (user_id) do update set role = excluded.role;

  perform public.log_moderation(p_admin, case when old_role is null then 'admin.add' else 'admin.role' end,
    'user', p_user, coalesce(old_role::text || ' → ', '') || p_role::text);
end;
$$;

create function public.admin_remove_member(p_admin uuid, p_user uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.admin_role;
begin
  perform public.assert_admin_role(p_admin, 'owner');
  perform 1 from public.admins where role = 'owner' for update;
  old_role := public.admin_role_of(p_user);
  if old_role is null then
    raise exception 'Not a team member' using errcode = 'no_data_found';
  end if;
  if old_role = 'owner' and (select count(*) from public.admins where role = 'owner') <= 1 then
    raise exception 'The last owner cannot be removed' using errcode = 'check_violation';
  end if;
  delete from public.admins where user_id = p_user;
  perform public.log_moderation(p_admin, 'admin.remove', 'user', p_user,
    coalesce(nullif(btrim(p_reason), ''), old_role::text));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_role_of(uuid)',
    'assert_admin_role(uuid, public.admin_role)',
    'admin_resolve_user(uuid, text)',
    'admin_list_team(uuid)',
    'admin_set_member_role(uuid, uuid, public.admin_role)',
    'admin_remove_member(uuid, uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
