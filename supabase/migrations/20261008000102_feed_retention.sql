-- Feed retention (CLAUDE.md protocol): posts and comments are kept for 90 days, then deleted.
-- Exception: anything under an open (unresolved) report stays until the case is resolved,
-- together with its context (a reported comment keeps its post; a reported post keeps its comments).
create index posts_created_idx on public.posts (created_at);
create index comments_created_idx on public.comments (created_at);

-- Returns the number of deleted posts + comments. Likes and aliases go with their post (cascade).
create function public.purge_old_feed_content()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - interval '90 days';
  deleted_comments integer;
  deleted_posts integer;
begin
  delete from public.comments c
  where c.created_at < cutoff
    and not exists (
      select 1 from public.reports r
      where r.resolved_at is null
        and ((r.target_type = 'comment' and r.target_id = c.id)
          or (r.target_type = 'post' and r.target_id = c.post_id))
    );
  get diagnostics deleted_comments = row_count;

  delete from public.posts p
  where p.created_at < cutoff
    and not exists (
      select 1 from public.reports r
      where r.resolved_at is null and r.target_type = 'post' and r.target_id = p.id
    )
    and not exists (
      select 1 from public.comments c
      join public.reports r
        on r.resolved_at is null and r.target_type = 'comment' and r.target_id = c.id
      where c.post_id = p.id
    );
  get diagnostics deleted_posts = row_count;

  return deleted_comments + deleted_posts;
end;
$$;

revoke execute on function public.purge_old_feed_content() from public, anon, authenticated;

-- Daily at 03:27 Malaysia time (19:27 UTC), only where pg_cron is available (Supabase has it,
-- the local test database doesn't). cron.schedule with a job name replaces an existing job.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'purge-old-feed-content',
      '27 19 * * *',
      'select public.purge_old_feed_content()'
    );
  end if;
end;
$$;
