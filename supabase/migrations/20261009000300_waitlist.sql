-- Early access waitlist (landing page, while SMS sign-up is closed).
--
--   * public.waitlist: one row per Malaysian mobile number (E.164, unique). Clients can neither
--     read nor write it: the only way in is join_waitlist(), the only way out the admin RPCs.
--   * join_waitlist(): security definer, callable by anon. Validates the number with
--     is_malaysian_mobile (20261008000014), requires consent (PDPA), is idempotent (a second
--     call with the same number changes nothing and answers exactly like the first, so the
--     function cannot be used to find out whether a number is on the list) and is rate limited
--     per number and globally (SQLSTATE P0429, like enforce_rate_limit).
--   * Rate-limit attempts store an md5 of the number, never the number, and are kept for 1 day.
--   * Admin RPCs (service role, called by /admin/waitlist after requireAdmin):
--       admin_waitlist_stats   viewer+  counts only
--       admin_waitlist_list    viewer+  masked numbers ("+60 •••• 4567")
--       admin_waitlist_export  admin+   full numbers, logged as export.waitlist
--       admin_waitlist_mark_invited admin+, logged as waitlist.invite (one row per entry)
--   * purge_waitlist(): numbers are deleted 90 days after the invite (Privacy Policy 5j),
--     called by the daily retention job.

create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique check (phone ~ '^\+601[0-9]{8,9}$'),
  city       text check (city is null or city ~ '^[a-z][a-z-]{1,39}$'),
  locale     text not null default 'en' check (locale in ('en', 'ms', 'ru')),
  source     text not null default 'landing' check (source ~ '^[a-z0-9_-]{1,32}$'),
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  invited_at timestamptz,
  invited_by uuid references auth.users (id) on delete set null
);

create index waitlist_created_idx on public.waitlist (created_at desc);
create index waitlist_pending_idx on public.waitlist (created_at) where invited_at is null;

create table public.waitlist_attempts (
  id         bigint generated always as identity primary key,
  phone_key  text not null,
  created_at timestamptz not null default now()
);

create index waitlist_attempts_recent_idx on public.waitlist_attempts (created_at desc);
create index waitlist_attempts_key_idx on public.waitlist_attempts (phone_key, created_at desc);

-- No policies: RLS on with nothing granted means no client reads or writes at all.
alter table public.waitlist enable row level security;
alter table public.waitlist_attempts enable row level security;
revoke all on public.waitlist, public.waitlist_attempts from anon, authenticated;

