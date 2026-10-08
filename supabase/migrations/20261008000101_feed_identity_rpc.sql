-- create_post / create_comment gain p_named (default false = anonymous, the old behaviour).
-- Bodies are copied from 20261008000009_feed_rpc.sql; only the is_named column is new.
drop function public.create_post(text);
drop function public.create_comment(uuid, text);

create function public.create_post(p_body text, p_named boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.posts
      where author_id = uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many posts, try again later' using errcode = 'P0429';
  end if;

  insert into public.posts (author_id, body, is_named)
  values (uid, btrim(p_body), coalesce(p_named, false))
  returning id into new_id;
  insert into public.post_aliases (post_id, user_id, alias_no) values (new_id, uid, 0);
  return new_id;
end;
$$;

create function public.create_comment(p_post_id uuid, p_body text, p_named boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  alias smallint;
  new_id uuid;
begin
  if not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.comments
      where author_id = uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many comments, try again later' using errcode = 'P0429';
  end if;

  -- Lock the post so concurrent first comments don't race for the same alias number.
  perform 1 from public.posts where id = p_post_id and not is_hidden for update;
  if not found then
    raise exception 'Post not found' using errcode = 'no_data_found';
  end if;

  select alias_no into alias from public.post_aliases where post_id = p_post_id and user_id = uid;
  if alias is null then
    select coalesce(max(alias_no), 0) + 1 into alias from public.post_aliases where post_id = p_post_id;
    insert into public.post_aliases (post_id, user_id, alias_no) values (p_post_id, uid, alias);
  end if;

  insert into public.comments (post_id, author_id, alias_no, body, is_named)
  values (p_post_id, uid, alias, btrim(p_body), coalesce(p_named, false))
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.create_post(text, boolean) from public, anon;
revoke execute on function public.create_comment(uuid, text, boolean) from public, anon;
grant execute on function public.create_post(text, boolean) to authenticated;
grant execute on function public.create_comment(uuid, text, boolean) to authenticated;

-- Server-only (service role, after a comment was created): returns the post author to notify,
-- or null when nobody should be notified: own post, blocked pair, inactive author, or a push for
-- this post was already sent in the last 10 minutes. Claiming is atomic, so concurrent comments
-- produce at most one push.
create function public.claim_comment_push(p_comment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  commenter uuid;
  post uuid;
  author uuid;
begin
  select c.author_id, c.post_id into commenter, post
  from public.comments c where c.id = p_comment_id and not c.is_hidden;
  if post is null then
    return null;
  end if;

  update public.posts p
  set last_comment_push_at = now()
  where p.id = post
    and not p.is_hidden
    and p.author_id <> commenter
    and (p.last_comment_push_at is null or p.last_comment_push_at < now() - interval '10 minutes')
    and exists (select 1 from public.profiles pr where pr.id = p.author_id and pr.is_active)
    and not public.is_blocked_between(p.author_id, commenter)
  returning p.author_id into author;
  return author;
end;
$$;

revoke execute on function public.claim_comment_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_comment_push(uuid) to service_role;
