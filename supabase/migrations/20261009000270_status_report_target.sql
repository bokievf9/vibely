-- Live statuses (20261009000271): users can report a status. Enum values must be committed
-- before any function or query uses them (see 20261009000160), so the value gets its own
-- migration; everything that relies on it starts in 20261009000271.
alter type public.report_target add value if not exists 'status';
