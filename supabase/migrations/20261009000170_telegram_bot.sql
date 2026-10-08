-- Telegram moderation bot (src/features/telegram). Everything here is service-role only: the
-- webhook (POST /api/telegram/webhook) authenticates Telegram with a secret header, then maps the
-- Telegram user to a moderator through admins.telegram_user_id and calls the same moderation RPCs
-- as the admin panel with that moderator's id.
--
-- * Linking: a moderator gets a one-time code in /admin/telegram (stored as a SHA-256 hash, valid
--   10 minutes) and sends `/link CODE` to the bot in a private chat. Failed attempts are throttled
--   (5 per 15 minutes per Telegram user) and recorded in telegram_audit.
-- * telegram_messages: what the bot posted to the moderators chat, so selfie photos can be
--   deleted from the chat after the decision (or after ~46 h, Telegram lets bots delete only
--   messages younger than 48 h) and report messages can be updated instead of re-posted.
--   Sending and deleting selfie photos is logged in moderation_actions (selfie.telegram_sent /
--   selfie.telegram_deleted) with the message ids.
-- * telegram_audit: refused bot access (unknown users, unlinked users, wrong chats) and link
--   attempts. Kept 90 days (purged by the bot's hourly sweep).

alter table public.admins
  add column telegram_user_id   bigint unique check (telegram_user_id > 0),
  add column telegram_linked_at timestamptz;

create table public.telegram_link_codes (
  admin_id   uuid primary key references public.admins (user_id) on delete cascade,
  code_hash  text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.telegram_messages (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null check (kind in ('selfie', 'report')),
  -- 'verification_request' for selfies, the report_target for reports.
  ref_type           text not null check (char_length(ref_type) <= 32),
  ref_id             uuid not null,
  chat_id            bigint not null,
  photo_message_ids  bigint[] not null default '{}',
  control_message_id bigint,
  created_at         timestamptz not null default now(),
  photos_deleted_at  timestamptz,
  closed_at          timestamptz
);

create unique index telegram_messages_open_idx
  on public.telegram_messages (kind, ref_type, ref_id) where closed_at is null;
create index telegram_messages_photos_idx
  on public.telegram_messages (created_at) where photos_deleted_at is null;

create table public.telegram_audit (
  id               bigint generated always as identity primary key,
  telegram_user_id bigint,
  chat_id          bigint,
  event            text not null check (char_length(event) <= 64),
  detail           text check (char_length(detail) <= 200),
  created_at       timestamptz not null default now()
);

create index telegram_audit_user_idx on public.telegram_audit (telegram_user_id, created_at desc);
create index telegram_audit_created_idx on public.telegram_audit (created_at);

alter table public.telegram_link_codes enable row level security;
alter table public.telegram_messages enable row level security;
alter table public.telegram_audit enable row level security;
revoke all on public.telegram_link_codes, public.telegram_messages, public.telegram_audit
  from anon, authenticated;

-- Codes are compared case-insensitively and without spaces ("ab cd 1234" = "ABCD1234").
create function public.telegram_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')), 'UTF8')), 'hex');
$$;

-- Stores a new one-time code for the moderator (replacing an older one). The app generates the
-- code; only its hash is stored. Returns the expiry.
create function public.admin_telegram_issue_code(p_admin uuid, p_code text)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  perform public.assert_admin(p_admin);
  if coalesce(p_code, '') !~ '^[A-HJ-NP-Z2-9]{8}$' then
    raise exception 'Invalid code' using errcode = 'check_violation';
  end if;

  delete from public.telegram_link_codes where expires_at < now();
  insert into public.telegram_link_codes (admin_id, code_hash, expires_at)
  values (p_admin, public.telegram_code_hash(p_code), now() + interval '10 minutes')
  on conflict (admin_id) do update
    set code_hash = excluded.code_hash, expires_at = excluded.expires_at, created_at = now()
  returning expires_at into v_expires;

  perform public.log_moderation(p_admin, 'telegram.code_issue', 'admin', p_admin, null);
  return v_expires;
end;
$$;

-- `/link CODE` from a private chat. Never raises for a wrong code (the failed attempt must be
-- recorded, a raise would roll it back): returns 'linked' (with the moderator), 'invalid',
-- 'taken' (this Telegram account is linked to another moderator) or 'throttled'.
create function public.telegram_link_admin(p_code text, p_telegram_user_id bigint)
returns table (result text, linked_admin uuid)
language plpgsql
set search_path = ''
as $$
declare
  v_admin uuid;
  v_owner uuid;
begin
  if p_telegram_user_id is null or p_telegram_user_id <= 0 then
    raise exception 'Invalid Telegram user' using errcode = 'check_violation';
  end if;

  if (select count(*) from public.telegram_audit a
      where a.telegram_user_id = p_telegram_user_id and a.event = 'link_failed'
        and a.created_at > now() - interval '15 minutes') >= 5 then
    insert into public.telegram_audit (telegram_user_id, chat_id, event)
    values (p_telegram_user_id, p_telegram_user_id, 'link_throttled');
    return query select 'throttled'::text, null::uuid;
    return;
  end if;

  delete from public.telegram_link_codes c
  where c.code_hash = public.telegram_code_hash(p_code) and c.expires_at > now()
  returning c.admin_id into v_admin;

  if v_admin is null then
    insert into public.telegram_audit (telegram_user_id, chat_id, event)
    values (p_telegram_user_id, p_telegram_user_id, 'link_failed');
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  select a.user_id into v_owner from public.admins a where a.telegram_user_id = p_telegram_user_id;
  if v_owner is not null and v_owner <> v_admin then
    insert into public.telegram_audit (telegram_user_id, chat_id, event)
    values (p_telegram_user_id, p_telegram_user_id, 'link_taken');
    return query select 'taken'::text, null::uuid;
    return;
  end if;

  update public.admins
  set telegram_user_id = p_telegram_user_id, telegram_linked_at = now()
  where user_id = v_admin;
  perform public.log_moderation(v_admin, 'telegram.link', 'admin', v_admin,
    format('telegram user %s', p_telegram_user_id));
  return query select 'linked'::text, v_admin;
end;
$$;

create function public.admin_telegram_unlink(p_admin uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin(p_admin);
  update public.admins set telegram_user_id = null, telegram_linked_at = null
  where user_id = p_admin and telegram_user_id is not null;
  if found then
    perform public.log_moderation(p_admin, 'telegram.unlink', 'admin', p_admin, null);
  end if;
  delete from public.telegram_link_codes where admin_id = p_admin;
end;
$$;

-- Remembers a message the bot posted. For selfies the access is logged (who: the bot, so no
-- admin; where: chat and message ids). One open row per subject: posting again replaces it.
create function public.telegram_record_message(
  p_kind text, p_ref_type text, p_ref_id uuid, p_chat bigint, p_photos bigint[], p_control bigint
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.telegram_messages set closed_at = now()
  where kind = p_kind and ref_type = p_ref_type and ref_id = p_ref_id and closed_at is null;

  insert into public.telegram_messages
    (kind, ref_type, ref_id, chat_id, photo_message_ids, control_message_id)
  values (p_kind, p_ref_type, p_ref_id, p_chat, coalesce(p_photos, '{}'), p_control)
  returning id into v_id;

  if p_kind = 'selfie' then
    perform public.log_moderation(null, 'selfie.telegram_sent', p_ref_type, p_ref_id,
      format('chat %s, messages %s', p_chat,
        array_to_string(coalesce(p_photos, '{}') || p_control, ',')));
  end if;
  return v_id;
end;
$$;

-- Marks the photos of a posted message as deleted from the chat (once) and logs it for selfies.
-- p_cause: 'decided' | 'expired' | 'decided_elsewhere'.
create function public.telegram_mark_photos_deleted(p_id uuid, p_cause text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  m public.telegram_messages;
begin
  update public.telegram_messages set photos_deleted_at = now()
  where id = p_id and photos_deleted_at is null
  returning * into m;
  if m.id is null then
    return false;
  end if;
  if m.kind = 'selfie' then
    perform public.log_moderation(null, 'selfie.telegram_deleted', m.ref_type, m.ref_id,
      format('%s; chat %s, messages %s', p_cause, m.chat_id,
        array_to_string(m.photo_message_ids, ',')));
  end if;
  return true;
end;
$$;

-- Posted selfies whose photos must leave the chat: the request was decided (here or in the
-- panel) or the photos are older than p_max_age.
create function public.telegram_photos_to_delete(p_max_age interval, p_limit int default 50)
returns table (id uuid, chat_id bigint, photo_message_ids bigint[], control_message_id bigint,
  ref_id uuid, expired boolean, created_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select m.id, m.chat_id, m.photo_message_ids, m.control_message_id, m.ref_id,
    m.created_at < now() - p_max_age, m.created_at
  from public.telegram_messages m
  where m.kind = 'selfie' and m.photos_deleted_at is null
    and (m.created_at < now() - p_max_age
      or not exists (select 1 from public.verification_requests v
                     where v.id = m.ref_id and v.status = 'pending'))
  order by m.created_at
  limit least(200, greatest(1, p_limit));
$$;

-- What the bot needs to describe a report target (never the reporters or the content):
-- open reports, priority signals and the account a ban would hit.
create function public.telegram_report_summary(p_type public.report_target, p_target uuid)
returns table (open_reports int, offender_id uuid, offender_reports_1h int, underage boolean,
  auto_hidden boolean, latest_reason text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_open int;
  v_underage boolean;
  v_latest text;
  v_offender uuid;
  v_recent int := 0;
begin
  select count(*)::int, coalesce(bool_or(split_part(r.reason, ':', 1) = 'underage'), false)
  into v_open, v_underage
  from public.reports r
  where r.target_type = p_type and r.target_id = p_target and r.resolved_at is null;

  select split_part(r.reason, ':', 1) into v_latest
  from public.reports r
  where r.target_type = p_type and r.target_id = p_target
  order by r.created_at desc
  limit 1;

  v_offender := case p_type
    when 'user' then (select p.id from public.profiles p where p.id = p_target)
    when 'post' then (select p.author_id from public.posts p where p.id = p_target)
    when 'comment' then (select c.author_id from public.comments c where c.id = p_target)
    when 'random_session' then (
      select case when s.user_a in (select r.reporter_id from public.reports r
                                    where r.target_type = 'random_session' and r.target_id = p_target)
                  then s.user_b else s.user_a end
      from public.random_chat_sessions s where s.id = p_target)
  end;

  if v_offender is not null then
    select count(*)::int into v_recent
    from public.reports r
    where r.created_at > now() - interval '1 hour'
      and r.reporter_id <> v_offender
      and ((r.target_type = 'user' and r.target_id = v_offender)
        or (r.target_type = 'post' and r.target_id in
              (select p.id from public.posts p where p.author_id = v_offender))
        or (r.target_type = 'comment' and r.target_id in
              (select c.id from public.comments c where c.author_id = v_offender))
        or (r.target_type = 'random_session' and r.target_id in
              (select s.id from public.random_chat_sessions s where v_offender in (s.user_a, s.user_b))));
  end if;

  return query select v_open, v_offender, v_recent, v_underage,
    exists (select 1 from public.moderation_actions a
            where a.target_id = p_target and a.action = 'auto.hide'
              and a.created_at > now() - interval '5 minutes'),
    v_latest;
end;
$$;

-- Queue sizes and counts since p_since (/stats and the daily digest).
create function public.telegram_stats(p_since timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'pending_selfies', (select count(*) from public.verification_requests where status = 'pending'),
    'oldest_selfie_at', (select min(created_at) from public.verification_requests where status = 'pending'),
    'open_reports', (select count(*) from public.reports where resolved_at is null),
    'open_report_targets', (select count(distinct (target_type, target_id)) from public.reports
                            where resolved_at is null),
    'oldest_report_at', (select min(created_at) from public.reports where resolved_at is null),
    'selfies_submitted', (select count(*) from public.verification_requests where created_at >= p_since),
    'selfies_approved', (select count(*) from public.verification_requests
                         where status = 'approved' and reviewed_at >= p_since),
    'selfies_rejected', (select count(*) from public.verification_requests
                         where status = 'rejected' and reviewed_at >= p_since),
    'reports_created', (select count(*) from public.reports where created_at >= p_since),
    'reports_resolved', (select count(*) from public.reports where resolved_at >= p_since),
    'bans', (select count(*) from public.moderation_actions where action = 'user.ban' and created_at >= p_since),
    'unbans', (select count(*) from public.moderation_actions where action = 'user.unban' and created_at >= p_since),
    'auto_hidden', (select count(*) from public.moderation_actions where action = 'auto.hide' and created_at >= p_since)
  );
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'telegram_code_hash(text)',
    'admin_telegram_issue_code(uuid, text)',
    'telegram_link_admin(text, bigint)',
    'admin_telegram_unlink(uuid)',
    'telegram_record_message(text, text, uuid, bigint, bigint[], bigint)',
    'telegram_mark_photos_deleted(uuid, text)',
    'telegram_photos_to_delete(interval, int)',
    'telegram_report_summary(public.report_target, uuid)',
    'telegram_stats(timestamptz)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
