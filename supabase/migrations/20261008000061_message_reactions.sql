-- One emoji reaction per user per message, from a fixed set.
--
-- match_id is denormalized (set from the message) so the chat can subscribe with a
-- `match_id=eq.<id>` postgres_changes filter on its private match:<id> channel.
-- Removing a reaction sets emoji to null instead of deleting the row: Realtime does not apply
-- RLS to DELETE events, so deletes would broadcast row keys to every subscriber of the table.
-- That is also why the primary key is a random id (not message_id + user_id).
-- Clients cannot write the table directly: set_message_reaction() validates everything.
create table public.message_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji      text check (emoji in ('❤️', '😂', '😮', '😢', '👍', '🔥')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index message_reactions_match_idx on public.message_reactions (match_id);

alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;

create policy "message_reactions: participant" on public.message_reactions
  for select to authenticated using (public.is_match_participant(match_id));

-- p_emoji null removes the caller's reaction; any other value sets or replaces it.
create function public.set_message_reaction(p_message uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m_match uuid;
begin
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

revoke execute on function public.set_message_reaction(uuid, text) from public, anon;
grant execute on function public.set_message_reaction(uuid, text) to authenticated;

-- A message deleted for everyone loses its reactions too (emoji null → UPDATE event).
create function public.messages_clear_reactions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.message_reactions set emoji = null
  where message_id = new.id and emoji is not null;
  return null;
end;
$$;

revoke execute on function public.messages_clear_reactions() from public, anon, authenticated;

create trigger messages_clear_reactions
  after update of deleted_at on public.messages
  for each row when (new.deleted_at is not null and old.deleted_at is null)
  execute function public.messages_clear_reactions();

alter publication supabase_realtime add table public.message_reactions;

create index message_reactions_user_recent_idx on public.message_reactions (user_id, created_at desc);

-- Fires inside set_message_reaction() (also on the upsert path), so the RPC fails with P0429.
create trigger message_reactions_rate_limit
  before insert on public.message_reactions
  for each row execute function public.enforce_rate_limit('user_id', '60', '1 minute');
