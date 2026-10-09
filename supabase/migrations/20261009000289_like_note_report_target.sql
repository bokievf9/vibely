-- VIP perks (20261009000290): users can report a note attached to a like ("Like with a note").
-- Enum values must be committed before any function or query uses them (see 20261009000160),
-- so the value gets its own migration; everything that relies on it starts in 20261009000290.
alter type public.report_target add value if not exists 'like_note';
