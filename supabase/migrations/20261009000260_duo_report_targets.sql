-- New things users can report in Duo Dating (20261009000261):
--   group_message  a message of a duo group chat (group_messages.id)
--   group_member   a member of a duo group chat (group_members.id; the subject is that user)
-- Enum values must be committed before any function or query uses them, so they get their own
-- migration (as 20261009000160 did); everything that relies on them starts in 20261009000261.
alter type public.report_target add value if not exists 'group_message';
alter type public.report_target add value if not exists 'group_member';
