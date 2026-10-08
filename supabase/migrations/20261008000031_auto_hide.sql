-- Community moderation: a post or comment with 3 distinct open reports is hidden right away,
-- before a moderator looks at it. Logged as 'auto.hide' with no admin. A moderator can unhide
-- it in /admin/content; after that, new reports never auto-hide it again.
create function public.reports_auto_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporters int;
begin
  if new.target_type not in ('post', 'comment') then
    return new;
  end if;

  select count(distinct reporter_id) into reporters
  from public.reports
  where target_type = new.target_type and target_id = new.target_id and resolved_at is null;
  if reporters < 3 then
    return new;
  end if;

  -- Respect a moderator's earlier decision to keep it visible.
  if exists (
    select 1 from public.moderation_actions
    where target_id = new.target_id and action = new.target_type::text || '.unhide'
  ) then
    return new;
  end if;

  if new.target_type = 'post' then
    update public.posts set is_hidden = true where id = new.target_id and not is_hidden;
  else
    update public.comments set is_hidden = true where id = new.target_id and not is_hidden;
  end if;

  if found then
    insert into public.moderation_actions (admin_id, action, target_type, target_id, reason)
    values (null, 'auto.hide', new.target_type::text, new.target_id,
      format('%s open reports', reporters));
  end if;
  return new;
end;
$$;

create trigger reports_auto_hide
  after insert on public.reports
  for each row execute function public.reports_auto_hide();

revoke execute on function public.reports_auto_hide() from public, anon, authenticated;
