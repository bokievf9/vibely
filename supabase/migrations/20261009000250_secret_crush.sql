-- Secret crush (outside Vibely). The inviter creates a single-use invite link and ticks
-- "I have a crush on this person"; the link is shared by the inviter themselves, so Vibely never
-- sees the invitee's phone number, email or name. When the invitee signs up through that link and
-- is verified, they see a one-time card ("The person who invited you has a crush on you") and
-- answer Yes or No. Yes creates a mutual match (both likes, like a swipe match) when both people
-- are verified and compatible both ways; No is never revealed to the inviter, who only ever sees
-- that the invite was used (profiles.referred_by, like a normal referral).
--
-- The reusable per-user code (referral_codes, 20261008000092) is untouched: a crush needs its own
-- single-use row, since the flag must apply to exactly one person.
--
-- Limits: one crush flag per invite row, one claim per invite (invitee_id), one crush invite per
-- invitee, at most 3 crush invites per inviter per 30 days, invites expire after 30 days. Nothing
-- in this table is readable by clients: the inviter never learns whether the card was shown or how
-- it was answered (except through the match itself).

create table public.referral_invites (
  id                uuid primary key default gen_random_uuid(),
  inviter_id        uuid not null references public.profiles (id) on delete cascade,
  code              text not null unique check (code ~ '^[a-z0-9]{8}$'),
  is_crush          boolean not null default false,
  invitee_id        uuid unique references public.profiles (id) on delete set null,
  claimed_at        timestamptz,
  -- null: not answered (or dismissed without an answer); true/false: the invitee's answer.
  crush_answer      boolean,
  crush_answered_at timestamptz,
  created_at        timestamptz not null default now(),
  check (crush_answer is null or is_crush),
  check (crush_answered_at is null or claimed_at is not null)
);

create index referral_invites_inviter_idx on public.referral_invites (inviter_id, created_at desc);

alter table public.referral_invites enable row level security;
revoke all on public.referral_invites from anon, authenticated;

-- Keeps invites compact: expired unclaimed invites are useless after the cookie's lifetime.
create function public.purge_referral_invites()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.referral_invites
  where invitee_id is null and created_at < now() - interval '30 days';
$$;

revoke execute on function public.purge_referral_invites() from public, anon, authenticated;

-- A new single-use invite code for the caller. With p_crush, the crush flag is stored on this
-- row only. Raises 'crush_limit' (P0001) above 3 crush invites in 30 days, and 'invite_limit'
-- above 20 invites a day.
create function public.create_referral_invite(p_crush boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  new_code text;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_crush, false) and (
    select count(*) from public.referral_invites
    where inviter_id = me and is_crush and created_at > now() - interval '30 days'
  ) >= 3 then
    raise exception 'crush_limit' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.referral_invites
    where inviter_id = me and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'invite_limit' using errcode = 'P0001';
  end if;

  loop
    new_code := substr(md5(gen_random_uuid()::text), 1, 8);
    -- Both code spaces share the ?ref= parameter, so a new invite never shadows a user code.
    continue when exists (select 1 from public.referral_codes rc where rc.code = new_code);
    begin
      insert into public.referral_invites (inviter_id, code, is_crush)
      values (me, new_code, coalesce(p_crush, false));
      return new_code;
    exception when unique_violation then
      -- Taken: try another one.
    end;
  end loop;
end;
$$;

revoke execute on function public.create_referral_invite(boolean) from public, anon;
grant execute on function public.create_referral_invite(boolean) to authenticated;

