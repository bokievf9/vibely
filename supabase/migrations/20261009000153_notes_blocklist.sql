-- Moderator notes on users and the phone blocklist (batch-4, admin sanctions).

-- ---------------------------------------------------------------------------------------------
-- Notes: internal, visible on /admin/users/[id] with author and time. Written by moderators; the
-- author deletes their own, an admin may delete any.
create table public.user_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid references auth.users (id) on delete set null,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index user_notes_user_idx on public.user_notes (user_id, created_at desc);

alter table public.user_notes enable row level security;
revoke all on public.user_notes from anon, authenticated;

create function public.admin_add_note(p_admin uuid, p_user uuid, p_body text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  n uuid;
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  insert into public.user_notes (user_id, author_id, body)
  values (p_user, p_admin, btrim(p_body))
  returning id into n;
  perform public.log_moderation(p_admin, 'note.add', 'user', p_user, left(btrim(p_body), 200));
  return n;
end;
$$;

create function public.admin_delete_note(p_admin uuid, p_note uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  n public.user_notes;
begin
  perform public.assert_admin_role(p_admin, 'moderator');
  select * into n from public.user_notes where id = p_note;
  if n.id is null then
    raise exception 'Note not found' using errcode = 'no_data_found';
  end if;
  if n.author_id is distinct from p_admin then
    perform public.assert_admin_role(p_admin, 'admin');
  end if;
  delete from public.user_notes where id = p_note;
  perform public.log_moderation(p_admin, 'note.delete', 'user', n.user_id, left(n.body, 200));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Phone blocklist: numbers that can never create an account again (E.164, "+60123456789").
create table public.phone_blocklist (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  reason     text check (char_length(reason) <= 500),
  user_id    uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.phone_blocklist enable row level security;
revoke all on public.phone_blocklist from anon, authenticated;

-- Any phone format → E.164 ("+" and digits), or null when there are no digits.
create function public.phone_e164(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif('+' || regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '+');
$$;

-- SECURITY DEFINER: the auth hook runs as supabase_auth_admin, which can't read the table.
create function public.is_phone_blocked(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.phone_blocklist where phone = public.phone_e164(p_phone));
$$;

revoke execute on function public.is_phone_blocked(text) from public, anon, authenticated;
grant execute on function public.is_phone_blocked(text) to supabase_auth_admin, service_role;
grant execute on function public.phone_e164(text) to supabase_auth_admin;

-- Auth hook, copied from 20261008000014 (newest definition): Malaysia-only first, then the
-- blocklist. Test numbers of supabase/config.toml are Malaysian and not blocked, so they pass.
create or replace function public.hook_before_user_created(event jsonb)
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
  if public.is_phone_blocked(event -> 'user' ->> 'phone') then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'This phone number cannot be used for Vibely'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- Blocks a number. With p_user (and no p_phone) the user's own number is blocked; the number never
-- leaves the database. Returns the blocklist row id.
create function public.admin_block_phone(p_admin uuid, p_phone text, p_user uuid default null, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e164 text;
  row_id uuid;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  e164 := public.phone_e164(coalesce(nullif(btrim(p_phone), ''),
    (select phone from auth.users where id = p_user)));
  if e164 is null or e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Invalid phone number' using errcode = 'check_violation';
  end if;
  insert into public.phone_blocklist (phone, reason, user_id, created_by)
  values (e164, nullif(btrim(p_reason), ''), p_user, p_admin)
  on conflict (phone) do update set reason = coalesce(excluded.reason, public.phone_blocklist.reason)
  returning id into row_id;
  perform public.log_moderation(p_admin, 'phone.block', case when p_user is null then 'phone' else 'user' end,
    coalesce(p_user, row_id), p_reason);
  return row_id;
end;
$$;

create function public.admin_unblock_phone(p_admin uuid, p_id uuid, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  b public.phone_blocklist;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  delete from public.phone_blocklist where id = p_id returning * into b;
  if b.id is null then
    raise exception 'Not on the blocklist' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, 'phone.unblock', case when b.user_id is null then 'phone' else 'user' end,
    coalesce(b.user_id, b.id), p_reason);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_add_note(uuid, uuid, text)',
    'admin_delete_note(uuid, uuid)',
    'admin_block_phone(uuid, text, uuid, text)',
    'admin_unblock_phone(uuid, uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
