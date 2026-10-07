create function public.create_post(p_body text)
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

  insert into public.posts (author_id, body) values (uid, btrim(p_body)) returning id into new_id;
  insert into public.post_aliases (post_id, user_id, alias_no) values (new_id, uid, 0);
  return new_id;
end;
$$;

create function public.create_comment(p_post_id uuid, p_body text)
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

  insert into public.comments (post_id, author_id, alias_no, body)
  values (p_post_id, uid, alias, btrim(p_body))
  returning id into new_id;
  return new_id;
end;
$$;

-- Returns the new like state.
create function public.toggle_post_like(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if not public.is_verified() then
    raise exception 'Verification required' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.posts where id = p_post_id and not is_hidden) then
    raise exception 'Post not found' using errcode = 'no_data_found';
  end if;

  delete from public.post_likes where post_id = p_post_id and user_id = uid;
  if found then
    return false;
  end if;
  insert into public.post_likes (post_id, user_id) values (p_post_id, uid);
  return true;
end;
$$;

create function public.delete_post(p_post_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.posts where id = p_post_id and author_id = (select auth.uid());
$$;

create function public.delete_comment(p_comment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.comments where id = p_comment_id and author_id = (select auth.uid());
$$;

revoke execute on function public.create_post(text) from public, anon;
revoke execute on function public.create_comment(uuid, text) from public, anon;
revoke execute on function public.toggle_post_like(uuid) from public, anon;
revoke execute on function public.delete_post(uuid) from public, anon;
revoke execute on function public.delete_comment(uuid) from public, anon;
grant execute on function public.create_post(text) to authenticated;
grant execute on function public.create_comment(uuid, text) to authenticated;
grant execute on function public.toggle_post_like(uuid) to authenticated;
grant execute on function public.delete_post(uuid) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;