-- Redefined (20261008000092): a code may now also be a single-use invite. Same rules as before
-- (a profile created within the last day, never the caller's own code); an invite is claimed by
-- at most one person and a person claims at most one invite. Returns whether anything was recorded.
create or replace function public.claim_referral(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  inviter uuid;
  invite uuid;
  recorded boolean := false;
begin
  if me is null then
    return false;
  end if;
  select rc.user_id into inviter from public.referral_codes rc where rc.code = lower(p_code);
  if inviter is null then
    select ri.id, ri.inviter_id into invite, inviter
    from public.referral_invites ri
    where ri.code = lower(p_code)
      and ri.invitee_id is null
      and ri.created_at > now() - interval '30 days';
  end if;
  if inviter is null or inviter = me
     or not exists (select 1 from public.profiles where id = me and created_at > now() - interval '1 day') then
    return false;
  end if;

  if invite is not null then
    update public.referral_invites
    set invitee_id = me, claimed_at = now()
    where id = invite
      and invitee_id is null
      and not exists (select 1 from public.referral_invites x where x.invitee_id = me);
    recorded := found;
  end if;

  update public.profiles
  set referred_by = inviter
  where id = me and referred_by is null;
  return recorded or found;
end;
$$;

-- Whether two profiles want each other's gender (both ways); the crush offers a match only then.
create function public.crush_compatible(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles pa, public.profiles pb
    where pa.id = a and pb.id = b
      and pa.gender = any (pb.interested_in)
      and pb.gender = any (pa.interested_in)
  );
$$;

revoke execute on function public.crush_compatible(uuid, uuid) from public, anon, authenticated;

-- The invitee's one-time card: the inviter's card data, only while the caller is verified, the
-- invite carries the crush flag, it has not been answered or dismissed, and the inviter is still
-- a visible profile (approved, active, not blocked either way). Nothing for anyone else.
create function public.get_pending_crush()
returns table (
  inviter_id   uuid,
  display_name text,
  age          int,
  photo        jsonb,
  compatible   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    public.age_in_years(p.birth_date),
    (select jsonb_build_object('path', ph.storage_path, 'width', ph.width, 'height', ph.height)
     from public.profile_photos ph where ph.profile_id = p.id
     order by ph.position limit 1),
    public.crush_compatible((select auth.uid()), p.id)
  from public.referral_invites ri
  join public.profiles p on p.id = ri.inviter_id
  where ri.invitee_id = (select auth.uid())
    and ri.is_crush
    and ri.crush_answered_at is null
    and public.is_verified()
    and p.verification_status = 'approved'
    and p.is_active
    and not public.is_blocked_between((select auth.uid()), p.id)
  limit 1;
$$;

revoke execute on function public.get_pending_crush() from public, anon;
grant execute on function public.get_pending_crush() to authenticated;

-- The invitee's answer, recorded once (atomic: the row is claimed with its answer in one update).
-- p_yes null = dismissed without answering (the card is never shown again).
-- Yes creates both likes and the match, exactly like a mutual swipe, when the two are verified,
-- not blocked and compatible both ways; otherwise the answer is just stored. Returns the match
-- (null when none was created) so the app can notify the inviter.
create function public.answer_crush(p_yes boolean)
returns table (inviter_id uuid, match_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  who uuid;
  mid uuid;
begin
  if me is null or not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;

  update public.referral_invites ri
  set crush_answer = p_yes, crush_answered_at = now()
  where ri.invitee_id = me and ri.is_crush and ri.crush_answered_at is null
  returning ri.inviter_id into who;
  if who is null then
    raise exception 'No pending crush' using errcode = 'no_data_found';
  end if;

  if p_yes
     and public.crush_compatible(me, who)
     and exists (select 1 from public.profiles where id = who and verification_status = 'approved' and is_active)
     and not public.is_blocked_between(me, who) then
    -- Both likes, so "Who liked you" and the deck behave as after a mutual swipe.
    insert into public.swipes (swiper_id, swiped_id, direction) values (me, who, 'like')
    on conflict (swiper_id, swiped_id) do update set direction = 'like';
    insert into public.swipes (swiper_id, swiped_id, direction) values (who, me, 'like')
    on conflict (swiper_id, swiped_id) do update set direction = 'like';
    mid := public.ensure_match(me, who, 'swipe');
  end if;

  return query select who, mid;
end;
$$;

revoke execute on function public.answer_crush(boolean) from public, anon;
grant execute on function public.answer_crush(boolean) to authenticated;

-- Settings -> Notifications: "Your crush likes you back".
alter table public.notification_prefs add column crush boolean not null default true;
grant insert (crush), update (crush) on public.notification_prefs to authenticated;
