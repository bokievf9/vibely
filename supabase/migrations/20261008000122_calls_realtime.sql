-- One more private Realtime topic:
--   call:<user id>   only that user may join; read-only for clients. Carries call signalling sent by
--                    the database (incoming / answered / ended / permission, 20261008000121).
-- "realtime: receive" is recreated with every existing topic (last: 20261008000040) plus call:.
-- MERGE NOTE: any other branch that recreates this policy must keep the call: line.
drop policy "realtime: receive" on realtime.messages;

create policy "realtime: receive" on realtime.messages
  for select to authenticated
  using (
    (realtime.topic() = 'feed' and public.is_verified())
    or realtime.topic() = 'randomizer:' || (select auth.uid())::text
    or realtime.topic() = 'inbox:' || (select auth.uid())::text
    or realtime.topic() = 'call:' || (select auth.uid())::text
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
