-- New things users can report (batch-4 admin reports & evidence):
--   message  a chat message of a match (also one later "deleted for everyone", see 131)
--   photo    a profile photo (profile_photos.id)
--   call     an audio/video call (calls.id)
-- Enum values must be committed before any function or query uses them, so they get their own
-- migration; everything that relies on them starts in 20261009000161.
alter type public.report_target add value if not exists 'message';
alter type public.report_target add value if not exists 'photo';
alter type public.report_target add value if not exists 'call';
