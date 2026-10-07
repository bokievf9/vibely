-- Anonymous feed. author_id is stored for moderation and rate limits but never reaches clients:
-- tables are closed to `authenticated`, reads go through the views below, writes through RPCs.
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles (id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 1000),
  likes_count    int not null default 0 check (likes_count >= 0),
  comments_count int not null default 0 check (comments_count >= 0),
  is_hidden      boolean not null default false,
  created_at     timestamptz not null default now()
);

create index posts_feed_idx on public.posts (created_at desc, id desc) where not is_hidden;
create index posts_author_recent_idx on public.posts (author_id, created_at desc);

-- Stable per-thread pseudonym: alias 0 is the post author ("Автор"), others are "Аноним #N".
create table public.post_aliases (
  post_id  uuid not null references public.posts (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  alias_no smallint not null check (alias_no >= 0),
  primary key (post_id, user_id),
  unique (post_id, alias_no)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  alias_no   smallint not null,
  body       text not null check (char_length(body) between 1 and 500),
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now()
);

create index comments_post_created_idx on public.comments (post_id, created_at);
create index comments_author_recent_idx on public.comments (author_id, created_at desc);

create table public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Counters.
create function public.bump_post_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  target uuid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  if tg_table_name = 'post_likes' then
    update public.posts set likes_count = greatest(0, likes_count + delta) where id = target;
  else
    update public.posts set comments_count = greatest(0, comments_count + delta) where id = target;
  end if;
  return null;
end;
$$;

create trigger post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.bump_post_counter();
create trigger comments_count
  after insert or delete on public.comments
  for each row execute function public.bump_post_counter();

-- "New posts" signal for the feed; carries only the id, never the author.
create function public.broadcast_new_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('post_id', new.id), 'new_post', 'feed', true);
  return null;
end;
$$;

create trigger posts_broadcast_new
  after insert on public.posts
  for each row execute function public.broadcast_new_post();

revoke execute on function public.bump_post_counter() from public, anon, authenticated;
revoke execute on function public.broadcast_new_post() from public, anon, authenticated;

alter table public.posts enable row level security;
alter table public.post_aliases enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
-- No policies: direct access is denied. Views and RPCs run as the owner.
revoke all on public.posts, public.post_aliases, public.comments, public.post_likes
  from anon, authenticated;

-- Read models. Owner-rights views (no security_invoker) so they can read the closed tables;
-- they filter by the caller themselves and expose no author ids.
create view public.feed_posts as
select
  p.id,
  p.body,
  p.likes_count,
  p.comments_count,
  p.created_at,
  p.author_id = (select auth.uid()) as is_mine,
  exists (
    select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())
  ) as is_liked_by_me
from public.posts p
where not p.is_hidden and public.is_verified();

create view public.post_comments as
select
  c.id,
  c.post_id,
  c.body,
  c.alias_no,
  c.alias_no = 0 as is_op,
  c.author_id = (select auth.uid()) as is_mine,
  c.created_at
from public.comments c
join public.posts p on p.id = c.post_id
where not c.is_hidden and not p.is_hidden and public.is_verified();

revoke all on public.feed_posts, public.post_comments from anon, authenticated;
grant select on public.feed_posts, public.post_comments to authenticated;
