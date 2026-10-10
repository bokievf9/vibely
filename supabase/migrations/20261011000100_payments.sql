-- Payments core: prices, orders, provider events and the grant they buy. Gateway independent.
--
-- Nothing here takes money. The app keeps checkout off (PAYMENTS_ENABLED = false in
-- src/features/plans/pricing.ts) until the owner picks a gateway and prices; only the 'test'
-- provider (staff, test mode) can create orders before that. See docs/payments.md.
--
--   * plan_prices: one row per paid plan and period (1, 3 or 12 months), in sen (RM 1 = 100 sen),
--     MYR only. Owner-managed (/admin/plans), every change logged. Orders snapshot the amount, so
--     changing a price never changes an order already created. An inactive price is a draft: only
--     the 'test' provider may use it.
--   * payment_orders: one-off period purchases (FPX is not recurring in Malaysia; renewal is not
--     modelled yet). Status: pending -> paid | failed | cancelled | expired; paid -> refunded.
--     A late "paid" from the gateway is honoured even after failed/cancelled/expired: the money
--     was taken, so the plan is granted. (provider, provider_ref) is unique.
--   * payment_events: every verified webhook / test event, recorded before it is processed
--     (idempotency by (provider, event_id), and an audit trail of what the gateway said). Minimal
--     payloads only: never card data.
--   * Financial records are kept: orders and events are NOT part of the 90-day safety purge, and
--     they survive account deletion (user_id is set null). The retention period is for the
--     accountant / lawyer to confirm.
--
-- Grant math (payment_mark_paid):
--   * A purchase adds a 'purchase' grant through grant_plan: it starts at the later of now and the
--     end of the user's grants of the same or a higher level (stacking, as promo codes do).
--     1 month = 30 days, 3 months = 90 days, 12 months = 365 days.
--   * Plus bought while VIP is active: starts when VIP ends (grant_plan rule).
--   * VIP bought while Plus is active: VIP starts now (or after the current VIP) and the Plus time
--     is paused, not lost: every finite Plus grant that overlaps the new VIP window is moved/extended
--     by the VIP length, so the same Plus time remains after VIP ends.
--   * Refund (admin or gateway): the purchase grant is revoked; the unused part of it (from the
--     later of now and its start, to its end) is given back to the grants queued behind it: grants
--     of the same or a lower level that start at its end move earlier by that much, and for VIP the
--     paused Plus grants are shortened by the same amount. Full refunds only (no partial refunds).
--
-- SQLSTATEs: 22023 invalid input, 42501 user not allowed, P0002 not found (no order / no price),
-- P0429 rate limit, VP409 wrong state, VP422 amount or currency does not match the order.

-- =============================================================================================
-- Tables
-- =============================================================================================
create table public.plan_prices (
  plan              public.plan_level not null check (plan <> 'free'),
  period_months     smallint not null check (period_months in (1, 3, 12)),
  currency          text not null default 'MYR' check (currency = 'MYR'),
  -- RM 1.00 .. RM 100,000.00
  amount_sen        int not null check (amount_sen between 100 and 10000000),
  active            boolean not null default false,
  -- The gateway's own price / product id, when it has one (e.g. a Stripe price id).
  provider_price_id text check (char_length(provider_price_id) <= 200),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  primary key (plan, period_months)
);

create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'expired');

create table public.payment_orders (
  id             uuid primary key default gen_random_uuid(),
  -- Set null when the account is deleted: the financial record stays.
  user_id        uuid references auth.users (id) on delete set null,
  plan           public.plan_level not null check (plan <> 'free'),
  period_months  smallint not null check (period_months in (1, 3, 12)),
  amount_sen     int not null check (amount_sen > 0),
  currency       text not null check (currency = 'MYR'),
  provider       text not null check (provider in ('stripe', 'billplz', 'ipay88', 'test')),
  -- The gateway's id for this checkout (session, bill, reference no). Null until checkout exists.
  provider_ref   text check (char_length(provider_ref) <= 200),
  checkout_url   text check (char_length(checkout_url) <= 2000),
  status         public.payment_status not null default 'pending',
  grant_id       uuid references public.plan_grants (id) on delete set null,
  -- The last gateway event, minimal (ids, status, amount). Never card data.
  raw_event      jsonb check (raw_event is null or pg_column_size(raw_event) <= 4096),
  failure_reason text check (char_length(failure_reason) <= 500),
  refund_reason  text check (char_length(refund_reason) <= 500),
  refunded_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '24 hours',
  paid_at        timestamptz,
  failed_at      timestamptz,
  refunded_at    timestamptz,
  unique (provider, provider_ref)
);

