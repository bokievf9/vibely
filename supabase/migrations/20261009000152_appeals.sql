-- Appeals (batch-4): a banned user can ask for a review from the /banned page.
-- One open appeal at a time, at most 3 per 30 days (SQLSTATE P0429 like the other rate limits).
-- Decided in /admin/appeals: accepting lifts the ban (admin, like any unban), rejecting needs a
-- moderator. Both are logged in moderation_actions.
create table public.appeals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- What is appealed: the ban as it was when the appeal was filed.
  sanction      text not null default 'ban' check (sanction in ('ban')),
  sanction_at   timestamptz,
  sanction_reason text,
  body          text not null check (char_length(btrim(body)) between 10 and 1000),
  status        text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_at    timestamptz not null default now(),
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  decision_note text check (char_length(decision_note) <= 1000),
  check ((status = 'open') = (decided_at is null))
);

create unique index appeals_one_open_idx on public.appeals (user_id) where status = 'open';
create index appeals_queue_idx on public.appeals (created_at) where status = 'open';
create index appeals_user_recent_idx on public.appeals (user_id, created_at desc);

alter table public.appeals enable row level security;
revoke all on public.appeals from anon, authenticated;

create function public.submit_appeal(p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  p public.profiles;
  a uuid;
begin
  select * into p from public.profiles where id = me;
  if p.id is null or p.banned_at is null then
    raise exception 'Only a banned account can appeal' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 10 and 1000 then
    raise exception 'Appeal text must be 10..1000 characters' using errcode = '23514';
  end if;
  if exists (select 1 from public.appeals where user_id = me and status = 'open') then
    raise exception 'An appeal is already open' using errcode = '23505';
  end if;
  if (select count(*) from public.appeals
      where user_id = me and created_at > now() - interval '30 days') >= 3 then
    raise exception 'Rate limit exceeded: at most 3 appeals per 30 days' using errcode = 'P0429';
  end if;
  insert into public.appeals (user_id, sanction_at, sanction_reason, body)
  values (me, p.banned_at, p.ban_reason, btrim(p_body))
  returning id into a;
  return a;
end;
$$;

-- The caller's latest appeal (status only, never who decided).
create function public.my_appeal()
returns table (id uuid, status text, created_at timestamptz, decided_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.status, a.created_at, a.decided_at
  from public.appeals a
  where a.user_id = (select auth.uid())
  order by a.created_at desc
  limit 1;
$$;

create function public.admin_decide_appeal(p_admin uuid, p_appeal uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  a public.appeals;
begin
  perform public.assert_admin_role(p_admin,
    case when p_accept then 'admin' else 'moderator' end::public.admin_role);
  if not p_accept and nullif(btrim(p_note), '') is null then
    raise exception 'A rejection needs a note' using errcode = 'check_violation';
  end if;
  update public.appeals
  set status = case when p_accept then 'accepted' else 'rejected' end,
      decided_by = p_admin, decided_at = now(), decision_note = nullif(btrim(p_note), '')
  where id = p_appeal and status = 'open'
  returning * into a;
  if a.id is null then
    raise exception 'Appeal is not open' using errcode = 'no_data_found';
  end if;

  if p_accept then
    update public.profiles
    set banned_at = null, ban_reason = null, banned_until = null, is_active = true
    where id = a.user_id and banned_at is not null;
    if found then
      perform public.log_moderation(p_admin, 'user.unban', 'user', a.user_id, 'Апелляция принята');
    end if;
  end if;
  perform public.log_moderation(p_admin, case when p_accept then 'appeal.accept' else 'appeal.reject' end,
    'user', a.user_id, p_note);
end;
$$;

revoke execute on function public.submit_appeal(text) from public, anon;
revoke execute on function public.my_appeal() from public, anon;
grant execute on function public.submit_appeal(text) to authenticated;
grant execute on function public.my_appeal() to authenticated;
revoke execute on function public.admin_decide_appeal(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_decide_appeal(uuid, uuid, boolean, text) to service_role;
