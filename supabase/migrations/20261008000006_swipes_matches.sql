create table public.swipes (
  swiper_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  swiped_id  uuid not null references public.profiles (id) on delete cascade,
  direction  public.swipe_direction not null,
  created_at timestamptz not null default now(),
  primary key (swiper_id, swiped_id),
  check (swiper_id <> swiped_id)
);

create index swipes_incoming_likes_idx on public.swipes (swiped_id) where direction = 'like';

-- One row per pair: user_a is always the smaller uuid.
create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  source     public.match_source not null,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index matches_user_b_idx on public.matches (user_b);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  sender_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index messages_match_created_idx on public.messages (match_id, created_at desc);

-- Creates (or returns) the match for a pair. Shared by swipes and the randomizer.
create function public.ensure_match(a uuid, b uuid, src public.match_source)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid;
begin
  insert into public.matches (user_a, user_b, source)
  values (least(a, b), greatest(a, b), src)
  on conflict (user_a, user_b) do nothing
  returning id into match_id;

  if match_id is null then
    select id into match_id from public.matches
    where user_a = least(a, b) and user_b = greatest(a, b);
  end if;
  return match_id;
end;
$$;

create function public.swipes_create_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction = 'like' and exists (
    select 1 from public.swipes
    where swiper_id = new.swiped_id and swiped_id = new.swiper_id and direction = 'like'
  ) then
    perform public.ensure_match(new.swiper_id, new.swiped_id, 'swipe');
  end if;
  return new;
end;
$$;

create trigger swipes_create_match
  after insert on public.swipes
  for each row execute function public.swipes_create_match();

create function public.is_match_participant(m uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches
    where id = m and (select auth.uid()) in (user_a, user_b)
  );
$$;

revoke execute on function public.ensure_match(uuid, uuid, public.match_source) from public, anon, authenticated;
revoke execute on function public.swipes_create_match() from public, anon, authenticated;
revoke execute on function public.is_match_participant(uuid) from public, anon;
grant execute on function public.is_match_participant(uuid) to authenticated;

alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

revoke all on public.swipes, public.matches, public.messages from anon, authenticated;
grant select on public.swipes to authenticated;
grant insert (swiped_id, direction) on public.swipes to authenticated;
grant select, delete on public.matches to authenticated;
grant select on public.messages to authenticated;
grant insert (match_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Users see only their own swipes, so nobody can learn who liked them before a match.
create policy "swipes: own" on public.swipes
  for select to authenticated using (swiper_id = (select auth.uid()));
create policy "swipes: create" on public.swipes
  for insert to authenticated
  with check (
    swiper_id = (select auth.uid())
    and public.is_verified()
    and public.can_view_profile(swiped_id)
  );

create policy "matches: participant" on public.matches
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));
create policy "matches: unmatch" on public.matches
  for delete to authenticated using ((select auth.uid()) in (user_a, user_b));

create policy "messages: participant" on public.messages
  for select to authenticated using (public.is_match_participant(match_id));
create policy "messages: send" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_verified()
    and public.is_match_participant(match_id)
  );
create policy "messages: mark read" on public.messages
  for update to authenticated
  using (public.is_match_participant(match_id) and sender_id <> (select auth.uid()))
  with check (public.is_match_participant(match_id) and sender_id <> (select auth.uid()));

-- Chat delivery via postgres_changes (RLS-filtered per subscriber).
alter publication supabase_realtime add table public.messages;
