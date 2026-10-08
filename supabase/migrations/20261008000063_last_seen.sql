-- "online" / "last seen" in match chats, with a Telegram-like privacy switch.
--
-- last_active_at is no longer readable by clients: it is exposed only to match partners through
-- match_partner_last_seen(), and only when BOTH users share their last seen (hide it and you
-- don't see others' either). Discovery RPCs keep ordering by it internally.
alter table public.profiles add column show_last_seen boolean not null default true;

revoke select (last_active_at) on public.profiles from authenticated;
grant select (show_last_seen) on public.profiles to authenticated;
grant update (show_last_seen) on public.profiles to authenticated;

-- Heartbeat while the app is open. Throttled in the database as well, so a chatty client can't
-- turn it into a write per request.
create function public.touch_last_active()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_active_at = now()
  where id = (select auth.uid()) and last_active_at < now() - interval '30 seconds';
$$;

-- The partner's last activity in a match, or null when either side hides it or the partner is
-- not visible (blocked, banned, deactivated).
create function public.match_partner_last_seen(p_match uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select partner.last_active_at
  from public.matches m
  join public.profiles me on me.id = (select auth.uid())
  join public.profiles partner
    on partner.id = case when m.user_a = me.id then m.user_b else m.user_a end
  where m.id = p_match
    and me.id in (m.user_a, m.user_b)
    and me.show_last_seen
    and partner.show_last_seen
    and public.can_view_profile(partner.id);
$$;

revoke execute on function public.touch_last_active() from public, anon;
revoke execute on function public.match_partner_last_seen(uuid) from public, anon;
grant execute on function public.touch_last_active() to authenticated;
grant execute on function public.match_partner_last_seen(uuid) to authenticated;
