create or replace function public.log_content_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_event_type text;
  activity_actor_id uuid;
  activity_metadata jsonb;
begin
  if tg_op = 'DELETE' then
    -- During a group cascade, PostgreSQL may delete the parent before firing the
    -- content trigger. The group's complete activity history is already being
    -- removed, so do not attempt to recreate a child activity for that group.
    if not exists (
      select 1
      from public.groups g
      where g.id = old.group_id
    ) then
      return old;
    end if;

    activity_event_type := 'content_deleted';
    activity_actor_id := coalesce(auth.uid(), old.created_by);
    activity_metadata := jsonb_build_object('title', old.title, 'type', old.type);
  elsif tg_op = 'INSERT' then
    activity_event_type := 'content_created';
    activity_actor_id := coalesce(auth.uid(), new.created_by);
    activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
  elsif old.status = 'pending' and new.status = 'approved' then
    activity_event_type := 'content_approved';
    activity_actor_id := coalesce(auth.uid(), new.created_by);
    activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
  elsif old.status = 'approved' and new.status = 'completed' then
    activity_event_type := 'content_completed';
    activity_actor_id := new.completed_by;
    activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
  else
    activity_event_type := 'content_updated';
    activity_actor_id := coalesce(auth.uid(), new.created_by);
    activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
  end if;

  insert into public.group_activities (
    group_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    coalesce(new.group_id, old.group_id),
    activity_actor_id,
    activity_event_type,
    'content',
    coalesce(new.id, old.id),
    activity_metadata
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.log_content_activity() from public;

drop trigger if exists log_content_activity on public.contents;

create trigger log_content_activity
  after insert or update or delete on public.contents
  for each row execute function public.log_content_activity();
