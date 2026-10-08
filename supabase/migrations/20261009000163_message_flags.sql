-- Server-side auto-flagging of chat messages (scam signals), for the "Flagged" tab of the admin
-- panel. A port of the client heuristic src/features/safety/risk.ts (phone, link, messenger,
-- money) plus a keyword list moderators edit. It never blocks or changes a message: the trigger
-- only records flags, and any error inside it is swallowed.
--
-- False positives are kept low by scoring, not by flagging less: a user's rolling risk score
-- counts each signal once per conversation over the last 14 days (the same phone number sent to
-- one person is one signal; sent to five people it is five), with weights
--   phone 3, messenger 3, link 2, money 1, keyword: its own weight (default 3).
-- The Flagged tab lists users at or above public.risk_score_threshold() (8).
--
-- Flags store no message text (only the kind and, for keywords, the moderator's own keyword).
-- Reading the messages themselves still requires an open report (20261009000162).

create table public.risk_keywords (
  id         uuid primary key default gen_random_uuid(),
  keyword    text not null unique check (keyword ~ '^\S(.*\S)?$' and char_length(keyword) between 3 and 60),
  weight     smallint not null default 3 check (weight between 1 and 10),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.message_flags (
  message_id      uuid not null,
  source          text not null check (source in ('chat', 'random')),
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  -- matches.id for 'chat', random_chat_sessions.id for 'random'
  conversation_id uuid not null,
  kind            text not null check (kind in ('phone', 'link', 'messenger', 'money', 'keyword')),
  keyword         text,
  created_at      timestamptz not null default now(),
  primary key (message_id, kind)
);

create index message_flags_sender_idx on public.message_flags (sender_id, created_at desc);
create index message_flags_created_idx on public.message_flags (created_at);

create table public.user_risk_scores (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  score         int not null,
  flags         int not null,
  conversations int not null,
  kinds         jsonb not null default '{}',
  last_flag_at  timestamptz not null,
  updated_at    timestamptz not null default now()
);

create index user_risk_scores_score_idx on public.user_risk_scores (score desc);

alter table public.risk_keywords enable row level security;
alter table public.message_flags enable row level security;
alter table public.user_risk_scores enable row level security;
revoke all on public.risk_keywords, public.message_flags, public.user_risk_scores
  from anon, authenticated;

create function public.risk_score_threshold()
returns int
language sql
immutable
set search_path = ''
as $$ select 8 $$;

create function public.risk_kind_weight(p_kind text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_kind when 'phone' then 3 when 'messenger' then 3 when 'link' then 2
    when 'money' then 1 else 3 end;
$$;

-- Lower-case words separated by single spaces, padded: ' pinjam duit ' (for whole-word matches).
create function public.risk_normalize(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select ' ' || btrim(regexp_replace(lower(normalize(coalesce(p_text, ''), nfkc)),
    '[[:space:][:punct:]]+', ' ', 'g')) || ' ';
$$;

-- Same signals as detectRisk() in src/features/safety/risk.ts (\b is \y in Postgres regexes).
create function public.detect_message_risk(p_text text)
returns table (kind text, keyword text)
language plpgsql
stable
set search_path = ''
as $$
declare
  t text := lower(normalize(coalesce(p_text, ''), nfkc));
  run text;
  words text;
begin
  if btrim(t) = '' then
    return;
  end if;

  for run in select (regexp_matches(t, '\+?\d[\d\s.()-]{6,}\d', 'g'))[1] loop
    if char_length(regexp_replace(run, '\D', '', 'g')) between 9 and 15 then
      kind := 'phone'; keyword := null; return next;
      exit;
    end if;
  end loop;

  if t ~ ('\yhttps?://|\ywww\.|\y(?:t\.me|wa\.me|bit\.ly|tinyurl\.com|linktr\.ee)\y'
       || '|\y[a-z0-9-]{2,}\.(?:com|net|org|io|me|ly|co|my|xyz|app|link|site|info|biz|cc|top|vip'
       || '|shop|online|club|live|pro)\y') then
    kind := 'link'; keyword := null; return next;
  end if;

  if t ~ array_to_string(array[
       'whats\s*app', 'what\s*sap+', 'wh?at?sap+', 'was+ap+', 'whtsap+', 'telegram',
       'tele\s*(?:me|id)', '\ytg\y', 'we\s*chat', 'weixin', '\yline\s*(?:id|me|app)\y',
       '\y(?:add|pm|dm|msg|text)\s+(?:me\s+)?(?:on|in|kat|dekat)\s+line\y', '\ysignal\s+app\y',
       'viber', 'kakao', 'snap\s*chat', '\ycall\s+me\s+(?:on|at)\y', '(?:^|\s)@[a-z0-9_.]{4,}'
     ], '|') then
    kind := 'messenger'; keyword := null; return next;
  end if;

  if t ~ array_to_string(array[
       'money', 'cash', '\ybank', 'account\s*(?:no|number)', '\yacc\s*no\y', 'transfer', 'crypto',
       'bitcoin', '\ybtc\y', '\yeth\y', 'usdt', 'binance', 'forex', 'invest', 'trading',
       '\ytrade\y', '\yprofit', '\yroi\y', '\yloan', '\ylend\y', 'borrow', 'deposit', 'withdraw',
       'gift\s*card', 'western\s*union', 'paypal', 'e-?wallet', 'duitnow', '\ytng\y',
       'touch\s*[''n&]*\s*go', 'grab\s*pay', 'boost\s*(?:app|wallet)',
       '\yduit\y', '\ywang\y', '\ypinjam', 'hutang', 'pelaburan', 'melabur', '\yuntung\y',
       '\ymodal\y', '\yakaun\y', '\ybayar(?:an)?\y', '\ykripto', '\ysaham\y',
       '\yrm\s?\d', '\$\s?\d', '\y(?:usd|myr)\s?\d'
     ], '|') then
    kind := 'money'; keyword := null; return next;
  end if;

  words := public.risk_normalize(p_text);
  select k.keyword into keyword
  from public.risk_keywords k
  where strpos(words, public.risk_normalize(k.keyword)) > 0
  order by k.weight desc, k.keyword
  limit 1;
  if keyword is not null then
    kind := 'keyword'; return next;
  end if;
end;
$$;

-- Recomputes one user's rolling score from their flags of the last 14 days.
create function public.refresh_user_risk(p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  result int;
begin
  with recent as (
    select f.kind, f.conversation_id, f.keyword, f.created_at
    from public.message_flags f
    where f.sender_id = p_user and f.created_at > now() - interval '14 days'
  ),
  signals as (
    select r.kind, r.conversation_id,
      max(case when r.kind = 'keyword' then coalesce(k.weight, 3)
               else public.risk_kind_weight(r.kind) end) as weight
    from recent r
    left join public.risk_keywords k on k.keyword = r.keyword
    group by r.kind, r.conversation_id
  ),
  totals as (
    select
      (select coalesce(sum(weight), 0)::int from signals) as score,
      (select count(*)::int from recent) as flags,
      (select count(distinct conversation_id)::int from recent) as conversations,
      (select coalesce(jsonb_object_agg(kind, n), '{}') from (
        select kind, count(*)::int as n from recent group by kind) x) as kinds,
      (select max(created_at) from recent) as last_flag_at
  )
  insert into public.user_risk_scores as s
    (user_id, score, flags, conversations, kinds, last_flag_at, updated_at)
  select p_user, t.score, t.flags, t.conversations, t.kinds, t.last_flag_at, now()
  from totals t
  where t.last_flag_at is not null
  on conflict (user_id) do update
  set score = excluded.score, flags = excluded.flags, conversations = excluded.conversations,
      kinds = excluded.kinds, last_flag_at = excluded.last_flag_at, updated_at = now()
  returning s.score into result;

  if result is null then
    delete from public.user_risk_scores where user_id = p_user;
  end if;
  return coalesce(result, 0);
end;
$$;

create function public.flag_message_risk(
  p_message uuid, p_source text, p_sender uuid, p_conversation uuid, p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  added int;
begin
  if p_body is null or btrim(p_body) = '' then
    return;
  end if;
  insert into public.message_flags (message_id, source, sender_id, conversation_id, kind, keyword)
  select p_message, p_source, p_sender, p_conversation, d.kind, d.keyword
  from public.detect_message_risk(p_body) d
  on conflict (message_id, kind) do nothing;
  get diagnostics added = row_count;
  if added > 0 then
    perform public.refresh_user_risk(p_sender);
  end if;
exception
  -- Flagging must never stop a message from being sent or edited.
  when others then
    raise warning 'flag_message_risk: %', sqlerrm;
end;
$$;

create function public.messages_flag_risk()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'messages' then
    if tg_op = 'UPDATE' and new.body is not distinct from old.body then
      return null;
    end if;
    perform public.flag_message_risk(new.id, 'chat', new.sender_id, new.match_id, new.body);
  else
    perform public.flag_message_risk(new.id, 'random', new.sender_id, new.session_id, new.body);
  end if;
  return null;
end;
$$;

create trigger messages_flag_risk
  after insert or update of body on public.messages
  for each row execute function public.messages_flag_risk();

create trigger random_chat_messages_flag_risk
  after insert on public.random_chat_messages
  for each row execute function public.messages_flag_risk();

-- Users at or above the threshold whose last flag is within the rolling window, highest first.
create function public.admin_flagged_users(
  p_admin     uuid,
  p_min_score int default null,
  p_limit     int default 50,
  p_offset    int default 0
)
returns table (
  user_id       uuid,
  display_name  text,
  username      text,
  score         int,
  flags         int,
  conversations int,
  kinds         jsonb,
  last_flag_at  timestamptz,
  banned        boolean,
  open_reports  int,
  total         bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_admin_role(p_admin, 'viewer');
  return query
  select s.user_id, p.display_name, p.username, s.score, s.flags, s.conversations, s.kinds,
    s.last_flag_at, p.banned_at is not null,
    (select count(*)::int from public.reports r where r.subject_id = s.user_id and r.resolved_at is null),
    count(*) over ()
  from public.user_risk_scores s
  join public.profiles p on p.id = s.user_id
  where s.score >= coalesce(p_min_score, public.risk_score_threshold())
    and s.last_flag_at > now() - interval '14 days'
  order by s.score desc, s.last_flag_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create function public.admin_add_risk_keyword(p_admin uuid, p_keyword text, p_weight int default 3)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  kw text := btrim(regexp_replace(lower(normalize(coalesce(p_keyword, ''), nfkc)), '\s+', ' ', 'g'));
  new_id uuid;
begin
  perform public.assert_admin(p_admin);
  insert into public.risk_keywords (keyword, weight, created_by)
  values (kw, coalesce(p_weight, 3), p_admin)
  on conflict (keyword) do update set weight = excluded.weight
  returning id into new_id;
  perform public.log_moderation(p_admin, 'risk_keyword.add', 'risk_keyword', new_id,
    format('%s (%s)', kw, coalesce(p_weight, 3)));
  return new_id;
end;
$$;

create function public.admin_remove_risk_keyword(p_admin uuid, p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  kw text;
begin
  perform public.assert_admin(p_admin);
  delete from public.risk_keywords where id = p_id returning keyword into kw;
  if kw is null then
    raise exception 'Keyword not found' using errcode = 'no_data_found';
  end if;
  perform public.log_moderation(p_admin, 'risk_keyword.remove', 'risk_keyword', p_id, kw);
end;
$$;

-- Flags are metadata about messages: purged after 90 days like the rest (CLAUDE.md retention),
-- scores whose window has passed are dropped.
create function public.purge_old_message_flags()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.message_flags where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  delete from public.user_risk_scores where last_flag_at < now() - interval '14 days';
  return n;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'detect_message_risk(text)',
    'refresh_user_risk(uuid)',
    'flag_message_risk(uuid, text, uuid, uuid, text)',
    'messages_flag_risk()',
    'purge_old_message_flags()',
    'admin_flagged_users(uuid, int, int, int)',
    'admin_add_risk_keyword(uuid, text, int)',
    'admin_remove_risk_keyword(uuid, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
  foreach fn in array array[
    'detect_message_risk(text)',
    'purge_old_message_flags()',
    'admin_flagged_users(uuid, int, int, int)',
    'admin_add_risk_keyword(uuid, text, int)',
    'admin_remove_risk_keyword(uuid, uuid)'
  ] loop
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

-- Daily at 03:52 Malaysia time (19:52 UTC), only where pg_cron exists (see 20261008000022).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-old-message-flags', '52 19 * * *',
      'select public.purge_old_message_flags()');
  end if;
end;
$$;
