-- Audio/video calls between matched users (LiveKit, see docs/calls.md).
--
-- Safety protocol (CLAUDE.md): every call is recorded server-side and kept up to 90 days. Users are
-- told before they can enable calls (profiles.calls_consent_at = the one-time notice was accepted)
-- and by a "Recording" indicator during the call. A call needs both participants to allow calls in
-- that chat (call_permissions). Recording details (egress id, storage path) are never readable by
-- users: only the server (service role) and moderators handling a report see them.
create type public.call_kind as enum ('audio', 'video');
create type public.call_status as enum ('ringing', 'active', 'ended', 'missed', 'declined');
create type public.call_recording_status as enum ('none', 'pending', 'recording', 'ready', 'failed', 'purged');

-- When the user accepted "Calls are recorded and stored for up to 90 days for safety".
-- Set only through accept_calls_notice(); readable only through call_settings().
alter table public.profiles add column calls_consent_at timestamptz;

create table public.call_permissions (
  match_id   uuid not null references public.matches (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  allowed_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

-- Participants are kept even when the match goes away (block = unmatch): a reported call must stay
-- findable by the pair of users. Rows are purged after 90 days (20261008000123).
create table public.calls (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid references public.matches (id) on delete set null,
  caller_id        uuid references public.profiles (id) on delete set null,
  callee_id        uuid references public.profiles (id) on delete set null,
  kind             public.call_kind not null,
  status           public.call_status not null default 'ringing',
  started_at       timestamptz not null default now(),
  answered_at      timestamptz,
  ended_at         timestamptz,
  egress_id        text check (char_length(egress_id) <= 100),
  recording_path   text,
  recording_status public.call_recording_status not null default 'none',
  recording_bytes  bigint check (recording_bytes >= 0),
  check (caller_id <> callee_id),
  -- calls/<match id>/<call id>.(ogg|mp4), the layout the egress writes (src/features/calls/server).
  constraint calls_recording_path check (
    recording_path is null
    or recording_path ~ ('^calls/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      || id::text || '\.(ogg|mp4)$')
  )
);

create index calls_match_started_idx on public.calls (match_id, started_at desc);
create index calls_caller_idx on public.calls (caller_id, started_at desc);
create index calls_callee_idx on public.calls (callee_id, started_at desc);
create index calls_live_idx on public.calls (started_at) where status in ('ringing', 'active');
create index calls_recording_idx on public.calls (started_at) where recording_path is not null;

alter table public.call_permissions enable row level security;
alter table public.calls enable row level security;
revoke all on public.call_permissions, public.calls from anon, authenticated;

-- Reads only; every write goes through the SECURITY DEFINER RPCs (20261008000121).
grant select on public.call_permissions to authenticated;
grant select (id, match_id, caller_id, callee_id, kind, status, started_at, answered_at, ended_at)
  on public.calls to authenticated;

create policy "call_permissions: participant" on public.call_permissions
  for select to authenticated using (public.is_match_participant(match_id));

create policy "calls: participant" on public.calls
  for select to authenticated using ((select auth.uid()) in (caller_id, callee_id));

-- Private bucket for the "supabase" storage mode (docs/calls.md). No policies: users never touch
-- it; the egress writes through the S3 endpoint, moderators read through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('call-recordings', 'call-recordings', false, null, array['audio/ogg', 'video/mp4'])
on conflict (id) do update
set public = excluded.public,
    allowed_mime_types = excluded.allowed_mime_types;
