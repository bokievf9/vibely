-- Realtime runs in private-only mode, so the match chat channel (postgres_changes on messages,
-- topic "match:<match id>") must be authorized too. Row data stays RLS-filtered on public.messages.
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
      realtime.topic() like 'match:%'
      and public.is_match_participant(substring(realtime.topic() from 7)::uuid)
    )
  );
