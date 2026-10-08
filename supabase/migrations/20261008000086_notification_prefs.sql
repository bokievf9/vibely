-- Per-type push preferences (Settings → Notifications). One row per user, created on the first
-- change; no row means "everything on". Only the owner reads/writes it; the server reads it with
-- the service role before sending (src/features/push/send.ts).
create table public.notification_prefs (
  user_id      uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  new_matches  boolean not null default true,
  messages     boolean not null default true,
  likes        boolean not null default true,
  feed_replies boolean not null default true,
  random_reveal boolean not null default true,
  updated_at   timestamptz not null default now()
);

create trigger notification_prefs_set_updated_at
  before update on public.notification_prefs
  for each row execute function public.set_updated_at();

alter table public.notification_prefs enable row level security;
revoke all on public.notification_prefs from anon, authenticated;

grant select on public.notification_prefs to authenticated;
grant insert (new_matches, messages, likes, feed_replies, random_reveal)
  on public.notification_prefs to authenticated;
grant update (new_matches, messages, likes, feed_replies, random_reveal)
  on public.notification_prefs to authenticated;

create policy "notification_prefs: read own" on public.notification_prefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_prefs: create own" on public.notification_prefs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "notification_prefs: update own" on public.notification_prefs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
