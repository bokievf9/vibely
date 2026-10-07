-- Anonymous random chat. All tables are closed to clients; everything goes through RPCs
-- so a participant can never read the other user's id before both agree to reveal.
create table public.random_chat_queue (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  want_genders public.gender[] not null check (cardinality(want_genders) between 1 and 3),
  min_age      smallint not null check (min_age >= 18),
  max_age      smallint not null check (max_age <= 99),
  want_tags    smallint[] not null default '{}' check (cardinality(want_tags) <= 10),
  enqueued_at  timestamptz not null default now(),
  check (min_age <= max_age)
);

create index random_chat_queue_fifo_idx on public.random_chat_queue (enqueued_at);

create table public.random_chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references public.profiles (id) on delete cascade,
  user_b      uuid not null references public.profiles (id) on delete cascade,
  status      public.random_session_status not null default 'active',
  a_revealed  boolean not null default false,
  b_revealed  boolean not null default false,
  revealed_at timestamptz,
  match_id    uuid references public.matches (id) on delete set null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  check (user_a <> user_b)
);

create index random_sessions_user_a_active_idx on public.random_chat_sessions (user_a) where status = 'active';
create index random_sessions_user_b_active_idx on public.random_chat_sessions (user_b) where status = 'active';

-- Stored for moderation (reports on a session expose the transcript to the service role).
create table public.random_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.random_chat_sessions (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index random_messages_session_created_idx on public.random_chat_messages (session_id, created_at);

alter table public.random_chat_queue enable row level security;
alter table public.random_chat_sessions enable row level security;
alter table public.random_chat_messages enable row level security;
revoke all on public.random_chat_queue, public.random_chat_sessions, public.random_chat_messages
  from anon, authenticated;

-- 'a', 'b' or null: which side of the session the caller is on.
create function public.random_session_side(s uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case (select auth.uid())
           when user_a then 'a'
           when user_b then 'b'
         end
  from public.random_chat_sessions where id = s;
$$;

revoke execute on function public.random_session_side(uuid) from public, anon;
grant execute on function public.random_session_side(uuid) to authenticated;

-- Realtime Authorization for private broadcast channels:
--   feed                    new-post signal for every verified user
--   randomizer:<user id>    "you've been paired" notification for the waiting user
--   random:<session id>     chat messages, typing, reveal and end events for participants
create policy "realtime: receive" on realtime.messages
  for select to authenticated
  using (
    (realtime.topic() = 'feed' and public.is_verified())
    or realtime.topic() = 'randomizer:' || (select auth.uid())::text
    or (
      realtime.topic() like 'random:%'
      and public.random_session_side(substring(realtime.topic() from 8)::uuid) is not null
    )
  );

-- Clients may only send ephemeral typing events; messages go through randomizer_send().
create policy "realtime: typing" on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() like 'random:%'
    and realtime.messages.extension = 'broadcast'
    and realtime.messages.event = 'typing'
    and public.random_session_side(substring(realtime.topic() from 8)::uuid) is not null
  );