-- One pending order per user and plan (reused or cancelled by payment_create_order).
create unique index payment_orders_one_pending_idx on public.payment_orders (user_id, plan)
  where status = 'pending';
create index payment_orders_user_idx on public.payment_orders (user_id, created_at desc);
create index payment_orders_status_idx on public.payment_orders (status, created_at desc);
create index payment_orders_created_idx on public.payment_orders (created_at desc);

create table public.payment_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null check (provider in ('stripe', 'billplz', 'ipay88', 'test')),
  -- The gateway's event id (or a hash of the payload when it has none): dedupe key.
  event_id    text not null check (char_length(event_id) <= 200),
  type        text not null check (type in ('paid', 'failed', 'cancelled', 'expired', 'refunded', 'ignored')),
  provider_ref text check (char_length(provider_ref) <= 200),
  order_id    uuid references public.payment_orders (id) on delete set null,
  amount_sen  int,
  currency    text check (char_length(currency) <= 3),
  payload     jsonb check (payload is null or pg_column_size(payload) <= 4096),
  error       text check (char_length(error) <= 500),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create index payment_events_received_idx on public.payment_events (received_at desc);

-- Nobody but the security definer functions below reads or writes these.
alter table public.plan_prices enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_events enable row level security;
revoke all on public.plan_prices, public.payment_orders, public.payment_events from anon, authenticated;

-- =============================================================================================
-- Helpers
-- =============================================================================================
create function public.payment_period_days(p_months int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_months when 1 then 30 when 3 then 90 when 12 then 365 end;
$$;

create function public.payment_price_uuid(p_plan public.plan_level, p_months int)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select md5('price:' || p_plan::text || ':' || p_months::text)::uuid;
$$;

-- What the client may see of an order (no raw events, no gateway refs).
create function public.payment_order_json(o public.payment_orders)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'plan', o.plan, 'period_months', o.period_months, 'amount_sen', o.amount_sen,
    'currency', o.currency, 'provider', o.provider, 'status', o.status, 'created_at', o.created_at,
    'paid_at', o.paid_at, 'refunded_at', o.refunded_at);
$$;

-- =============================================================================================
-- Prices
-- =============================================================================================
-- Active prices, for the Plans screen (shown only when checkout is on; the app decides).
create function public.plan_prices_public()
returns table (plan text, period_months int, currency text, amount_sen int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.plan::text, p.period_months::int, p.currency, p.amount_sen
  from public.plan_prices p where p.active order by p.plan, p.period_months;
$$;

-- Every price row (drafts too), for the panel and for staff in test mode.
create function public.admin_plan_prices(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'plan', p.plan, 'period_months', p.period_months, 'currency', p.currency,
      'amount_sen', p.amount_sen, 'active', p.active, 'provider_price_id', p.provider_price_id,
      'updated_at', p.updated_at) order by p.plan, p.period_months)
    from public.plan_prices p), '[]'::jsonb);
end;
$$;

-- Owner only: money. p_amount_sen null removes the price.
create function public.admin_set_price(
  p_admin uuid,
  p_plan public.plan_level,
  p_period int,
  p_amount_sen int,
  p_active boolean default false,
  p_provider_price_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'owner');
  if p_plan is null or p_plan = 'free' or p_period is null or p_period not in (1, 3, 12) then
    raise exception 'Invalid plan or period' using errcode = 'invalid_parameter_value';
  end if;
  if p_amount_sen is null then
    delete from public.plan_prices where plan = p_plan and period_months = p_period;
    perform public.log_moderation(p_admin, 'payment.price', 'price', public.payment_price_uuid(p_plan, p_period),
      p_plan::text || ' ' || p_period || 'm removed');
    return;
  end if;
  if p_amount_sen < 100 or p_amount_sen > 10000000 then
    raise exception 'Invalid amount' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.plan_prices (plan, period_months, amount_sen, active, provider_price_id, updated_by)
  values (p_plan, p_period, p_amount_sen, coalesce(p_active, false),
          nullif(btrim(coalesce(p_provider_price_id, '')), ''), p_admin)
  on conflict (plan, period_months) do update
    set amount_sen = excluded.amount_sen, active = excluded.active,
        provider_price_id = excluded.provider_price_id, updated_by = p_admin, updated_at = now();
  perform public.log_moderation(p_admin, 'payment.price', 'price', public.payment_price_uuid(p_plan, p_period),
    p_plan::text || ' ' || p_period || 'm ' || p_amount_sen || ' sen' ||
    case when coalesce(p_active, false) then ' active' else ' draft' end);
