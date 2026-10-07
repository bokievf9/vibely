-- Realtime authorizes writes once per channel join and can't see the event name, so the old
-- "typing only" insert rule on random:<id> blocked typing entirely. Split the channels instead:
--   random:<id>         read-only for clients; only the database broadcasts (messages, reveal, end)
--   random-typing:<id>  participants may broadcast; carries nothing but typing indicators
drop policy "realtime: typing" on realtime.messages;
drop policy "realtime: receive" on realtime.messages;

create policy "realtime: receive" on realtime.messages
  for select to authenticated
  using (
    (realtime.topic() = 'feed' and public.is_verified())
    or realtime.topic() = 'randomizer:' || (select auth.uid())::text
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
  );

create policy "realtime: typing" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'random-typing:%'
    and public.random_session_side(substring(realtime.topic() from 15)::uuid) is not null
  );
