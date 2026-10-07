-- The project started with a hand-made draft schema (profiles, posts, swipes, random_chat_sessions)
-- that conflicts with ours. Drop it, but only while it holds no data: any row aborts the migration.
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['profiles', 'posts', 'swipes', 'random_chat_sessions'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        raise exception 'Draft table public.% has % rows; refusing to drop it', t, n;
      end if;
    end if;
  end loop;
end;
$$;

drop table if exists public.swipes, public.posts, public.random_chat_sessions, public.profiles cascade;
