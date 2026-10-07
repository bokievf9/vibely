-- Moderation RPCs. Called only from the admin panel with the service role, which first
-- authenticates the moderator; each function re-checks p_admin against public.admins.
create function public.assert_admin(p_admin uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins where user_id = p_admin) then
    raise exception 'Not a moderator' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create function public.log_moderation(p_admin uuid, p_action text, p_type text, p_target uuid, p_reason text)
returns void
language sql
set search_path = ''
as $$
  insert into public.moderation_actions (admin_id, action, target_type, target_id, reason)
  values (p_admin, p_action, p_type, p_target, nullif(btrim(p_reason), ''));
$$;

create function public.admin_review_verification(
  p_admin uuid, p_request uuid, p_approve boolean, p_reason text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin(p_admin);
  if not p_approve and nullif(btrim(p_reason), '') is null then
    raise exception 'Rejection reason required' using errcode = 'check_violation';
  end if;

  update public.verification_requests
  set status = case when p_approve then 'approved' else 'rejected' end::public.verification_status,
      reviewer_id = p_admin,
      rejection_reason = case when p_approve then null else btrim(p_reason) end,
      reviewed_at = now()
  where id = p_request and status = 'pending';
  if not found then
    raise exception 'Request is not pending' using errcode = 'no_data_found';
  end if;

  perform public.log_moderation(p_admin, case when p_approve then 'verification.approve'
    else 'verification.reject' end, 'verification_request', p_request, p_reason);
end;
$$;

-- Forces the user to pass selfie verification again.
create function public.admin_revoke_verification(p_admin uuid, p_user uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin(p_admin);
  update public.profiles set verification_status = 'unverified' where id = p_user;
  perform public.log_moderation(p_admin, 'user.revoke_verification', 'user', p_user, p_reason);
end;
$$;

create function public.admin_set_ban(p_admin uuid, p_user uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin(p_admin);
  if p_banned and nullif(btrim(p_reason), '') is null then
    raise exception 'Ban reason required' using errcode = 'check_violation';
  end if;

  update public.profiles
  set banned_at = case when p_banned then now() end,
      ban_reason = case when p_banned then btrim(p_reason) end,
      is_active = not p_banned
  where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;

  if p_banned then
    delete from public.random_chat_queue where user_id = p_user;
    update public.random_chat_sessions set status = 'ended', ended_at = now()
    where status = 'active' and p_user in (user_a, user_b);
  end if;

  perform public.log_moderation(p_admin, case when p_banned then 'user.ban' else 'user.unban' end,
    'user', p_user, p_reason);
end;
$$;

create function public.admin_set_content_hidden(
  p_admin uuid, p_type public.report_target, p_id uuid, p_hidden boolean, p_reason text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_admin(p_admin);
  if p_type = 'post' then
    update public.posts set is_hidden = p_hidden where id = p_id;
  elsif p_type = 'comment' then
    update public.comments set is_hidden = p_hidden where id = p_id;
  else
    raise exception 'Only posts and comments can be hidden' using errcode = 'check_violation';
  end if;
  if not found then
    raise exception 'Content not found' using errcode = 'no_data_found';
  end if;

  perform public.log_moderation(p_admin,
    p_type::text || case when p_hidden then '.hide' else '.unhide' end, p_type::text, p_id, p_reason);
end;
$$;

-- Closes every open report on the same target at once.
create function public.admin_resolve_reports(
  p_admin uuid, p_type public.report_target, p_target uuid, p_resolution text
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  closed int;
begin
  perform public.assert_admin(p_admin);
  update public.reports
  set resolved_at = now(), resolved_by = p_admin, resolution = nullif(btrim(p_resolution), '')
  where target_type = p_type and target_id = p_target and resolved_at is null;
  get diagnostics closed = row_count;

  perform public.log_moderation(p_admin, 'reports.resolve', p_type::text, p_target, p_resolution);
  return closed;
end;
$$;

-- User search for the admin panel. SECURITY DEFINER to read the phone from auth.users,
-- which the service role can't select directly.
create function public.admin_find_users(p_admin uuid, p_query text default '', p_limit int default 50)
returns table (
  id uuid, display_name text, phone text, verification_status public.verification_status,
  banned_at timestamptz, created_at timestamptz, open_reports bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin(p_admin);
  return query
  select p.id, p.display_name, u.phone::text, p.verification_status, p.banned_at, p.created_at,
    (select count(*) from public.reports r
     where r.target_type = 'user' and r.target_id = p.id and r.resolved_at is null)
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(btrim(p_query), '') = ''
     or p.display_name ilike '%' || btrim(p_query) || '%'
     or u.phone like '%' || regexp_replace(p_query, '\D', '', 'g') || '%'
        and regexp_replace(p_query, '\D', '', 'g') <> ''
     or p.id::text = btrim(p_query)
  order by p.created_at desc
  limit least(200, greatest(1, p_limit));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'assert_admin(uuid)',
    'log_moderation(uuid, text, text, uuid, text)',
    'admin_review_verification(uuid, uuid, boolean, text)',
    'admin_revoke_verification(uuid, uuid, text)',
    'admin_set_ban(uuid, uuid, boolean, text)',
    'admin_set_content_hidden(uuid, public.report_target, uuid, boolean, text)',
    'admin_resolve_reports(uuid, public.report_target, uuid, text)',
    'admin_find_users(uuid, text, int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
