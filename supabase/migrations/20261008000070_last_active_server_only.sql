-- "Online / last seen" must be trustworthy: clients may no longer write last_active_at directly
-- (they could fake being online). It is refreshed only by touch_last_active() (throttled RPC).
revoke update (last_active_at) on public.profiles from authenticated;
