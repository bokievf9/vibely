-- Matchmaker (introduce two of your matches to each other) and Incognito mode.
--
-- Incognito: profiles.is_incognito. "Only people you like can see you": the profile appears in
-- Discover only for people it has liked, and never in username search, crossed paths or
-- "Who liked you". Matches, chats, feed posts, blind dates and pausing are unaffected.
-- Functions copied from their newest definitions and extended with one clause each:
--   swipe_candidate_pool, incoming_like_ids, search_profiles_by_username  (20261009000151)
--   get_crossed_paths, compute_crossed_paths                               (20261009000200)
-- get_swipe_candidates (20261009000200) reads the pool, so it needs no copy.
--
-- Matchmaker: A introduces two of their OWN matches, B and C.
--   * create_referral(b, c, note): A has active matches with both, no blocks among the three,
--     B and C are not matched yet, the same pair was not introduced in the last 90 days, at most
--     5 introductions per day, nobody banned or muted. The introduction is delivered as a
--     "referral" message in the A-B chat (messages.kind = 'referral', payload = the referral id
--     only; the card itself is read through get_referral_card).
--   * get_referral_card(id): B (and C, once B accepted) see the other person's first photo, name
--     and age plus A's note. A sees both names. Declines are never shown to anyone.
--   * decide_referral(id, interested): B first; when B is interested the same card is posted in
--     the A-C chat. When C is interested too the match B-C is created through the regular path
--     (ensure_match, source 'matchmaker'), A's note is pinned as the first message of the new
--     chat (kind 'system', sender A), and A gets 7 VIP days (at most once per 7 days).
--     "No thanks" closes the introduction silently. A block among the three cancels it.
--   * Referrals are deleted after 90 days (retention protocol).

-- =============================================================================================
-- Incognito
-- =============================================================================================
alter table public.profiles add column is_incognito boolean not null default false;

grant select (is_incognito) on public.profiles to authenticated;
grant update (is_incognito) on public.profiles to authenticated;

-- Discover pool: copied from 20261009000151; an incognito profile is shown only to people it liked.
create or replace function public.swipe_candidate_pool(
  p_me      uuid,
  p_genders public.gender[],
  p_min_age int,
  p_max_age int,
  p_max_km  int
)
returns table (id uuid, second_chance boolean)
language sql
stable
set search_path = ''
as $$
  select p.id, s.swiper_id is not null
  from public.profiles me
  join public.profiles p on p.id <> me.id
  left join public.swipes s on s.swiper_id = me.id and s.swiped_id = p.id
  where me.id = p_me
    and p.verification_status = 'approved'
    and p.is_active
    and p.discoverable
    and not p.shadow_banned
    and p.gender = any (p_genders)
    and me.gender = any (p.interested_in)
    and public.age_in_years(p.birth_date) between p_min_age and p_max_age
    and (me.location is null or p.location is null
         or extensions.st_dwithin(me.location, p.location, p_max_km * 1000))
    and (s.swiper_id is null
         or (s.direction = 'pass' and s.created_at < now() - interval '14 days'))
    and not public.is_blocked_between(me.id, p.id)
    and (
      not p.is_incognito
      or exists (
        select 1 from public.swipes l
        where l.swiper_id = p.id and l.swiped_id = me.id and l.direction = 'like'
      )
    );
$$;

