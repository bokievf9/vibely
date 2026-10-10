-- Underage safety: "Looks under 18" as a selfie review decision.
--
-- There is no ID check: age is self-declared (profiles_enforce_adult) and a human reviews the
-- verification selfie. When the reviewer thinks the person is a minor, one call does everything in
-- one transaction (or nothing):
--   * the verification request is rejected with the reason code 'underage'
--     (the profile becomes 'rejected' through sync_verification_status);
--   * the account is banned with the ban code 'underage' through admin_ban_user (20261009000151),
--     which also ends live calls and random chats and signs the user out. Duration follows the
--     convention of admin_resolve_case (20261009000161) and the Telegram bot: moderators ban for
--     7 days (their maximum), admins and owners permanently. p_ban_days overrides it and is checked
--     by admin_ban_user (1..7 moderator, longer or permanent admin). An admin extends a moderator's
--     7-day ban to permanent from the user page (admin_ban_user with no duration);
--   * the profile is hidden from discovery (discoverable = false; banned and unverified profiles
--     are already excluded, this keeps them out after a temporary ban ends until they reverify);
--   * moderation_actions gets 'verification.reject_underage' (plus the 'user.temp_ban'/'user.ban'
--     row written by admin_ban_user).
-- Returns {"user_id": uuid, "ban_days": int|null, "ended_calls": [uuid]}; the caller closes the
-- LiveKit rooms of ended_calls. A request that is no longer pending raises P0002, like
-- admin_review_verification, so a second click (panel or Telegram) is reported as "already decided".
create function public.admin_reject_underage(
  p_admin    uuid,
  p_request  uuid,
  p_ban_days int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  days   int;
  ended  uuid[];
begin
  perform public.assert_admin_role(p_admin, 'moderator');

  update public.verification_requests
  set status = 'rejected',
      reviewer_id = p_admin,
      rejection_reason = 'underage',
      reviewed_at = now()
  where id = p_request and status = 'pending'
  returning user_id into target;
  if target is null then
    raise exception 'Request is not pending' using errcode = 'no_data_found';
  end if;

  days := coalesce(p_ban_days,
    case when public.admin_role_of(p_admin) >= 'admin' then null else 7 end);
  ended := public.admin_ban_user(p_admin, target, 'underage', days);

  update public.profiles set discoverable = false where id = target;

  perform public.log_moderation(p_admin, 'verification.reject_underage', 'verification_request',
    p_request, 'underage · ' || coalesce(days || ' дн.', 'бессрочно') || ' · user ' || target);

  return jsonb_build_object('user_id', target, 'ban_days', days,
    'ended_calls', to_jsonb(coalesce(ended, '{}')));
end;
$$;

revoke execute on function public.admin_reject_underage(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.admin_reject_underage(uuid, uuid, int) to service_role;
