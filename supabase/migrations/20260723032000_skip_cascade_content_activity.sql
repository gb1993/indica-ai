create or replace function public.log_group_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_group_id uuid;
  activity_actor_id uuid;
  activity_event_type text;
  activity_entity_type text;
  activity_entity_id uuid;
  activity_metadata jsonb := '{}'::jsonb;
begin
  -- A group deletion already removes its activity history. Avoid inserting a new
  -- child activity while contents are being removed by the cascading FK trigger.
  if tg_table_name = 'contents' and tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_table_name = 'groups' then
    activity_group_id := new.id;
    activity_actor_id := coalesce(auth.uid(), new.owner_id);
    activity_entity_type := 'group';
    activity_entity_id := new.id;
    if tg_op = 'INSERT' then
      activity_event_type := 'group_created';
      activity_metadata := jsonb_build_object('name', new.name);
    elsif tg_op = 'UPDATE' then
      activity_event_type := 'group_updated';
      activity_metadata := jsonb_build_object('name', new.name);
    end if;
  elsif tg_table_name = 'group_invitations' then
    activity_group_id := new.group_id;
    activity_actor_id := coalesce(auth.uid(), new.invited_by);
    activity_entity_type := 'invitation';
    activity_entity_id := new.id;
    if tg_op = 'INSERT' then
      activity_event_type := 'invitation_sent';
    elsif old.cancelled_at is null and new.cancelled_at is not null then
      activity_event_type := 'invitation_cancelled';
    elsif old.accepted_at is null and new.accepted_at is not null then
      activity_event_type := 'invitation_accepted';
    end if;
  elsif tg_table_name = 'group_members' then
    if old.status = 'active' and new.status = 'removed' then
      activity_group_id := new.group_id;
      activity_actor_id := auth.uid();
      activity_event_type := 'member_removed';
      activity_entity_type := 'profile';
      activity_entity_id := new.user_id;
      activity_metadata := jsonb_build_object('role', new.role);
    end if;
  elsif tg_table_name = 'contents' then
    activity_entity_type := 'content';
    if tg_op = 'DELETE' then
      activity_group_id := old.group_id;
      activity_actor_id := coalesce(auth.uid(), old.created_by);
      activity_entity_id := old.id;
      activity_event_type := 'content_deleted';
      activity_metadata := jsonb_build_object('title', old.title, 'type', old.type);
    else
      activity_group_id := new.group_id;
      activity_actor_id := coalesce(auth.uid(), new.created_by);
      activity_entity_id := new.id;
      if tg_op = 'INSERT' then
        activity_event_type := 'content_created';
        activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
      elsif old.status = 'pending' and new.status = 'approved' then
        activity_event_type := 'content_approved';
        activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
      elsif old.status = 'approved' and new.status = 'completed' then
        activity_event_type := 'content_completed';
        activity_actor_id := new.completed_by;
        activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
      else
        activity_event_type := 'content_updated';
        activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
      end if;
    end if;
  elsif tg_table_name = 'content_ratings' then
    select c.group_id into activity_group_id
    from public.contents c
    where c.id = new.content_id;
    activity_actor_id := new.user_id;
    activity_entity_type := 'content';
    activity_entity_id := new.content_id;
    if tg_op = 'INSERT' then
      activity_event_type := 'rating_created';
      activity_metadata := jsonb_build_object('rating', new.rating);
    elsif new.rating is distinct from old.rating then
      activity_event_type := 'rating_updated';
      activity_metadata := jsonb_build_object('rating', new.rating);
    end if;
  end if;

  if activity_event_type is not null and activity_group_id is not null then
    insert into public.group_activities (
      group_id, actor_id, event_type, entity_type, entity_id, metadata
    ) values (
      activity_group_id,
      activity_actor_id,
      activity_event_type,
      activity_entity_type,
      activity_entity_id,
      activity_metadata
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
