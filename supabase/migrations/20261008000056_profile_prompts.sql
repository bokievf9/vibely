-- Prompts: up to three short answers to fixed questions (conversation starters).
-- Keys are translated by the client (en / ms / ru dictionaries).
create table public.profile_prompts (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  prompt_key text not null check (prompt_key in (
    'ideal_weekend', 'way_to_heart', 'mamak_order', 'weirdly_good_at',
    'two_truths_lie', 'simple_pleasures', 'lets_debate', 'perfect_first_date',
    'looking_for', 'karaoke_song', 'travel_story', 'green_flags'
  )),
  answer     text not null check (char_length(btrim(answer)) >= 1 and char_length(answer) <= 200),
  position   smallint not null check (position between 0 and 2),
  created_at timestamptz not null default now(),
  unique (profile_id, position),
  unique (profile_id, prompt_key)
);

alter table public.profile_prompts enable row level security;
revoke all on public.profile_prompts from anon, authenticated;

-- Like profile_tags: the owner replaces their prompts (delete + insert); viewers read.
grant select, delete on public.profile_prompts to authenticated;
grant insert (prompt_key, answer, position) on public.profile_prompts to authenticated;

create policy "profile_prompts: visible" on public.profile_prompts
  for select to authenticated using (public.can_view_profile(profile_id));
create policy "profile_prompts: create own" on public.profile_prompts
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "profile_prompts: delete own" on public.profile_prompts
  for delete to authenticated using (profile_id = (select auth.uid()));
