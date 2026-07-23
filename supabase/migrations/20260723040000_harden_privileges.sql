-- Keep database access explicit. Supabase projects can have permissive default
-- privileges for API roles, so every application table is reset before the
-- minimum required grants are restored.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.groups from anon, authenticated;
revoke all on table public.group_members from anon, authenticated;
revoke all on table public.group_invitations from anon, authenticated;
revoke all on table public.contents from anon, authenticated;
revoke all on table public.content_votes from anon, authenticated;
revoke all on table public.content_ratings from anon, authenticated;
revoke all on table public.content_messages from anon, authenticated;
revoke all on table public.group_activities from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (name, avatar_url) on table public.profiles to authenticated;

grant select on table public.groups, public.group_members, public.group_invitations
  to authenticated;
grant update (name, description) on table public.groups to authenticated;
grant delete on table public.groups to authenticated;

grant select on table public.contents to authenticated;
grant insert (group_id, created_by, type, title, description, thumbnail_url, trailer_url)
  on table public.contents to authenticated;
grant update (type, title, description, thumbnail_url, trailer_url)
  on table public.contents to authenticated;
grant delete on table public.contents to authenticated;

grant select on table public.content_votes, public.content_ratings,
  public.content_messages, public.group_activities to authenticated;

-- Trigger helpers are not public APIs. Revoking EXECUTE does not prevent an
-- already attached trigger from running.
revoke all on function public.set_profile_updated_at() from public, anon, authenticated;
revoke all on function public.handle_auth_user_profile() from public, anon, authenticated;
revoke all on function public.set_groups_updated_at() from public, anon, authenticated;
revoke all on function public.protect_groups_owner_id() from public, anon, authenticated;
revoke all on function public.protect_group_members_owner() from public, anon, authenticated;
revoke all on function public.set_contents_updated_at() from public, anon, authenticated;
revoke all on function public.set_content_votes_updated_at() from public, anon, authenticated;
revoke all on function public.set_content_ratings_updated_at() from public, anon, authenticated;
revoke all on function public.normalize_content_message(text) from public, anon, authenticated;
revoke all on function public.log_group_activity() from public, anon, authenticated;
revoke all on function public.snapshot_activity_actor_name() from public, anon, authenticated;

-- RLS helpers and RPCs are available only to signed-in users.
revoke all on function public.is_group_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_group_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function public.shares_active_group(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_group(text, text) from public, anon, authenticated;
revoke all on function public.create_group_invitation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_group_invitation(uuid) from public, anon, authenticated;
revoke all on function public.remove_group_member(uuid) from public, anon, authenticated;
revoke all on function public.get_group_invitation(text) from public, anon, authenticated;
revoke all on function public.accept_group_invitation(text) from public, anon, authenticated;
revoke all on function public.set_content_vote(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_content_vote_summary(uuid) from public, anon, authenticated;
revoke all on function public.complete_content(uuid) from public, anon, authenticated;
revoke all on function public.set_content_rating(uuid, numeric) from public, anon, authenticated;
revoke all on function public.get_content_rating_summary(uuid) from public, anon, authenticated;
revoke all on function public.create_content_message(uuid, text) from public, anon, authenticated;
revoke all on function public.update_content_message(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_content_message(uuid) from public, anon, authenticated;

grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;
grant execute on function public.shares_active_group(uuid, uuid) to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.create_group_invitation(uuid, text, text) to authenticated;
grant execute on function public.cancel_group_invitation(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid) to authenticated;
grant execute on function public.get_group_invitation(text) to authenticated;
grant execute on function public.accept_group_invitation(text) to authenticated;
grant execute on function public.set_content_vote(uuid, boolean) to authenticated;
grant execute on function public.get_content_vote_summary(uuid) to authenticated;
grant execute on function public.complete_content(uuid) to authenticated;
grant execute on function public.set_content_rating(uuid, numeric) to authenticated;
grant execute on function public.get_content_rating_summary(uuid) to authenticated;
grant execute on function public.create_content_message(uuid, text) to authenticated;
grant execute on function public.update_content_message(uuid, text) to authenticated;
grant execute on function public.delete_content_message(uuid) to authenticated;
