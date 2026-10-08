-- Two more private Realtime topics:
--   inbox:<user id>      only that user may join; carries postgres_changes on public.messages
--                        (rows stay RLS-filtered to the user's matches) for the unread badge
--   match-typing:<id>    match participants may read AND broadcast; carries only typing indicators.
--                        match:<id> stays read-only for clients (see 20261008000020 for why the
--                        writable topic must be a separate one).
-- "realtime: receive" is recreated with every existing topic plus the two new ones.
drop policy "realtime: receive" on realtime.messages;

create policy "realtime: receive" on realtime.messages
  for select to authenticated
  using (
    (realtime.topic() = 'feed' and public.is_verified())
    or realtime.topic() = 'randomizer:' || (select auth.uid())::text
    or realtime.topic() = 'inbox:' || (select auth.uid())::text
    or (
      realtime.topic() like 'random:%'
      and public.random_session_side(substring(realtime.topic() from 8)::uuid) is not null
    )
    or (
      realtime.topic() like 'random-typing:%'
      and public.random_session_side(substring(realtime.topic() from 15)::uuid) is not null
    )
    or (
      realtime.topic() like 'match:%'
      and public.is_match_participant(substring(realtime.topic() from 7)::uuid)
    )
    or (
      realtime.topic() like 'match-typing:%'
      and public.is_match_participant(substring(realtime.topic() from 14)::uuid)
    )
  );

create policy "realtime: match typing" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'match-typing:%'
    and public.is_match_participant(substring(realtime.topic() from 14)::uuid)
  );
