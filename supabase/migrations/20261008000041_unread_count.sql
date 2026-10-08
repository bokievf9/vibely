-- Total unread messages for the bottom-nav badge. SECURITY INVOKER: RLS on public.messages limits
-- rows to the caller's matches; partners hidden by can_view_profile (banned, blocked, deactivated)
-- are skipped, the same way their chats drop out of the chat list.
create index messages_unread_idx on public.messages (match_id) where read_at is null;

create function public.unread_message_count()
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.messages m
  where m.read_at is null
    and m.sender_id <> (select auth.uid())
    and public.is_match_participant(m.match_id)
    and public.can_view_profile(m.sender_id);
$$;

revoke execute on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;
