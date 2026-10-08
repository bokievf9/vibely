-- Feed identity: every post and comment is either anonymous (default) or "as me" (is_named).
-- Anonymous rows get a lively per-thread pseudonym ("Purple Durian") instead of "Anonymous #N".
-- Views still never expose author_id for anonymous rows; named rows show the author only while the
-- viewer may see that profile (can_view_profile: approved, active/not banned, not blocked) and
-- otherwise fall back to anonymous rendering.
alter table public.posts
  add column is_named boolean not null default false,
  -- Throttles "someone replied to your post" pushes (at most one per post per 10 minutes).
  add column last_comment_push_at timestamptz;
alter table public.comments add column is_named boolean not null default false;

-- Pseudonym for alias N of a post: index into the client's word lists (24 adjectives × 20 nouns,
-- 8 colors). The alias number already stands for (post, author), so the result is stable within
-- a thread. The per-post offset comes from a hash of the post id, so the same person gets
-- unrelated pseudonyms on different posts. Stride 77 is coprime to 480 and 3 to 8: the first 480
-- participants of a thread get distinct names, neighbours get different colors.
-- Reveals nothing new: clients already see post_id and alias_no.
create function public.feed_pseudonym(p_post uuid, p_alias int)
returns int[]
language sql
immutable
set search_path = ''
as $$
  with h as (
    select ('x' || substr(md5(p_post::text), 1, 8))::bit(32)::bigint as v
  ), i as (
    select ((v % 480) + p_alias::bigint * 77) % 480 as idx, ((v / 480) + p_alias::bigint * 3) % 8 as color
    from h
  )
  select array[(idx / 20)::int, (idx % 20)::int, color::int] from i;
$$;

revoke execute on function public.feed_pseudonym(uuid, int) from public, anon;
grant execute on function public.feed_pseudonym(uuid, int) to authenticated;

-- Viewer's city, normalised; null when unknown.
create function public.feed_viewer_city()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(lower(btrim(city)), '') from public.profiles where id = (select auth.uid());
$$;

revoke execute on function public.feed_viewer_city() from public, anon;
grant execute on function public.feed_viewer_city() to authenticated;

drop view public.post_comments;
drop view public.feed_posts;

-- Owner-rights views (as before): they read closed tables and filter for the caller themselves.
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
  ) as is_liked_by_me,
  a.visible as is_named,
  case when a.visible then p.author_id end as author_id,
  case when a.visible then pr.display_name end as author_name,
  case when a.visible then public.age_in_years(pr.birth_date) end as author_age,
  case when a.visible then pr.verification_status = 'approved' end as author_verified,
  case when a.visible then ph.storage_path end as author_photo_path,
  case when not a.visible then ps.v[1] end as anon_adj,
  case when not a.visible then ps.v[2] end as anon_noun,
  case when not a.visible then ps.v[3] end as anon_color,
  -- Only the match is exposed, never the author's city.
  coalesce(nullif(lower(btrim(pr.city)), '') = public.feed_viewer_city(), false) as same_city,
  p.likes_count + p.comments_count as engagement
from public.posts p
join public.profiles pr on pr.id = p.author_id
cross join lateral (
  select p.is_named and public.can_view_profile(p.author_id) as visible
) a
cross join lateral (select public.feed_pseudonym(p.id, 0) as v) ps
left join lateral (
  select f.storage_path from public.profile_photos f
  where f.profile_id = p.author_id and a.visible
  order by f.position
  limit 1
) ph on true
where not p.is_hidden and public.is_verified();

create view public.post_comments as
select
  c.id,
  c.post_id,
  c.body,
  -- A named comment hides its alias: otherwise it would unmask the same person's anonymous
  -- comments in the thread. It is marked as the OP's only when the post itself shows the author.
  case when not a.visible then c.alias_no end as alias_no,
  c.alias_no = 0 and (not a.visible or (p.is_named and public.can_view_profile(p.author_id))) as is_op,
  c.author_id = (select auth.uid()) as is_mine,
  c.created_at,
  a.visible as is_named,
  case when a.visible then c.author_id end as author_id,
  case when a.visible then pr.display_name end as author_name,
  case when a.visible then public.age_in_years(pr.birth_date) end as author_age,
  case when a.visible then pr.verification_status = 'approved' end as author_verified,
  case when a.visible then ph.storage_path end as author_photo_path,
  case when not a.visible then ps.v[1] end as anon_adj,
  case when not a.visible then ps.v[2] end as anon_noun,
  case when not a.visible then ps.v[3] end as anon_color
from public.comments c
join public.posts p on p.id = c.post_id
join public.profiles pr on pr.id = c.author_id
cross join lateral (
  select c.is_named and public.can_view_profile(c.author_id) as visible
) a
cross join lateral (select public.feed_pseudonym(c.post_id, c.alias_no) as v) ps
left join lateral (
  select f.storage_path from public.profile_photos f
  where f.profile_id = c.author_id and a.visible
  order by f.position
  limit 1
) ph on true
where not c.is_hidden and not p.is_hidden and public.is_verified();

revoke all on public.feed_posts, public.post_comments from anon, authenticated;
grant select on public.feed_posts, public.post_comments to authenticated;
