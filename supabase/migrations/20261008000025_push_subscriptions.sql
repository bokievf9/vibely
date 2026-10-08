-- Web Push subscriptions, one row per browser/device. The endpoint is an unguessable capability URL
-- issued by the browser's push service; keys are needed to encrypt payloads for that device.
-- Sending happens server-side with the service role (src/features/push/send.ts).
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) between 1 and 200),
  auth       text not null check (char_length(auth) between 1 and 100),
  locale     text not null default 'en' check (locale in ('en', 'ms', 'ru')),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- No update: re-subscribing (new keys or locale) is delete + insert.
grant select, delete on public.push_subscriptions to authenticated;
grant insert (endpoint, p256dh, auth, locale) on public.push_subscriptions to authenticated;

create policy "push_subscriptions: read own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_subscriptions: create own" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