-- "Who liked you": copied from 20261009000151; likes from incognito people stay hidden.
create or replace function public.incoming_like_ids()
returns table (id uuid, liked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;

  return query
  select s.swiper_id, s.created_at
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  where s.swiped_id = me
    and s.direction = 'like'
    and p.verification_status = 'approved'
    and p.is_active
    and p.discoverable
    and not p.shadow_banned
    and not p.is_incognito
    and not exists (
      select 1 from public.swipes mine where mine.swiper_id = me and mine.swiped_id = s.swiper_id
    )
    and not exists (
      select 1 from public.matches m
      where m.user_a = least(me, s.swiper_id) and m.user_b = greatest(me, s.swiper_id)
    )
    and not public.is_blocked_between(me, s.swiper_id);
end;
$$;

-- People search: copied from 20261009000151; incognito people are not searchable.
create or replace function public.search_profiles_by_username(q text, lim int default 20)
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
    and not p.shadow_banned
    and p.discoverable
    and p.searchable_by_username
    and not p.is_incognito
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

-- Crossed paths: copied from 20261009000200; incognito people are never shown.
create or replace function public.get_crossed_paths()
returns table (
  id           uuid,
  display_name text,
  age          int,
  photo        jsonb,
  crossings    int,
  is_today     boolean,
  area         text,
  city         text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  select * into me from public.profiles where profiles.id = (select auth.uid());
  if me.id is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.crossed_paths_settings s where s.user_id = me.id) then
    return;
  end if;

  return query
  select distinct on (p.id)
    p.id,
    p.display_name,
    public.age_in_years(p.birth_date),
    (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
     from public.profile_photos ph where ph.profile_id = p.id order by ph.position limit 1),
    cp.crossings,
    cp.day = today,
    cp.area,
    cp.city
  from public.crossed_paths cp
  join public.profiles p
    on p.id = case when cp.user_a = me.id then cp.user_b else cp.user_a end
  join public.crossed_paths_settings s on s.user_id = p.id
  where (cp.user_a = me.id or cp.user_b = me.id)
    and cp.day between today - 1 and today
    and p.verification_status = 'approved'
    and p.is_active
    and p.banned_at is null
    and p.discoverable
    and not p.shadow_banned
    and not p.is_incognito
    and p.gender = any (me.interested_in)
    and me.gender = any (p.interested_in)
    and not public.is_blocked_between(me.id, p.id)
    and not exists (
      select 1 from public.crossed_path_hides h where h.user_id = me.id and h.hidden_id = p.id
    )
  order by p.id, cp.day desc;
end;
$$;

-- Copied from 20261009000200; incognito people are not eligible, so no encounter is ever stored.
create or replace function public.compute_crossed_paths()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  perform public.purge_crossed_paths();

  with eligible as (
    select p.id, p.gender, p.interested_in
    from public.crossed_paths_settings s
    join public.profiles p on p.id = s.user_id
    where p.verification_status = 'approved'
      and p.is_active
      and p.banned_at is null
      and p.discoverable
      and not p.shadow_banned
      and not p.is_incognito
  ), stats as (
    select l.user_id, l.cell, count(*) as hits, bool_or(l.is_night) as night,
           sum(count(*)) over (partition by l.user_id) as total
    from public.user_location_pings l
    join eligible e on e.id = l.user_id
    group by l.user_id, l.cell
  ), usable as (
    -- Not home (no night ping there), not dominant (at least 3 hours and more than half of all).
    select user_id, cell from stats
    where not night and not (hits >= 3 and hits * 2 > total)
  ), events as (
    select l.user_id, l.cell, l.seen_hour, l.day
    from public.user_location_pings l
    join usable u on u.user_id = l.user_id and u.cell = l.cell
    where l.seen_hour >= now() - interval '24 hours'
      and l.seen_hour + interval '1 hour' <= now() - interval '3 hours'
  ), together as (
    select a.user_id as user_a, b.user_id as user_b, a.cell, a.seen_hour, a.day
    from events a
    join events b on b.cell = a.cell and b.seen_hour = a.seen_hour and a.user_id < b.user_id
    join eligible ea on ea.id = a.user_id
    join eligible eb on eb.id = b.user_id
    where ea.gender = any (eb.interested_in)
      and eb.gender = any (ea.interested_in)
      and not public.is_blocked_between(a.user_id, b.user_id)
  ), pairs as (
    select user_a, user_b from together
    group by user_a, user_b
    having count(distinct seen_hour) >= 2 or count(distinct cell) >= 2
  ), per_day as (
    select t.user_a, t.user_b, t.day, count(*)::int as crossings,
           mode() within group (order by t.cell) as cell
    from together t
    join pairs using (user_a, user_b)
    group by t.user_a, t.user_b, t.day
  )
  insert into public.crossed_paths as cp (user_a, user_b, day, crossings, area, city)
  select d.user_a, d.user_b, d.day, d.crossings, a.area, a.city
  from per_day d
  cross join lateral public.area_for_cell(d.cell) a
  on conflict (user_a, user_b, day) do update
    set crossings = greatest(cp.crossings, excluded.crossings),
        area = excluded.area,
        city = excluded.city,
        computed_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- =============================================================================================
-- Matchmaker
-- =============================================================================================

-- VIP days are the matchmaker's reward. The column is also created by the promo branch
-- (20261009000230, with is_vip()); whichever lands first wins and the other is a no-op.
alter table public.profiles add column if not exists vip_until timestamptz;

alter type public.match_source add value if not exists 'matchmaker';

alter table public.notification_prefs add column matchmaker boolean not null default true;
grant insert (matchmaker), update (matchmaker) on public.notification_prefs to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Message kinds. Clients still insert plain text/media rows; `kind` and `payload` are not
-- insertable by clients (column grants), so cards and system notes come only from the RPCs.
--   kind     'text' (default) | 'referral' (introduction card) | 'system' (pinned note)
--   payload  {"referral_id": <uuid>} for both non-text kinds, null for text
-- ---------------------------------------------------------------------------------------------
alter table public.messages
  add column kind    text not null default 'text',
  add column payload jsonb;

alter table public.messages
  add constraint messages_kind check (kind in ('text', 'referral', 'system')),
  add constraint messages_payload check (
    case
      when kind = 'text' then payload is null
      else payload is not null and jsonb_typeof(payload -> 'referral_id') = 'string'
    end
  );

-- A referral card has neither text nor media.
alter table public.messages drop constraint messages_content;
alter table public.messages
  add constraint messages_content check (
    case
      when deleted_at is null then
        body is not null or media_path is not null or media_expired_at is not null
        or kind = 'referral'
      else body is null and media_path is null and image_path is null
    end
  );

-- Copied from 20261008000110. A system note is written by the matchmaker into a chat they are
-- not part of (only the RPC can set kind, see the column grants).
create or replace function public.messages_check_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Fail before the lookups below, so they can't be used to probe other matches.
  if new.kind <> 'system' and not exists (
    select 1 from public.matches where id = new.match_id and new.sender_id in (user_a, user_b)
  ) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if new.reply_to is not null and not exists (
    select 1 from public.messages where id = new.reply_to and match_id = new.match_id
  ) then
    raise exception 'reply_to must be a message of the same match' using errcode = '23514';
  end if;
  -- Clients from before this migration send a photo as image_path only.
  if new.media_path is null and new.image_path is not null then
    new.media_kind := 'image';
    new.media_path := new.image_path;
    new.media_mime := 'image/webp';
  end if;
  new.image_path := case when new.media_kind = 'image' then new.media_path end;
  if new.media_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'chat-media' and name = new.media_path
  ) then
    raise exception 'media not uploaded' using errcode = '23514';
  end if;
  new.edited_at := null;
  new.deleted_at := null;
  new.media_expired_at := null;
  return new;
