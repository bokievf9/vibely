-- The next Blind Dating Night for the public landing page.
--
-- get_current_event() (20261009000210) is for signed-in users: it also returns room and
-- participant counts and the caller's own reminder. The landing page is static and has no
-- session, so it reads this count-free variant with the anon key: titles and times only.
create function public.get_public_event()
returns table (
  id         uuid,
  title_en   text,
  title_ms   text,
  title_ru   text,
  theme      text,
  starts_at  timestamptz,
  ends_at    timestamptz,
  status     public.event_status,
  server_now timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title_en, e.title_ms, e.title_ru, e.theme, e.starts_at, e.ends_at,
    public.event_effective_status(e), now()
  from public.scheduled_events e
  where e.status in ('scheduled', 'live') and e.ends_at > now()
  order by (public.event_effective_status(e) = 'live') desc, e.starts_at
  limit 1;
$$;

revoke execute on function public.get_public_event() from public;
grant execute on function public.get_public_event() to anon, authenticated, service_role;
