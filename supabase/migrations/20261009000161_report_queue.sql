-- Report queue for moderators (/admin/reports) and the Telegram bot.
--
-- A "case" is every open report on the same target (target_type, target_id): one decision closes
-- them all. Each case has
--   status    open | in_review (claimed by a moderator less than 30 minutes ago) | resolved
--   priority  reason tier * 1000 + number of distinct reporters, where the tier is the most severe
--             reason in the case: underage 4, scam/sexual 3, harassment 2, anything else 1
-- Claims expire on their own after 30 minutes (no job needed: the status is computed on read).
--
-- reports.subject_id is the person the report is about (the reported user, the author of a post
-- or comment, the sender of a message, the owner of a photo, the other side of a call or random
-- chat). It is filled in by a trigger, never by the client, and is what the evidence viewers and
-- the retention rules use to know the "parties involved": the reporter and the subject.
--
-- All admin_* functions take the moderator's id (p_admin), re-check it with assert_admin and are
-- callable only with the service role, like the moderation RPCs of 20261008000016.

-- No foreign key on subject_id on purpose: a second reports -> profiles relationship would make
-- every existing PostgREST embed "reports ... profiles(...)" ambiguous and fail.
alter table public.reports
  add column subject_id uuid,
  add column decision   text check (decision in ('dismiss', 'hide', 'ban', 'delete_photo'));

create index reports_subject_open_idx on public.reports (subject_id) where resolved_at is null;
create index reports_resolved_idx on public.reports (resolved_at desc) where resolved_at is not null;

-- "fake: details" -> "fake"
create function public.report_reason_code(p_reason text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(split_part(coalesce(p_reason, ''), ':', 1)));
$$;