-- Cities offered by the landing form (src/features/waitlist/cities.ts). Anything else is refused.
create function public.waitlist_city_ok(p_city text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_city is null or p_city in (
    'kuala-lumpur', 'selangor', 'penang', 'johor-bahru', 'ipoh', 'melaka', 'seremban',
    'kota-kinabalu', 'kuching', 'kuantan', 'other'
  );
$$;

-- "+60 •••• 4567" (the panel's maskPhone, src/features/admin/mask.ts).
create function public.waitlist_mask(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '+60 •••• ' || right(p_phone, 4);
$$;

-- ---------------------------------------------------------------------------------------------
-- Public entry point. Accepts "+60 12-345 6789", "60123456789", "0123456789" or "123456789".
create function public.join_waitlist(
  p_phone   text,
  p_city    text default null,
  p_locale  text default 'en',
  p_source  text default 'landing',
  p_consent boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  city   text := nullif(btrim(lower(coalesce(p_city, ''))), '');
  e164   text;
  pkey   text;
begin
  if not coalesce(p_consent, false) then
    raise exception 'Consent required' using errcode = '22023', hint = 'consent';
  end if;

  -- Local formats: 012... -> 6012..., 12... -> 6012...
  if digits ~ '^01' then
    digits := '6' || digits;
  elsif digits ~ '^1' then
    digits := '60' || digits;
  end if;
  if not public.is_malaysian_mobile(digits) then
    raise exception 'Malaysian mobile number required' using errcode = '22023', hint = 'phone';
  end if;
  if not public.waitlist_city_ok(city) then
    raise exception 'Unknown city' using errcode = '22023', hint = 'city';
  end if;
  e164 := '+' || digits;
  pkey := md5('waitlist:' || e164);

  -- Global: 60 attempts a minute across everyone. Per number: 3 a minute.
  if (select count(*) from (
        select 1 from public.waitlist_attempts
        where created_at > now() - interval '1 minute' limit 60) r) >= 60 then
    raise exception 'Rate limit exceeded: waitlist is busy' using errcode = 'P0429';
  end if;
  if (select count(*) from (
        select 1 from public.waitlist_attempts
        where phone_key = pkey and created_at > now() - interval '1 minute' limit 3) r) >= 3 then
    raise exception 'Rate limit exceeded: at most 3 per minute' using errcode = 'P0429';
  end if;
  insert into public.waitlist_attempts (phone_key) values (pkey);

  insert into public.waitlist (phone, city, locale, source, consent_at)
  values (
    e164,
    city,
    case when p_locale in ('en', 'ms', 'ru') then p_locale else 'en' end,
    case when coalesce(p_source, '') ~ '^[a-z0-9_-]{1,32}$' then p_source else 'landing' end,
    now()
  )
  on conflict (phone) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Panel. Every function takes the acting member (p_admin) and re-checks the role.

create function public.admin_waitlist_stats(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  return jsonb_build_object(
    'total',    (select count(*) from public.waitlist),
    'pending',  (select count(*) from public.waitlist where invited_at is null),
    'invited',  (select count(*) from public.waitlist where invited_at is not null),
    'last_24h', (select count(*) from public.waitlist where created_at > now() - interval '24 hours'),
    'last_7d',  (select count(*) from public.waitlist where created_at > now() - interval '7 days'),
    'by_city',  coalesce((select jsonb_object_agg(k, n) from (
                  select coalesce(city, 'none') k, count(*) n from public.waitlist group by 1) c), '{}'),
    'by_locale', coalesce((select jsonb_object_agg(locale, n) from (
                  select locale, count(*) n from public.waitlist group by 1) l), '{}')
  );
end;
$$;

-- Masked numbers only. p_status: 'all' | 'pending' | 'invited'.
create function public.admin_waitlist_list(
  p_admin  uuid,
  p_status text default 'all',
  p_limit  int default 100,
  p_offset int default 0
)
returns table (
  id           uuid,
  phone_masked text,
  city         text,
  locale       text,
  source       text,
  created_at   timestamptz,
  invited_at   timestamptz,
  total        bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  return query
  select w.id, public.waitlist_mask(w.phone), w.city, w.locale, w.source, w.created_at,
    w.invited_at, count(*) over ()
  from public.waitlist w
  where coalesce(p_status, 'all') = 'all'
     or (p_status = 'pending' and w.invited_at is null)
     or (p_status = 'invited' and w.invited_at is not null)
  order by w.created_at desc
  limit least(500, greatest(1, p_limit))
  offset greatest(0, p_offset);
end;
$$;

-- Full numbers for the CSV (admin and owner). The export is logged before anything is read.
create function public.admin_waitlist_export(p_admin uuid, p_status text default 'pending')
returns table (
  id         uuid,
  phone      text,
  city       text,
  locale     text,
  source     text,
  consent_at timestamptz,
  created_at timestamptz,
  invited_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  select count(*) into n from public.waitlist w
  where coalesce(p_status, 'all') = 'all'
     or (p_status = 'pending' and w.invited_at is null)
     or (p_status = 'invited' and w.invited_at is not null);
  perform public.log_moderation(p_admin, 'export.waitlist', 'waitlist', p_admin,
    format('%s rows, status=%s', n, coalesce(p_status, 'all')));
  return query
  select w.id, w.phone, w.city, w.locale, w.source, w.consent_at, w.created_at, w.invited_at
  from public.waitlist w
  where coalesce(p_status, 'all') = 'all'
     or (p_status = 'pending' and w.invited_at is null)
     or (p_status = 'invited' and w.invited_at is not null)
  order by w.created_at;
end;
$$;

-- Marks entries as invited (after the SMS went out). Returns how many changed; logged per entry.
create function public.admin_waitlist_mark_invited(p_admin uuid, p_ids uuid[])
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  changed uuid[];
begin
  perform public.assert_admin_role(p_admin, 'admin');
  if coalesce(array_length(p_ids, 1), 0) > 500 then
    raise exception 'At most 500 entries at once' using errcode = '22023';
  end if;
  with u as (
    update public.waitlist set invited_at = now(), invited_by = p_admin
    where id = any(p_ids) and invited_at is null
    returning id
  )
  select coalesce(array_agg(id), '{}') into changed from u;
  insert into public.moderation_actions (admin_id, action, target_type, target_id, reason)
  select p_admin, 'waitlist.invite', 'waitlist', t, null from unnest(changed) t;
  return coalesce(array_length(changed, 1), 0);
end;
$$;

-- Retention: numbers go 90 days after the invite; rate-limit attempts after 1 day.
create function public.purge_waitlist()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from public.waitlist_attempts where created_at < now() - interval '1 day';
  delete from public.waitlist where invited_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'waitlist_city_ok(text)',
    'waitlist_mask(text)',
    'join_waitlist(text, text, text, text, boolean)',
    'admin_waitlist_stats(uuid)',
    'admin_waitlist_list(uuid, text, int, int)',
    'admin_waitlist_export(uuid, text)',
    'admin_waitlist_mark_invited(uuid, uuid[])',
    'purge_waitlist()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- The landing page is public: anyone may join (signed-in users never see the landing page,
-- but nothing stops them either).
grant execute on function public.join_waitlist(text, text, text, text, boolean) to anon, authenticated;
