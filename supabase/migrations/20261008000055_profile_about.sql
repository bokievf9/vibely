-- Optional, structured "about me" fields: conversation starters on the profile.
-- All nullable; the owner edits them, viewers read them under `can_view_profile` (RLS on profiles).
create type public.relationship_goal as enum
  ('serious', 'long_term_open', 'casual', 'friends', 'not_sure');
create type public.education_level as enum
  ('secondary', 'diploma', 'bachelor', 'master', 'phd', 'other');
create type public.spoken_language as enum (
  'malay', 'english', 'mandarin', 'cantonese', 'hokkien', 'tamil',
  'hindi', 'arabic', 'korean', 'japanese', 'russian', 'other'
);
create type public.religion as enum (
  'islam', 'buddhism', 'christianity', 'hinduism', 'taoism', 'sikhism',
  'other', 'none', 'prefer_not_to_say'
);
create type public.habit_frequency as enum ('never', 'sometimes', 'often');
create type public.pets_status as enum ('none', 'cat', 'dog', 'both', 'other');
create type public.children_plan as enum ('have', 'want', 'dont_want', 'not_sure');

-- True when an array has no repeated (and no null) elements. Used by CHECK constraints.
create function public.array_is_distinct(arr anyarray)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select array_position(arr, null) is null
     and cardinality(arr) = (select count(distinct x) from unnest(arr) as x);
$$;

alter table public.profiles
  add column relationship_goal public.relationship_goal,
  add column height_cm smallint check (height_cm between 140 and 220),
  add column job_title text check (char_length(btrim(job_title)) between 1 and 60),
  add column education public.education_level,
  add column languages public.spoken_language[]
    check (cardinality(languages) between 1 and 6 and public.array_is_distinct(languages)),
  add column religion public.religion,
  add column smoking public.habit_frequency,
  add column drinking public.habit_frequency,
  add column pets public.pets_status,
  add column children public.children_plan;

comment on column public.profiles.religion is
  'PDPA sensitive personal data. Optional, set by the user and only shown on their profile. '
  'Never use it for matching, filtering, ranking, analytics, notifications or ads.';

-- Same column-grant pattern as 20261008000004: readable by viewers (RLS decides which rows),
-- writable by the owner only (the "profiles: update own" policy). Not set during onboarding.
grant select (
  relationship_goal, height_cm, job_title, education, languages,
  religion, smoking, drinking, pets, children
) on public.profiles to authenticated;
grant update (
  relationship_goal, height_cm, job_title, education, languages,
  religion, smoking, drinking, pets, children
) on public.profiles to authenticated;
