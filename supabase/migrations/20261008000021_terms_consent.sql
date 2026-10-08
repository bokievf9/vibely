-- PDPA consent: when the user accepted the Terms of Use and Privacy Policy (and confirmed 18+).
-- Set once at sign-up; profiles created before this column stay null.
alter table public.profiles add column terms_accepted_at timestamptz;

-- The server clock is authoritative: a client can say "accepted" but cannot backdate it.
create function public.profiles_stamp_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.terms_accepted_at is not null then
    new.terms_accepted_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_stamp_terms
  before insert on public.profiles
  for each row execute function public.profiles_stamp_terms();

revoke execute on function public.profiles_stamp_terms() from public, anon, authenticated;

-- Insert-only for clients (no update grant).
grant insert (terms_accepted_at) on public.profiles to authenticated;