create function public.report_reason_tier(p_reason text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case public.report_reason_code(p_reason)
    when 'underage' then 4
    when 'scam' then 3
    when 'sexual' then 3
    when 'harassment' then 2
    else 1
  end;
$$;

-- Who the report is about, and a sanity check for the new target types: the reporter must be a
-- participant of the reported message's chat or of the call, and cannot report themselves.
create function public.reports_set_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.subject_id := null;
  case new.target_type
    when 'user' then
      select id into new.subject_id from public.profiles where id = new.target_id;
    when 'post' then
      select author_id into new.subject_id from public.posts where id = new.target_id;
    when 'comment' then
      select author_id into new.subject_id from public.comments where id = new.target_id;
    when 'random_session' then
      select case when s.user_a = new.reporter_id then s.user_b else s.user_a end
      into new.subject_id
      from public.random_chat_sessions s
      where s.id = new.target_id and new.reporter_id in (s.user_a, s.user_b);
    when 'message' then
      select m.sender_id into new.subject_id
      from public.messages m
      join public.matches x on x.id = m.match_id
      where m.id = new.target_id and new.reporter_id in (x.user_a, x.user_b);
    when 'photo' then
      select profile_id into new.subject_id from public.profile_photos where id = new.target_id;
    when 'call' then
      select case when c.caller_id = new.reporter_id then c.callee_id else c.caller_id end
      into new.subject_id
      from public.calls c
      where c.id = new.target_id and new.reporter_id in (c.caller_id, c.callee_id);
  end case;

  if new.target_type in ('message', 'photo', 'call') then
    if new.subject_id is null then
      raise exception 'Report target not found' using errcode = 'no_data_found';
    end if;
    if new.subject_id = new.reporter_id then
      raise exception 'You cannot report yourself' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_set_subject
  before insert on public.reports
  for each row execute function public.reports_set_subject();

revoke execute on function public.reports_set_subject() from public, anon, authenticated;

-- Existing reports.
update public.reports r set subject_id = r.target_id
where r.target_type = 'user' and exists (select 1 from public.profiles p where p.id = r.target_id);
update public.reports r set subject_id = p.author_id
from public.posts p where r.target_type = 'post' and p.id = r.target_id;
update public.reports r set subject_id = c.author_id
from public.comments c where r.target_type = 'comment' and c.id = r.target_id;
update public.reports r
set subject_id = case when s.user_a = r.reporter_id then s.user_b else s.user_a end
from public.random_chat_sessions s where r.target_type = 'random_session' and s.id = r.target_id;

-- One claim per case. Rows of resolved or expired cases are harmless and get replaced.
create table public.report_claims (
  target_type public.report_target not null,
  target_id   uuid not null,
  claimed_by  uuid not null references auth.users (id) on delete cascade,
  claimed_at  timestamptz not null default now(),
  primary key (target_type, target_id)
);

alter table public.report_claims enable row level security;
revoke all on public.report_claims from anon, authenticated;

-- How long a claim keeps a case "in review" without activity.
create function public.report_claim_ttl()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '30 minutes' $$;

-- The queue. p_status: null = every unresolved case, 'open' = unclaimed (or claim expired),
-- 'in_review' = actively claimed. p_reason: a reason code present in the case.
create function public.admin_report_queue(
  p_admin       uuid,
  p_status      text default null,
  p_reason      text default null,
  p_target_type public.report_target default null,
  p_mine        boolean default false,
  p_limit       int default 20,
  p_offset      int default 0
)
returns table (
  target_type       public.report_target,
  target_id         uuid,
  subject_id        uuid,
  report_count      int,
  reporter_count    int,
  reasons           text[],
  tier              int,
  priority          int,
  first_reported_at timestamptz,
  last_reported_at  timestamptz,
  status            text,
  claimed_by        uuid,
  claimed_at        timestamptz,
  total             bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_admin(p_admin);
  if p_status is not null and p_status not in ('open', 'in_review') then
    raise exception 'Unknown status %', p_status using errcode = 'check_violation';
  end if;

  return query
  with cases as (
    select r.target_type, r.target_id,
      (array_agg(r.subject_id) filter (where r.subject_id is not null))[1] as subject_id,
      count(*)::int as report_count,
      count(distinct r.reporter_id)::int as reporter_count,
      array_agg(distinct public.report_reason_code(r.reason)) as reasons,
      max(public.report_reason_tier(r.reason)) as tier,
      min(r.created_at) as first_reported_at,
      max(r.created_at) as last_reported_at
    from public.reports r
    where r.resolved_at is null
      and (p_target_type is null or r.target_type = p_target_type)
    group by r.target_type, r.target_id
  ),
  with_claims as (
    select c.*,
      case when k.claimed_at > now() - public.report_claim_ttl() then 'in_review' else 'open' end
        as status,
      case when k.claimed_at > now() - public.report_claim_ttl() then k.claimed_by end as claimed_by,
      case when k.claimed_at > now() - public.report_claim_ttl() then k.claimed_at end as claimed_at
    from cases c
    left join public.report_claims k
      on k.target_type = c.target_type and k.target_id = c.target_id
  )
  select w.target_type, w.target_id, w.subject_id, w.report_count, w.reporter_count, w.reasons,
    w.tier, w.tier * 1000 + least(w.reporter_count, 999), w.first_reported_at,
    w.last_reported_at, w.status, w.claimed_by, w.claimed_at, count(*) over ()
  from with_claims w
  where (p_status is null or w.status = p_status)
    and (p_reason is null or p_reason = any (w.reasons))
    and (not coalesce(p_mine, false) or w.claimed_by = p_admin)
  order by w.tier * 1000 + least(w.reporter_count, 999) desc, w.first_reported_at, w.target_id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Resolution history: one row per decision (all reports closed together on one target).
create function public.admin_report_history(
  p_admin       uuid,
  p_target_type public.report_target default null,
  p_reason      text default null,
  p_limit       int default 20,
  p_offset      int default 0
)
returns table (
  target_type       public.report_target,
  target_id         uuid,
  subject_id        uuid,
  report_count      int,
  reasons           text[],
  first_reported_at timestamptz,
  resolved_at       timestamptz,
  resolved_by       uuid,
  decision          text,
  resolution        text,
  total             bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_admin(p_admin);
  return query
  with decisions as (
    select r.target_type, r.target_id,
      (array_agg(r.subject_id) filter (where r.subject_id is not null))[1] as subject_id,
      count(*)::int as report_count,
      array_agg(distinct public.report_reason_code(r.reason)) as reasons,
      min(r.created_at) as first_reported_at,
      r.resolved_at, r.resolved_by,
      max(r.decision) as decision,
      max(r.resolution) as resolution
    from public.reports r
    where r.resolved_at is not null
      and (p_target_type is null or r.target_type = p_target_type)
    group by r.target_type, r.target_id, r.resolved_at, r.resolved_by
  )
  select d.target_type, d.target_id, d.subject_id, d.report_count, d.reasons,
    d.first_reported_at, d.resolved_at, d.resolved_by, d.decision, d.resolution, count(*) over ()
  from decisions d
  where p_reason is null or p_reason = any (d.reasons)
  order by d.resolved_at desc, d.target_id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Takes a case for review (or refreshes my own claim). Fails while someone else holds it.
create function public.admin_claim_report(p_admin uuid, p_type public.report_target, p_target uuid)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  claimed timestamptz;
begin
  perform public.assert_admin(p_admin);
  if not exists (
    select 1 from public.reports
    where target_type = p_type and target_id = p_target and resolved_at is null
  ) then
    raise exception 'No open reports on this target' using errcode = 'no_data_found';
  end if;

  insert into public.report_claims as k (target_type, target_id, claimed_by, claimed_at)
  values (p_type, p_target, p_admin, now())
  on conflict (target_type, target_id) do update
  set claimed_by = excluded.claimed_by, claimed_at = excluded.claimed_at
  where k.claimed_by = excluded.claimed_by or k.claimed_at <= now() - public.report_claim_ttl()
  returning k.claimed_at into claimed;

  if claimed is null then
    raise exception 'Already claimed by another moderator' using errcode = 'lock_not_available';
  end if;
  perform public.log_moderation(p_admin, 'reports.claim', p_type::text, p_target, null);
  return claimed;
end;
$$;

-- Gives a case back. Only the moderator holding it can (an expired claim is simply dropped).
create function public.admin_release_report(p_admin uuid, p_type public.report_target, p_target uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin(p_admin);
  delete from public.report_claims
  where target_type = p_type and target_id = p_target
    and (claimed_by = p_admin or claimed_at <= now() - public.report_claim_ttl());
  if found then
    perform public.log_moderation(p_admin, 'reports.release', p_type::text, p_target, null);
    return true;
  end if;
  if exists (select 1 from public.report_claims where target_type = p_type and target_id = p_target) then
    raise exception 'Claimed by another moderator' using errcode = 'lock_not_available';
  end if;
  return false;
end;
$$;

-- One decision on a case, atomically: the sanction (hide / ban / delete photo) and the closing of
-- every open report on the target happen in one transaction, or nothing happens.
--   dismiss       no violation
--   hide          posts and comments only
--   ban           p_offender defaults to the case subject; it may also be one of the reporters
--   delete_photo  photo cases only; returns the storage path so the caller removes the file
-- Returns {"closed": n, "decision": ..., "offender": uuid|null, "photo_path": text|null}.
create function public.admin_resolve_case(
  p_admin    uuid,
  p_type     public.report_target,
  p_target   uuid,
  p_decision text,
  p_reason   text default null,
  p_offender uuid default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  claim   public.report_claims;
  subject uuid;
  offender uuid;
  path    text;
  closed  int;
  note    text := nullif(btrim(p_reason), '');
begin
  perform public.assert_admin(p_admin);
  if p_decision is null or p_decision not in ('dismiss', 'hide', 'ban', 'delete_photo') then
    raise exception 'Unknown decision %', p_decision using errcode = 'check_violation';
  end if;

  -- Lock the open reports: a second moderator deciding at the same time waits, then finds none.
  perform 1 from public.reports
  where target_type = p_type and target_id = p_target and resolved_at is null
  for update;
  if not found then
    raise exception 'No open reports on this target' using errcode = 'no_data_found';
  end if;

  select * into claim from public.report_claims where target_type = p_type and target_id = p_target;
  if claim.claimed_by is not null and claim.claimed_by <> p_admin
     and claim.claimed_at > now() - public.report_claim_ttl() then
    raise exception 'Claimed by another moderator' using errcode = 'lock_not_available';
  end if;

  select r.subject_id into subject from public.reports r
  where r.target_type = p_type and r.target_id = p_target and r.resolved_at is null
    and r.subject_id is not null
  limit 1;

  case p_decision
    when 'dismiss' then
      null;
    when 'hide' then
      if p_type not in ('post', 'comment') then
        raise exception 'Only posts and comments can be hidden' using errcode = 'check_violation';
      end if;
      perform public.admin_set_content_hidden(p_admin, p_type, p_target, true, note);
    when 'ban' then
      offender := coalesce(p_offender, subject);
      if offender is null then
        raise exception 'Nobody to ban' using errcode = 'no_data_found';
      end if;
      if offender is distinct from subject and not exists (
        select 1 from public.reports
        where target_type = p_type and target_id = p_target and resolved_at is null
          and reporter_id = offender
      ) then
        raise exception 'The offender must be a party of the case' using errcode = 'check_violation';
      end if;
      perform public.admin_set_ban(p_admin, offender, true, note);
    when 'delete_photo' then
      if p_type <> 'photo' then
        raise exception 'Only photo reports can delete a photo' using errcode = 'check_violation';
      end if;
      path := public.admin_delete_photo(p_admin, p_target, note);
  end case;

  update public.reports
  set resolved_at = now(), resolved_by = p_admin, decision = p_decision,
      resolution = left(coalesce(note, case p_decision when 'dismiss' then 'no_violation' end), 500)
  where target_type = p_type and target_id = p_target and resolved_at is null;
  get diagnostics closed = row_count;

  delete from public.report_claims where target_type = p_type and target_id = p_target;
  perform public.log_moderation(p_admin, 'reports.resolve', p_type::text, p_target,
    p_decision || coalesce(': ' || note, ''));

  return jsonb_build_object('closed', closed, 'decision', p_decision, 'offender', offender,
    'photo_path', path);
end;
$$;

-- Bulk dismiss from the queue. Each case is resolved (and logged) on its own; cases that are no
-- longer open or are held by another moderator are skipped. Returns the cases dismissed.
-- p_targets: [{"type": "user", "id": "<uuid>"}, ...] (at most 100).
create function public.admin_bulk_dismiss(p_admin uuid, p_targets jsonb, p_reason text default null)
returns int
language plpgsql
set search_path = ''
as $$
declare
  t      jsonb;
  done   int := 0;
begin
  perform public.assert_admin(p_admin);
  if jsonb_typeof(p_targets) <> 'array' or jsonb_array_length(p_targets) > 100 then
    raise exception 'Expected an array of at most 100 targets' using errcode = 'check_violation';
  end if;
  for t in select * from jsonb_array_elements(p_targets) loop
    begin
      perform public.admin_resolve_case(p_admin, (t ->> 'type')::public.report_target,
        (t ->> 'id')::uuid, 'dismiss', coalesce(nullif(btrim(p_reason), ''), 'bulk_dismiss'));
      done := done + 1;
    exception
      when no_data_found or lock_not_available then null;
    end;
  end loop;
  return done;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'report_claim_ttl()',
    'admin_report_queue(uuid, text, text, public.report_target, boolean, int, int)',
    'admin_report_history(uuid, public.report_target, text, int, int)',
    'admin_claim_report(uuid, public.report_target, uuid)',
    'admin_release_report(uuid, public.report_target, uuid)',
    'admin_resolve_case(uuid, public.report_target, uuid, text, text, uuid)',
    'admin_bulk_dismiss(uuid, jsonb, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