end;
$$;

-- Copied from 20261008000060 (its only definition): only plain messages can be edited. Deleting
-- (20261009000162) is unchanged: a card sent by the matchmaker may be deleted like any own
-- message; a system note is written on the matchmaker's behalf into a chat they are not part of,
-- so nobody can delete it.
create or replace function public.edit_message(p_id uuid, p_body text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  body_trim text := nullif(btrim(p_body), '');
  edited    timestamptz;
begin
  if body_trim is null or char_length(body_trim) > 2000 then
    raise exception 'invalid body' using errcode = '22023';
  end if;
  update public.messages
  set body = body_trim, edited_at = now()
  where id = p_id
    and sender_id = (select auth.uid())
    and kind = 'text'
    and deleted_at is null
    and created_at > now() - interval '15 minutes'
    and public.is_verified()
    and public.is_match_participant(match_id)
  returning edited_at into edited;
  if edited is null then
    raise exception 'message not editable' using errcode = '42501';
  end if;
  return edited;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Referrals. Not readable or writable by clients: everything goes through the RPCs below.
-- ---------------------------------------------------------------------------------------------
create table public.matchmaker_referrals (
  id            uuid primary key default gen_random_uuid(),
  matchmaker_id uuid not null references public.profiles (id) on delete cascade,
  user_b        uuid not null references public.profiles (id) on delete cascade,
  user_c        uuid not null references public.profiles (id) on delete cascade,
  note          text check (note is null or char_length(note) between 1 and 200),
  status        text not null default 'pending'
                check (status in ('pending', 'b_declined', 'c_declined', 'matched', 'cancelled')),
  decision_b    boolean,
  decision_c    boolean,
  match_id      uuid references public.matches (id) on delete set null,
  rewarded_at   timestamptz,
  created_at    timestamptz not null default now(),
  check (user_b <> user_c and matchmaker_id <> user_b and matchmaker_id <> user_c)
);

create index matchmaker_referrals_matchmaker_idx
  on public.matchmaker_referrals (matchmaker_id, created_at desc);
create index matchmaker_referrals_pair_idx
  on public.matchmaker_referrals (least(user_b, user_c), greatest(user_b, user_c), created_at desc);
create index matchmaker_referrals_created_idx on public.matchmaker_referrals (created_at);

alter table public.matchmaker_referrals enable row level security;
revoke all on public.matchmaker_referrals from anon, authenticated;

-- First photo, name and age of a person on a card. Internal.
create function public.matchmaker_person(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.display_name,
    'age', public.age_in_years(p.birth_date),
    'photo', (
      select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
      from public.profile_photos ph
      where ph.profile_id = p.id
      order by ph.position
      limit 1
    )
  )
  from public.profiles p
  where p.id = p_user;
$$;

revoke execute on function public.matchmaker_person(uuid) from public, anon, authenticated;

-- A introduces B to C. Returns {id, match_id} (the A-B chat that received the card).
-- SQLSTATE: VM001 same pair introduced within 90 days, VM002 not possible (not your matches,
-- blocked, already matched, banned or muted), P0429 daily limit, VS001 the caller is muted.
create function public.create_referral(p_b uuid, p_c uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        uuid := (select auth.uid());
  note_trim text := nullif(btrim(coalesce(p_note, '')), '');
  ab        uuid;
  ac        uuid;
  rid       uuid;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.profiles where id = me and muted_until > now()) then
    raise exception 'muted' using errcode = 'VS001';
  end if;
  if p_b is null or p_c is null or p_b = p_c or me in (p_b, p_c) then
    raise exception 'Invalid users' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(note_trim) > 200 then
    raise exception 'Note too long' using errcode = '22023';
  end if;

  select id into ab from public.matches where user_a = least(me, p_b) and user_b = greatest(me, p_b);
  select id into ac from public.matches where user_a = least(me, p_c) and user_b = greatest(me, p_c);
  if ab is null or ac is null then
    raise exception 'Not your matches' using errcode = 'VM002';
  end if;
  if (
      select count(*) from public.profiles p
      where p.id in (p_b, p_c)
        and p.verification_status = 'approved'
        and p.is_active
        and p.banned_at is null
        and (p.muted_until is null or p.muted_until <= now())
    ) <> 2
    or public.is_blocked_between(me, p_b)
    or public.is_blocked_between(me, p_c)
    or public.is_blocked_between(p_b, p_c)
    or exists (
      select 1 from public.matches
      where user_a = least(p_b, p_c) and user_b = greatest(p_b, p_c)
    )
  then
    raise exception 'Not available' using errcode = 'VM002';
  end if;
  if exists (
    select 1 from public.matchmaker_referrals r
    where least(r.user_b, r.user_c) = least(p_b, p_c)
      and greatest(r.user_b, r.user_c) = greatest(p_b, p_c)
      and r.created_at > now() - interval '90 days'
  ) then
    raise exception 'Already introduced' using errcode = 'VM001';
  end if;
  if (
    select count(*) from public.matchmaker_referrals r
    where r.matchmaker_id = me and r.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'Rate limit exceeded: at most 5 introductions per day' using errcode = 'P0429';
  end if;

  insert into public.matchmaker_referrals (matchmaker_id, user_b, user_c, note)
  values (me, p_b, p_c, note_trim)
  returning id into rid;

  -- The card in the A-B chat. The regular message triggers apply to A (rate limit, mute).
  insert into public.messages (match_id, sender_id, kind, payload)
  values (ab, me, 'referral', jsonb_build_object('referral_id', rid));

  return jsonb_build_object('id', rid, 'match_id', ab);
end;
$$;

-- The card as seen by the caller, or null when the caller may not see it (C before B accepted,
-- strangers, deleted referrals). Declines are reported as 'closed' to the one who declined and
-- as still open/pending to everyone else.
--   {id, role: matchmaker|b|c, state: open|interested|matched|closed|pending, note,
--    match_id (B/C, when matched), matchmaker_name, person (B/C) | b + c (matchmaker)}
create function public.get_referral_card(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  r        public.matchmaker_referrals;
  v_role   text;
  v_state  text;
  mm_name  text;
begin
  if me is null then
    return null;
  end if;
  select * into r from public.matchmaker_referrals where id = p_id;
  if r.id is null then
    return null;
  end if;
  v_role := case
    when me = r.matchmaker_id then 'matchmaker'
    when me = r.user_b then 'b'
    when me = r.user_c and coalesce(r.decision_b, false) then 'c'
  end;
  if v_role is null then
    return null;
  end if;
  v_state := case
    when r.status = 'matched' then 'matched'
    when r.status = 'cancelled' then 'closed'
    when v_role = 'b' then
      case when r.status = 'b_declined' then 'closed'
           when coalesce(r.decision_b, false) then 'interested'
           else 'open' end
    when v_role = 'c' then
      case when r.status = 'c_declined' then 'closed'
           when coalesce(r.decision_c, false) then 'interested'
           else 'open' end
    else 'pending'
  end;
  select display_name into mm_name from public.profiles where id = r.matchmaker_id;
  return jsonb_build_object(
    'id', r.id,
    'role', v_role,
    'state', v_state,
    'note', r.note,
    'match_id', case when v_state = 'matched' and v_role <> 'matchmaker' then r.match_id end,
    'matchmaker_name', mm_name,
    'person', case
      when r.status = 'cancelled' then null
      when v_role = 'b' then public.matchmaker_person(r.user_c)
      when v_role = 'c' then public.matchmaker_person(r.user_b)
    end,
    'b', case when v_role = 'matchmaker' then public.matchmaker_person(r.user_b) end,
    'c', case when v_role = 'matchmaker' then public.matchmaker_person(r.user_c) end
  );
end;
$$;

-- Interested / No thanks. Returns {state, match_id, just_matched, notify}: `notify` carries what
-- the server needs for pushes (ids and names only), never the decision of the other person.
create function public.decide_referral(p_id uuid, p_interested boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  r        public.matchmaker_referrals;
  side     text;
  ac       uuid;
  v_match  uuid;
  reward   boolean := false;
  mm_name  text;
  b_name   text;
  c_name   text;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.matchmaker_referrals where id = p_id for update;
  if r.id is null then
    raise exception 'Not found' using errcode = 'VM003';
  end if;
  side := case when me = r.user_b then 'b' when me = r.user_c then 'c' end;
  if side is null or (side = 'c' and not coalesce(r.decision_b, false)) then
    raise exception 'Not available' using errcode = 'VM002';
  end if;
  if r.status <> 'pending' then
    return jsonb_build_object(
      'state', case when r.status = 'matched' then 'matched' else 'closed' end,
      'match_id', case when r.status = 'matched' then r.match_id end
    );
  end if;
  if (side = 'b' and r.decision_b is not null) or (side = 'c' and r.decision_c is not null) then
    raise exception 'Already decided' using errcode = 'VM002';
  end if;

  -- A block since the introduction cancels it (the trigger below covers the usual path).
  if public.is_blocked_between(r.matchmaker_id, r.user_b)
     or public.is_blocked_between(r.matchmaker_id, r.user_c)
     or public.is_blocked_between(r.user_b, r.user_c) then
    update public.matchmaker_referrals set status = 'cancelled' where id = r.id;
    return jsonb_build_object('state', 'closed');
  end if;

  if not coalesce(p_interested, false) then
    update public.matchmaker_referrals
    set status = side || '_declined',
        decision_b = case when side = 'b' then false else decision_b end,
        decision_c = case when side = 'c' then false else decision_c end
    where id = r.id;
    return jsonb_build_object('state', 'closed');
  end if;

  select display_name into mm_name from public.profiles where id = r.matchmaker_id;

  if side = 'b' then
    select id into ac from public.matches
    where user_a = least(r.matchmaker_id, r.user_c) and user_b = greatest(r.matchmaker_id, r.user_c);
    if ac is null then
      update public.matchmaker_referrals set status = 'cancelled' where id = r.id;
      return jsonb_build_object('state', 'closed');
    end if;
    update public.matchmaker_referrals set decision_b = true where id = r.id;
    -- C learns about the introduction only now: the card goes into the A-C chat. Written on
    -- A's behalf, so A's own message triggers (rate limit, mute) are skipped like the blind-date
    -- transcript copy.
    perform set_config('vibely.blind_copy', 'on', true);
    insert into public.messages (match_id, sender_id, kind, payload)
    values (ac, r.matchmaker_id, 'referral', jsonb_build_object('referral_id', r.id));
    perform set_config('vibely.blind_copy', '', true);
    return jsonb_build_object(
      'state', 'interested',
      'notify', jsonb_build_object('user_id', r.user_c, 'match_id', ac, 'matchmaker_name', mm_name)
    );
  end if;

  -- Both interested: the regular match path (the pair may have matched meanwhile: reused).
  v_match := public.ensure_match(r.user_b, r.user_c, 'matchmaker');
  if r.note is not null then
    perform set_config('vibely.blind_copy', 'on', true);
    insert into public.messages (match_id, sender_id, kind, payload, body, read_at)
    values (v_match, r.matchmaker_id, 'system', jsonb_build_object('referral_id', r.id), r.note, now());
    perform set_config('vibely.blind_copy', '', true);
  end if;
  reward := not exists (
    select 1 from public.matchmaker_referrals x
    where x.matchmaker_id = r.matchmaker_id and x.rewarded_at > now() - interval '7 days'
  );
  if reward then
    update public.profiles
    set vip_until = greatest(now(), coalesce(vip_until, now())) + interval '7 days'
    where id = r.matchmaker_id;
  end if;
  update public.matchmaker_referrals
  set decision_c = true, status = 'matched', match_id = v_match,
      rewarded_at = case when reward then now() end
  where id = r.id;
  select display_name into b_name from public.profiles where id = r.user_b;
  select display_name into c_name from public.profiles where id = r.user_c;
  return jsonb_build_object(
    'state', 'matched',
    'match_id', v_match,
    'just_matched', true,
    'notify', jsonb_build_object(
      'matchmaker_id', r.matchmaker_id, 'matchmaker_name', mm_name,
      'b_id', r.user_b, 'b_name', b_name,
      'c_id', r.user_c, 'c_name', c_name
    )
  );
end;
$$;

-- A block among the three cancels every pending introduction between them.
create function public.blocks_cancel_referrals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.matchmaker_referrals
  set status = 'cancelled'
  where status = 'pending'
    and new.blocker_id in (matchmaker_id, user_b, user_c)
    and new.blocked_id in (matchmaker_id, user_b, user_c);
  return null;
end;
$$;

revoke execute on function public.blocks_cancel_referrals() from public, anon, authenticated;

create trigger blocks_cancel_referrals
  after insert on public.blocks
  for each row execute function public.blocks_cancel_referrals();

-- Retention: introductions (and the note in them) are deleted after 90 days. Cards in chats
-- then read as "no longer available"; the pinned note in a matched chat is a message and follows
-- the chat retention rules.
create function public.purge_matchmaker_referrals()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from public.matchmaker_referrals where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'create_referral(uuid, uuid, text)',
    'get_referral_card(uuid)',
    'decide_referral(uuid, boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  revoke execute on function public.purge_matchmaker_referrals() from public, anon, authenticated;
  grant execute on function public.purge_matchmaker_referrals() to service_role;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-matchmaker-referrals', '52 3 * * *',
      'select public.purge_matchmaker_referrals()');
  end if;
end;
$$;
