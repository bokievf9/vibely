create or replace function public.set_message_reaction(p_message uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m_match uuid;
begin
  -- '' also means "remove my reaction" (generated RPC types don't allow null arguments).
  p_emoji := nullif(p_emoji, '');
  if p_emoji is not null and p_emoji not in ('❤️', '😂', '😮', '😢', '👍', '🔥') then
    raise exception 'invalid emoji' using errcode = '22023';
  end if;
  select match_id into m_match
  from public.messages
  where id = p_message and deleted_at is null;
  if m_match is null
    or not public.is_match_participant(m_match)
    or not public.is_verified() then
    raise exception 'message not found' using errcode = '42501';
  end if;
  insert into public.message_reactions (message_id, match_id, user_id, emoji)
  values (p_message, m_match, (select auth.uid()), p_emoji)
  on conflict (message_id, user_id)
  do update set emoji = excluded.emoji, created_at = now()
  where public.message_reactions.emoji is distinct from excluded.emoji;
end;
$$;
