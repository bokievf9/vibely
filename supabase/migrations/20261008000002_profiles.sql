-- Phone number lives only in auth.users; it is never copied here.
create table public.profiles (
  id                  uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name        text not null check (char_length(display_name) between 2 and 40),
  birth_date          date not null check (birth_date > date '1900-01-01'),
  gender              public.gender not null,
  interested_in       public.gender[] not null check (cardinality(interested_in) between 1 and 3),
  bio                 text check (char_length(bio) <= 500),
  location            extensions.geography(point, 4326),
  city                text check (char_length(city) <= 80),
  verification_status public.verification_status not null default 'unverified',
  is_active           boolean not null default true,
  last_active_at      timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index profiles_location_idx on public.profiles using gist (location);
create index profiles_discoverable_idx on public.profiles (gender, last_active_at desc)
  where verification_status = 'approved' and is_active;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 18+ only. A CHECK constraint can't depend on current_date, so validate in a trigger.
create function public.profiles_enforce_adult()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.age_in_years(new.birth_date) < 18 then
    raise exception 'User must be at least 18 years old' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_adult
  before insert or update of birth_date on public.profiles
  for each row execute function public.profiles_enforce_adult();

-- Photos: width/height are stored so <Image> never causes layout shift.
create table public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  width        int not null check (width > 0),
  height       int not null check (height > 0),
  position     smallint not null check (position between 0 and 5),
  created_at   timestamptz not null default now(),
  unique (profile_id, position)
);

-- Interest tags: a fixed dictionary (seeded), up to 10 per profile.
create table public.tags (
  id    smallint generated always as identity primary key,
  slug  text not null unique check (slug ~ '^[a-z0-9-]{2,32}$'),
  label text not null
);

create table public.profile_tags (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tag_id     smallint not null references public.tags (id) on delete cascade,
  primary key (profile_id, tag_id)
);

create index profile_tags_tag_idx on public.profile_tags (tag_id);

create function public.profile_tags_enforce_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.profile_tags where profile_id = new.profile_id) >= 10 then
    raise exception 'A profile can have at most 10 tags' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profile_tags_enforce_limit
  before insert on public.profile_tags
  for each row execute function public.profile_tags_enforce_limit();

revoke execute on function public.profiles_enforce_adult() from public, anon, authenticated;
revoke execute on function public.profile_tags_enforce_limit() from public, anon, authenticated;