end;
$$;

-- =============================================================================================
-- Orders
-- =============================================================================================
-- Pending orders past expires_at become 'expired' (hourly, and lazily on the next checkout).
create function public.payment_expire_stale()
returns int
language sql
security definer
set search_path = ''
as $$
  with e as (
    update public.payment_orders set status = 'expired', updated_at = now()
    where status = 'pending' and expires_at < now()
    returning 1)
  select count(*)::int from e;
$$;

-- Creates (or reuses) the user's pending order for a plan and period. The server action calls it
-- with the signed-in user's id after its own checks; the database checks again.
-- Returns the client view plus provider_ref, checkout_url and reused.
create function public.payment_create_order(p_user uuid, p_plan text, p_period int, p_provider text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  price public.plan_prices;
  o public.payment_orders;
begin
  if p_plan is null or p_plan not in ('plus', 'vip') or p_period is null or p_period not in (1, 3, 12)
     or p_provider is null or p_provider not in ('stripe', 'billplz', 'ipay88', 'test') then
    raise exception 'Invalid plan, period or provider' using errcode = 'invalid_parameter_value';
  end if;
  if p_user is null or not exists (
    select 1 from public.profiles p
    where p.id = p_user and p.verification_status = 'approved' and p.banned_at is null) then
    raise exception 'Verified account required' using errcode = 'insufficient_privilege';
  end if;
  select * into price from public.plan_prices
  where plan = p_plan::public.plan_level and period_months = p_period
    and (active or p_provider = 'test');
  if price.plan is null then
    raise exception 'No price for this plan and period' using errcode = 'no_data_found';
  end if;

  perform pg_advisory_xact_lock(hashtext('payment_order:' || p_user::text));
  update public.payment_orders set status = 'expired', updated_at = now()
  where user_id = p_user and status = 'pending' and expires_at < now();

  select * into o from public.payment_orders
  where user_id = p_user and plan = p_plan::public.plan_level and status = 'pending';
  if o.id is not null then
    if o.period_months = p_period and o.provider = p_provider and o.amount_sen = price.amount_sen
       and o.currency = price.currency then
      return public.payment_order_json(o)
        || jsonb_build_object('provider_ref', o.provider_ref, 'checkout_url', o.checkout_url, 'reused', true);
    end if;
    -- Another period or price: the old checkout is dropped. A late payment on it is still honoured.
    update public.payment_orders set status = 'cancelled', updated_at = now() where id = o.id;
  end if;

  if (select count(*) from public.payment_orders
      where user_id = p_user and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Rate limit exceeded: at most 5 checkouts per 10 minutes' using errcode = 'P0429';
  end if;

  insert into public.payment_orders (user_id, plan, period_months, amount_sen, currency, provider)
  values (p_user, p_plan::public.plan_level, p_period, price.amount_sen, price.currency, p_provider)
  returning * into o;
  return public.payment_order_json(o) || jsonb_build_object('provider_ref', null, 'checkout_url', null, 'reused', false);
end;
$$;

-- Stores the gateway's checkout id and redirect URL on a pending order (once).
create function public.payment_attach_checkout(p_order uuid, p_provider_ref text, p_checkout_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.payment_orders;
begin
  if nullif(btrim(coalesce(p_provider_ref, '')), '') is null then
    raise exception 'Provider reference required' using errcode = 'invalid_parameter_value';
  end if;
  select * into o from public.payment_orders where id = p_order for update;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;
  if o.status <> 'pending' or (o.provider_ref is not null and o.provider_ref <> p_provider_ref) then
    raise exception 'Order is not awaiting checkout' using errcode = 'VP409';
  end if;
  update public.payment_orders
  set provider_ref = p_provider_ref, checkout_url = p_checkout_url, updated_at = now()
  where id = p_order;
end;
$$;

-- Records a verified gateway event once. Returns the event id to process, or null when it was
-- already processed successfully (a re-delivery: the caller skips it). A re-delivery of an event
-- whose processing failed or never finished is returned again (processing is idempotent).
create function public.payment_record_event(
  p_provider text, p_event_id text, p_type text, p_provider_ref text,
  p_amount_sen int, p_currency text, p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eid uuid;
begin
  insert into public.payment_events (provider, event_id, type, provider_ref, order_id, amount_sen, currency, payload)
  values (p_provider, p_event_id, p_type, p_provider_ref,
          (select id from public.payment_orders where provider = p_provider and provider_ref = p_provider_ref),
          p_amount_sen, p_currency, p_payload)
  on conflict (provider, event_id) do nothing
  returning id into eid;
  if eid is null then
    select e.id into eid from public.payment_events e
    where e.provider = p_provider and e.event_id = p_event_id and (e.processed_at is null or e.error is not null);
  end if;
  return eid;
end;
$$;

-- The outcome of processing an event (error null = processed).
create function public.payment_finish_event(p_event uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payment_events set processed_at = now(), error = left(p_error, 500) where id = p_event;
$$;

-- The gateway says the order is paid. Idempotent; verifies amount and currency; grants the plan.
-- Returns {order_id, status, user_id, grant_id, plan_until, already}.
create function public.payment_mark_paid(
  p_provider text, p_provider_ref text, p_amount_sen int, p_currency text, p_event jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.payment_orders;
  g public.plan_grants;
  len interval;
begin
  select * into o from public.payment_orders
  where provider = p_provider and provider_ref = p_provider_ref for update;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;
  if o.status in ('paid', 'refunded') then
    return jsonb_build_object('order_id', o.id, 'status', o.status, 'user_id', o.user_id,
      'grant_id', o.grant_id, 'plan_until', null, 'already', true);
  end if;
  if p_amount_sen is distinct from o.amount_sen or upper(coalesce(p_currency, '')) is distinct from o.currency then
    raise exception 'Amount or currency does not match the order' using errcode = 'VP422',
      detail = format('expected %s %s, got %s %s', o.amount_sen, o.currency, p_amount_sen, p_currency);
  end if;

  if o.user_id is not null then
    perform pg_advisory_xact_lock(hashtext('plan_grant:' || o.user_id::text));
    perform public.grant_plan(o.user_id, o.plan, public.payment_period_days(o.period_months),
                              'purchase', null, 'order ' || o.id::text);
    select * into g from public.plan_grants
    where user_id = o.user_id and source = 'purchase' and note = 'order ' || o.id::text
    order by created_at desc limit 1;
    -- VIP over Plus: pause the Plus time for the length of the VIP window.
    if o.plan = 'vip' and g.ends_at is not null then
      len := g.ends_at - g.starts_at;
      update public.plan_grants
      set starts_at = case when starts_at >= g.starts_at then starts_at + len else starts_at end,
          ends_at = ends_at + len
      where user_id = o.user_id and plan = 'plus' and revoked_at is null
        and ends_at is not null and ends_at > g.starts_at;
    end if;
  end if;

  update public.payment_orders
  set status = 'paid', paid_at = now(), updated_at = now(), grant_id = g.id,
      raw_event = coalesce(p_event, raw_event), failure_reason = null
  where id = o.id;
  perform public.log_moderation(null, 'payment.paid', 'payment', o.id,
    o.plan::text || ' ' || o.period_months || 'm ' || o.amount_sen || ' ' || o.currency || ' ' || o.provider);
  return jsonb_build_object('order_id', o.id, 'status', 'paid', 'user_id', o.user_id,
    'grant_id', g.id, 'plan_until', case when o.user_id is null then null else public.plan_until(o.user_id) end,
    'already', false);
end;
$$;

-- The gateway says the payment failed, was cancelled or expired. Only a pending order changes.
-- Returns the order's status after the call.
create function public.payment_mark_failed(
  p_provider text, p_provider_ref text, p_status text default 'failed',
  p_reason text default null, p_event jsonb default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.payment_orders;
begin
  if p_status is null or p_status not in ('failed', 'cancelled', 'expired') then
    raise exception 'Invalid status' using errcode = 'invalid_parameter_value';
  end if;
  select * into o from public.payment_orders
  where provider = p_provider and provider_ref = p_provider_ref for update;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;
  if o.status <> 'pending' then
    return o.status::text;
  end if;
  update public.payment_orders
  set status = p_status::public.payment_status, updated_at = now(),
      failed_at = case when p_status = 'failed' then now() else failed_at end,
      failure_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500),
      raw_event = coalesce(p_event, raw_event)
  where id = o.id;
  return p_status;
end;
$$;

-- Refund core (internal): revokes the purchase grant and gives its unused time back to the grants
-- queued behind it (see the header). p_by null = the gateway reported it.
create function public.payment_apply_refund(p_order uuid, p_by uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.payment_orders;
  g public.plan_grants;
  unused interval := interval '0';
begin
  select * into o from public.payment_orders where id = p_order for update;
  if o.id is null then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;
  if o.status = 'refunded' then
    return jsonb_build_object('order_id', o.id, 'status', 'refunded', 'already', true);
  end if;
  if o.status <> 'paid' then
    raise exception 'Only a paid order can be refunded' using errcode = 'VP409';
  end if;

  if o.grant_id is not null then
    select * into g from public.plan_grants where id = o.grant_id;
    if g.id is not null and g.revoked_at is null then
      perform pg_advisory_xact_lock(hashtext('plan_grant:' || g.user_id::text));
      if g.ends_at is not null and g.ends_at > now() then
        unused := g.ends_at - greatest(now(), g.starts_at);
      end if;
      update public.plan_grants set revoked_at = now(), revoked_by = p_by where id = g.id;
      if unused > interval '0' then
        -- Paused Plus grants that run across the VIP window: shorten by the unused VIP time.
        if g.plan = 'vip' then
          update public.plan_grants
          set ends_at = greatest(ends_at - unused, starts_at + interval '1 second')
          where user_id = g.user_id and id <> g.id and plan = 'plus' and revoked_at is null
            and ends_at is not null and starts_at < g.ends_at and ends_at > g.ends_at;
        end if;
        -- Grants queued behind it (same or lower level): move earlier.
        update public.plan_grants
        set starts_at = starts_at - unused, ends_at = ends_at - unused
        where user_id = g.user_id and id <> g.id and plan <= g.plan and revoked_at is null
          and ends_at is not null and starts_at >= g.ends_at;
      end if;
    end if;
  end if;

  update public.payment_orders
  set status = 'refunded', refunded_at = now(), refunded_by = p_by, updated_at = now(),
      refund_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500)
  where id = o.id;
  return jsonb_build_object('order_id', o.id, 'status', 'refunded', 'already', false,
    'user_id', o.user_id, 'unused_seconds', extract(epoch from unused)::bigint);
end;
$$;

-- Admin refund from /admin/plans (after the gateway refund, or for money returned by hand).
create function public.payment_refund(p_admin uuid, p_order uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  r := public.payment_apply_refund(p_order, p_admin, p_reason);
  if not (r ->> 'already')::boolean then
    perform public.log_moderation(p_admin, 'payment.refund', 'payment', p_order,
      coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'refund'));
  end if;
  return r;
end;
$$;

-- The gateway reports a refund (or a chargeback) made outside the panel.
create function public.payment_mark_refunded(p_provider text, p_provider_ref text, p_event jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  oid uuid;
  r jsonb;
begin
  select id into oid from public.payment_orders where provider = p_provider and provider_ref = p_provider_ref;
  if oid is null then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;
  r := public.payment_apply_refund(oid, null, 'gateway');
  if not (r ->> 'already')::boolean then
    update public.payment_orders set raw_event = coalesce(p_event, raw_event) where id = oid;
    perform public.log_moderation(null, 'payment.refund_gateway', 'payment', oid, p_provider);
  end if;
  return r;
end;
$$;

-- =============================================================================================
-- Reads
-- =============================================================================================
-- The signed-in user's orders, newest first (p_id: one order, for the return page's polling).
create function public.my_payments(p_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.payment_order_json(o) order by o.created_at desc), '[]'::jsonb)
  from public.payment_orders o
  where o.id in (select x.id from public.payment_orders x
                 where x.user_id = (select auth.uid()) and (p_id is null or x.id = p_id)
                 order by x.created_at desc limit 100);
$$;

-- The server-side view of one order (owner check done by the caller with p_user).
create function public.payment_order(p_order uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.payment_order_json(o)
    || jsonb_build_object('provider_ref', o.provider_ref, 'checkout_url', o.checkout_url)
  from public.payment_orders o where o.id = p_order and o.user_id = p_user;
$$;

-- Orders for the panel, newest first, optionally by status.
create function public.admin_payment_orders(p_admin uuid, p_status text default null, p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_role(p_admin, 'admin');
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc) from (
      select o.created_at, jsonb_build_object(
        'id', o.id, 'user_id', o.user_id, 'name', p.display_name, 'username', p.username,
        'plan', o.plan, 'period_months', o.period_months, 'amount_sen', o.amount_sen,
        'currency', o.currency, 'provider', o.provider, 'provider_ref', o.provider_ref,
        'status', o.status, 'created_at', o.created_at, 'paid_at', o.paid_at,
        'refunded_at', o.refunded_at, 'refund_reason', o.refund_reason,
        'failure_reason', o.failure_reason, 'grant_id', o.grant_id) j
      from public.payment_orders o
      left join public.profiles p on p.id = o.user_id
      where p_status is null or o.status::text = p_status
      order by o.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)) x), '[]'::jsonb);
end;
$$;

-- Totals for the panel. Money totals exclude the 'test' provider.
-- {paid: {count, sen}, paid_30d: {count, sen}, refunded: {count, sen}, pending, failed, test,
--  by_plan: {plus: {count, sen}, vip: {count, sen}}, events_with_errors}
create function public.admin_payment_stats(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  perform public.assert_admin_role(p_admin, 'admin');
  select jsonb_build_object(
    'paid', jsonb_build_object('count', count(*) filter (where status = 'paid' and provider <> 'test'),
                               'sen', coalesce(sum(amount_sen) filter (where status = 'paid' and provider <> 'test'), 0)),
    'paid_30d', jsonb_build_object(
      'count', count(*) filter (where status = 'paid' and provider <> 'test' and paid_at > now() - interval '30 days'),
      'sen', coalesce(sum(amount_sen) filter (where status = 'paid' and provider <> 'test' and paid_at > now() - interval '30 days'), 0)),
    'refunded', jsonb_build_object('count', count(*) filter (where status = 'refunded' and provider <> 'test'),
                                   'sen', coalesce(sum(amount_sen) filter (where status = 'refunded' and provider <> 'test'), 0)),
    'pending', count(*) filter (where status = 'pending'),
    'failed', count(*) filter (where status = 'failed'),
    'test', count(*) filter (where provider = 'test'),
    'by_plan', jsonb_build_object(
      'plus', jsonb_build_object('count', count(*) filter (where status = 'paid' and provider <> 'test' and plan = 'plus'),
                                 'sen', coalesce(sum(amount_sen) filter (where status = 'paid' and provider <> 'test' and plan = 'plus'), 0)),
      'vip', jsonb_build_object('count', count(*) filter (where status = 'paid' and provider <> 'test' and plan = 'vip'),
                                'sen', coalesce(sum(amount_sen) filter (where status = 'paid' and provider <> 'test' and plan = 'vip'), 0))))
  into r
  from public.payment_orders;
  return r || jsonb_build_object('events_with_errors',
    (select count(*) from public.payment_events where error is not null and received_at > now() - interval '30 days'));
end;
$$;

-- =============================================================================================
-- Privileges: service role only, except the two client reads.
-- =============================================================================================
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'payment_period_days(int)', 'payment_price_uuid(public.plan_level, int)',
    'payment_order_json(public.payment_orders)', 'admin_plan_prices(uuid)',
    'admin_set_price(uuid, public.plan_level, int, int, boolean, text)', 'payment_expire_stale()',
    'payment_create_order(uuid, text, int, text)', 'payment_attach_checkout(uuid, text, text)',
    'payment_record_event(text, text, text, text, int, text, jsonb)', 'payment_finish_event(uuid, text)',
    'payment_mark_paid(text, text, int, text, jsonb)', 'payment_mark_failed(text, text, text, text, jsonb)',
    'payment_apply_refund(uuid, uuid, text)', 'payment_refund(uuid, uuid, text)',
    'payment_mark_refunded(text, text, jsonb)', 'payment_order(uuid, uuid)',
    'admin_payment_orders(uuid, text, int)', 'admin_payment_stats(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

revoke execute on function public.plan_prices_public() from public, anon;
grant execute on function public.plan_prices_public() to authenticated, service_role;
revoke execute on function public.my_payments(uuid) from public, anon;
grant execute on function public.my_payments(uuid) to authenticated;

-- =============================================================================================
-- Schedules: expire abandoned checkouts hourly. No purge: financial records are kept.
-- =============================================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('payment-expire-stale', '17 * * * *', 'select public.payment_expire_stale()');
  end if;
end;
$$;
