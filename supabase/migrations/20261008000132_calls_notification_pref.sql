-- Integration (calls + settings): incoming-call pushes get their own notification preference.
alter table public.notification_prefs add column calls boolean not null default true;
grant insert (calls), update (calls) on public.notification_prefs to authenticated;
