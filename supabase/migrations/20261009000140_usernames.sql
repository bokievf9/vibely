-- Unique usernames (@handle) and search by username.
--
-- Storage: plain `text`, always lowercase (enforced by the format CHECK, normalised by the trigger
-- below). Equivalent to citext for our purposes (case-insensitive uniqueness, because nothing
-- uppercase can be stored), without depending on an extension the test database (PGlite) and the
-- type generator do not support.
--
-- Rules: 3-20 chars of [a-z0-9_.], no leading/trailing dot, no consecutive dots, not reserved.
-- Every profile always has one: inserts without a username (onboarding without the field, fake
-- seed, old clients) get one generated from display_name; existing rows are backfilled here.
--
-- Writes: clients may choose one when the profile is created (insert grant). After that it only
-- changes through set_username(), which enforces a 30-day cooldown. The first change after
-- creation is free (username_changed_at is null until the user changes it).
--
-- Search: search_profiles_by_username() returns minimal public cards of verified, active,
-- discoverable profiles that did not turn off `searchable_by_username`, never the caller, never
-- anyone blocked in either direction.

alter table public.profiles
  add column username text,
  add column username_changed_at timestamptz,
  add column searchable_by_username boolean not null default true;

-- ---------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------

-- Null when `u` (already lowercase) is acceptable, otherwise the error code.
create function public.username_error(u text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when u is null
      or u !~ '^[a-z0-9_.]{3,20}$'
      or u ~ '^\.' or u ~ '\.$' or u ~ '\.\.'
      then 'username_invalid'
    when u = any (array[
        'admin', 'administrator', 'root', 'system', 'sysadmin', 'superuser',
        'vibely', 'vibelydate', 'official', 'staff', 'team', 'support', 'help', 'helpdesk',
        'moderator', 'moderators', 'mod', 'mods', 'security', 'safety', 'abuse', 'report',
        'reports', 'privacy', 'terms', 'legal', 'contact', 'info', 'news', 'noreply', 'no_reply',
        'null', 'undefined', 'nan', 'none', 'anonymous', 'anon', 'unknown', 'deleted', 'user',
        'users', 'me', 'you', 'everyone', 'all', 'here', 'settings', 'profile', 'profiles',
        'account', 'login', 'logout', 'signin', 'signup', 'register', 'onboarding', 'search',
        'discover', 'swipe', 'feed', 'chat', 'chats', 'likes', 'random', 'randomizer', 'api',
        'www', 'mail', 'email', 'test', 'bot', 'owner', 'billing', 'payment', 'payments'
      ])
      or u ~ '^vibely'
      or u ~ '^(admin|moderator|support|official)[._0-9]*$'
      then 'username_reserved'
  end;
$$;

-- Lowercase, trimmed, without a leading "@".
create function public.normalize_username(u text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(btrim(coalesce(u, ''))), '^@+', '');
$$;

-- Allowed-character base derived from a display name: Cyrillic (Russian/Uzbek) is transliterated,
-- Latin accents dropped, spaces and hyphens become dots, everything else is removed.
create function public.username_base(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text := lower(coalesce(p_name, ''));
  pair text[];
begin
  foreach pair slice 1 in array array[
    ['ж', 'zh'], ['х', 'kh'], ['ц', 'ts'], ['ч', 'ch'], ['ш', 'sh'], ['щ', 'sch'],
    ['ю', 'yu'], ['я', 'ya'], ['ß', 'ss'], ['æ', 'ae'], ['œ', 'oe']
  ] loop
    s := replace(s, pair[1], pair[2]);
  end loop;
  s := translate(s, 'абвгдеёзийклмнопрстуфыэўқғҳ', 'abvgdeeziyklmnoprstufyeoqgh');
  s := translate(s, 'àáâãäåāçèéêëēìíîïīñòóôõöøōùúûüūýÿ', 'aaaaaaaceeeeeiiiiinooooooouuuuuyy');
  s := regexp_replace(s, '[[:space:]-]+', '.', 'g');
  s := regexp_replace(s, '[^a-z0-9_.]', '', 'g');
  s := regexp_replace(s, '\.{2,}', '.', 'g');
  s := btrim(s, '.');
  s := btrim(left(s, 14), '.');
  if char_length(s) < 3 or public.username_error(s) is not null then
    s := 'user';
  end if;
  return s;
end;
$$;

-- A free username derived from p_name: the base itself, else base + a random number.
-- Definer: must see every profile's username, not only the ones RLS shows the caller.
create function public.generate_username(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  base text := public.username_base(p_name);
  candidate text := base;
  i int := 0;
begin
  loop
    if public.username_error(candidate) is null
       and not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
    i := i + 1;
    -- 2 digits for the first tries, then 4, then 6 (base is at most 14 chars: fits in 20).
    candidate := base || (
      case when i <= 10 then 10 + floor(random() * 90)
           when i <= 30 then 1000 + floor(random() * 9000)
           else 100000 + floor(random() * 900000) end
    )::int::text;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Backfill, constraints, trigger
-- ---------------------------------------------------------------------------------------------

-- Backfill without bumping updated_at (the username did not change anything the user did).
alter table public.profiles disable trigger profiles_set_updated_at;
do $$
declare
  r record;
begin
  for r in select id, display_name from public.profiles where username is null order by created_at, id
  loop
    update public.profiles set username = public.generate_username(r.display_name) where id = r.id;
  end loop;
end;
$$;
alter table public.profiles enable trigger profiles_set_updated_at;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_key unique (username),
  add constraint profiles_username_format check (
    username ~ '^[a-z0-9_.]{3,20}$' and username !~ '^\.' and username !~ '\.$'
    and username !~ '\.\.'
  );

-- Prefix search (LIKE 'abc%') uses this index regardless of the database collation.
create index profiles_username_pattern_idx on public.profiles (username text_pattern_ops);

-- Normalises and validates on every write; generates one on insert when none is given.
-- Raises SQLSTATE 22023 with the error code as message (username_invalid / username_reserved);
-- a taken username fails on the unique constraint (23505, profiles_username_key).
create function public.profiles_username()
returns trigger
language plpgsql
-- Definer: generate_username() is not executable by clients.
security definer
set search_path = ''
as $$
declare
  err text;
begin
  if tg_op = 'INSERT' and nullif(btrim(coalesce(new.username, '')), '') is null then
    new.username := public.generate_username(new.display_name);
    return new;
  end if;
  new.username := public.normalize_username(new.username);
  if tg_op = 'UPDATE' and new.username = old.username then
    return new;
  end if;
  err := public.username_error(new.username);
  if err is not null then
    raise exception '%', err using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_username
  before insert or update of username on public.profiles
  for each row execute function public.profiles_username();

-- Same column-grant pattern as 20261008000004: readable by viewers (RLS decides which rows).
-- username: chosen at insert only, then set_username(). username_changed_at: no client access
-- (other users must not learn when someone renamed); the owner reads it via my_username().
grant select (username, searchable_by_username) on public.profiles to authenticated;
grant insert (username) on public.profiles to authenticated;
grant update (searchable_by_username) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- Availability check for the onboarding/settings field (also usable before the profile exists).
-- Returns 'ok', 'current' (already the caller's), 'invalid', 'reserved' or 'taken'.
create function public.username_status(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  u text := public.normalize_username(p_username);
  owner uuid;
  err text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  err := public.username_error(u);
  if err is not null then
    return replace(err, 'username_', '');
  end if;
  select id into owner from public.profiles where username = u;
  if owner is null then
    return 'ok';
  end if;
  return case when owner = (select auth.uid()) then 'current' else 'taken' end;
end;
$$;

-- Suggestion for the onboarding field: a free username derived from the entered name.
create function public.suggest_username(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  return public.generate_username(left(coalesce(p_name, ''), 40));
end;
$$;

-- The caller's username settings (Settings screen).
create function public.my_username()
returns table (
  username             text,
  changed_at           timestamptz,
  next_change_at       timestamptz,
  searchable           boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.username, p.username_changed_at,
    case when p.username_changed_at > now() - interval '30 days'
         then p.username_changed_at + interval '30 days' end,
    p.searchable_by_username
  from public.profiles p
  where p.id = (select auth.uid());
$$;

-- Changes the caller's username. Errors (message = code):
--   username_invalid / username_reserved (22023), username_taken (23505),
--   username_cooldown (P0430: changed less than 30 days ago), profile_required (42501).
-- Returns the stored (normalised) username. Setting the current one again is a no-op.
create function public.set_username(p_username text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  me public.profiles;
  u text := public.normalize_username(p_username);
  err text := public.username_error(public.normalize_username(p_username));
begin
  select * into me from public.profiles where id = uid for update;
  if me.id is null then
    raise exception 'profile_required' using errcode = 'insufficient_privilege';
  end if;
  if err is not null then
    raise exception '%', err using errcode = '22023';
  end if;
  if u = me.username then
    return u;
  end if;
  if me.username_changed_at > now() - interval '30 days' then
    raise exception 'username_cooldown' using errcode = 'P0430';
  end if;
  if exists (select 1 from public.profiles where username = u) then
    raise exception 'username_taken' using errcode = '23505';
  end if;

  begin
    update public.profiles set username = u, username_changed_at = now() where id = uid;
  exception when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
  end;
  return u;
end;
$$;

-- Search by username (prefix; substring from 3 chars) and display name (prefix). At least 2
-- characters. Only verified, active, discoverable, searchable profiles; never the caller, never a
-- blocked pair. Returns the same minimal card fields as other people-lists (no location, no
-- birth date): age, city and the first photo (path + size, signed by the server).
create function public.search_profiles_by_username(q text, lim int default 20)
returns table (
  id           uuid,
  username     text,
  display_name text,
  age          int,
  city         text,
  photo        jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  term text := left(public.normalize_username(q), 40);
  uterm text;
  ulike text;
  nlike text;
begin
  if not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if char_length(term) < 2 then
    return;
  end if;
  lim := least(50, greatest(1, coalesce(lim, 20)));
  uterm := regexp_replace(term, '[^a-z0-9_.]', '', 'g');
  -- LIKE patterns with the wildcards of the input escaped (backslash is LIKE's default escape).
  ulike := replace(uterm, '_', '\_');
  nlike := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_');

  return query
  select
    p.id,
    p.username,
    p.display_name,
    public.age_in_years(p.birth_date),
    p.city,
    (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
     from public.profile_photos ph
     where ph.profile_id = p.id
     order by ph.position
     limit 1)
  from public.profiles p
  where p.id <> me
    and p.verification_status = 'approved'
    and p.is_active
    and p.banned_at is null
    and p.discoverable
    and p.searchable_by_username
    and (
      (char_length(uterm) >= 2 and p.username like ulike || '%')
      or (char_length(uterm) >= 3 and p.username like '%' || ulike || '%')
      or lower(p.display_name) like nlike || '%'
    )
    and not public.is_blocked_between(me, p.id)
  order by
    p.username = uterm desc,
    (char_length(uterm) >= 2 and p.username like ulike || '%') desc,
    p.last_active_at desc
  limit lim;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'username_status(text)',
    'suggest_username(text)',
    'my_username()',
    'set_username(text)',
    'search_profiles_by_username(text, int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  foreach fn in array array[
    'username_error(text)', 'normalize_username(text)', 'username_base(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
  foreach fn in array array['generate_username(text)', 'profiles_username()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Expose the username where names are already shown
-- ---------------------------------------------------------------------------------------------

-- Feed: same definitions as 20261008000100_feed_identity.sql plus author_username (appended, so
-- CREATE OR REPLACE keeps every existing column). Like author_name it is only set for "As me"
-- rows the viewer may see; anonymous rows NEVER carry it.
create or replace view public.feed_posts as
select
  p.id,
  p.body,
  p.likes_count,
  p.comments_count,
  p.created_at,
  p.author_id = (select auth.uid()) as is_mine,
  exists (
    select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())
  ) as is_liked_by_me,
  a.visible as is_named,
  case when a.visible then p.author_id end as author_id,
  case when a.visible then pr.display_name end as author_name,
  case when a.visible then public.age_in_years(pr.birth_date) end as author_age,
  case when a.visible then pr.verification_status = 'approved' end as author_verified,
  case when a.visible then ph.storage_path end as author_photo_path,
  case when not a.visible then ps.v[1] end as anon_adj,
  case when not a.visible then ps.v[2] end as anon_noun,
  case when not a.visible then ps.v[3] end as anon_color,
  -- Only the match is exposed, never the author's city.
  coalesce(nullif(lower(btrim(pr.city)), '') = public.feed_viewer_city(), false) as same_city,
  p.likes_count + p.comments_count as engagement,
  case when a.visible then pr.username end as author_username
from public.posts p
join public.profiles pr on pr.id = p.author_id
cross join lateral (
  select p.is_named and public.can_view_profile(p.author_id) as visible
) a
cross join lateral (select public.feed_pseudonym(p.id, 0) as v) ps
left join lateral (
  select f.storage_path from public.profile_photos f
  where f.profile_id = p.author_id and a.visible
  order by f.position
  limit 1
) ph on true
where not p.is_hidden and public.is_verified();

create or replace view public.post_comments as
select
  c.id,
  c.post_id,
  c.body,
  -- A named comment hides its alias: otherwise it would unmask the same person's anonymous
  -- comments in the thread. It is marked as the OP's only when the post itself shows the author.
  case when not a.visible then c.alias_no end as alias_no,
  c.alias_no = 0 and (not a.visible or (p.is_named and public.can_view_profile(p.author_id))) as is_op,
  c.author_id = (select auth.uid()) as is_mine,
  c.created_at,
  a.visible as is_named,
  case when a.visible then c.author_id end as author_id,
  case when a.visible then pr.display_name end as author_name,
  case when a.visible then public.age_in_years(pr.birth_date) end as author_age,
  case when a.visible then pr.verification_status = 'approved' end as author_verified,
  case when a.visible then ph.storage_path end as author_photo_path,
  case when not a.visible then ps.v[1] end as anon_adj,
  case when not a.visible then ps.v[2] end as anon_noun,
  case when not a.visible then ps.v[3] end as anon_color,
  case when a.visible then pr.username end as author_username
from public.comments c
join public.posts p on p.id = c.post_id
join public.profiles pr on pr.id = c.author_id
cross join lateral (
  select c.is_named and public.can_view_profile(c.author_id) as visible
) a
cross join lateral (select public.feed_pseudonym(c.post_id, c.alias_no) as v) ps
left join lateral (
  select f.storage_path from public.profile_photos f
  where f.profile_id = c.author_id and a.visible
  order by f.position
  limit 1
) ph on true
where not c.is_hidden and not p.is_hidden and public.is_verified();

revoke all on public.feed_posts, public.post_comments from anon, authenticated;
grant select on public.feed_posts, public.post_comments to authenticated;

-- Admin users list: same as 20261008000016 plus `username` in the result and the search
-- (with or without a leading "@"). The return type changes, so drop and recreate.
drop function public.admin_find_users(uuid, text, int);

create function public.admin_find_users(p_admin uuid, p_query text default '', p_limit int default 50)
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
  perform public.assert_admin(p_admin);
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

revoke execute on function public.admin_find_users(uuid, text, int) from public, anon, authenticated;
grant execute on function public.admin_find_users(uuid, text, int) to service_role;
