create table public.content_messages (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null constraint content_messages_content_valid check (
    content = regexp_replace(trim(content), '[[:space:]]+', ' ', 'g')
    and char_length(content) between 1 and 2000
    and content !~ '[<>]'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index content_messages_content_created_idx
  on public.content_messages (content_id, created_at desc);

create table public.group_activities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null constraint group_activities_event_type_check check (
    event_type in (
      'group_created',
      'group_updated',
      'invitation_sent',
      'invitation_cancelled',
      'invitation_accepted',
      'member_removed',
      'content_created',
      'content_updated',
      'content_deleted',
      'content_approved',
      'content_completed',
      'rating_created',
      'rating_updated'
    )
  ),
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb constraint group_activities_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default now()
);

create index group_activities_group_created_idx
  on public.group_activities (group_id, created_at desc);

alter table public.content_messages enable row level security;
alter table public.group_activities enable row level security;

create policy "Active members can read content messages"
  on public.content_messages for select to authenticated
  using (
    exists (
      select 1
      from public.contents c
      where c.id = content_id
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

create policy "Active members can create content messages"
  on public.content_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

create policy "Authors can update their content messages"
  on public.content_messages for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

create policy "Active members can read group activities"
  on public.group_activities for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

revoke all on public.content_messages from anon, authenticated;
revoke all on public.group_activities from anon, authenticated;
grant select on public.content_messages, public.group_activities to authenticated;

create or replace function public.normalize_content_message(p_content text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(trim(p_content), '[[:space:]]+', ' ', 'g');
$$;

create or replace function public.create_content_message(
  p_content_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  content_group_id uuid;
  clean_content text := public.normalize_content_message(p_content);
  message_id uuid;
begin
  select c.group_id into content_group_id
  from public.contents c
  where c.id = p_content_id;

  if actor_id is null
     or content_group_id is null
     or not public.is_group_member(content_group_id, actor_id) then
    raise exception 'content not found';
  end if;
  if clean_content is null
     or char_length(clean_content) not between 1 and 2000
     or clean_content ~ '[<>]' then
    raise exception 'invalid message';
  end if;

  insert into public.content_messages (content_id, user_id, content)
  values (p_content_id, actor_id, clean_content)
  returning id into message_id;

  return message_id;
end;
$$;

create or replace function public.update_content_message(
  p_message_id uuid,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  message_group_id uuid;
  message_owner_id uuid;
  message_deleted_at timestamptz;
  clean_content text := public.normalize_content_message(p_content);
begin
  select c.group_id, m.user_id, m.deleted_at
  into message_group_id, message_owner_id, message_deleted_at
  from public.content_messages m
  join public.contents c on c.id = m.content_id
  where m.id = p_message_id
  for update of m;

  if actor_id is null
     or message_group_id is null
     or message_owner_id <> actor_id
     or message_deleted_at is not null
     or not public.is_group_member(message_group_id, actor_id) then
    raise exception 'message is unavailable for editing';
  end if;
  if clean_content is null
     or char_length(clean_content) not between 1 and 2000
     or clean_content ~ '[<>]' then
    raise exception 'invalid message';
  end if;

  update public.content_messages
  set content = clean_content,
      updated_at = now()
  where id = p_message_id;
end;
$$;

create or replace function public.delete_content_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  message_group_id uuid;
  message_owner_id uuid;
  message_deleted_at timestamptz;
begin
  select c.group_id, m.user_id, m.deleted_at
  into message_group_id, message_owner_id, message_deleted_at
  from public.content_messages m
  join public.contents c on c.id = m.content_id
  where m.id = p_message_id
  for update of m;

  if actor_id is null
     or message_group_id is null
     or message_owner_id <> actor_id
     or message_deleted_at is not null
     or not public.is_group_member(message_group_id, actor_id) then
    raise exception 'message is unavailable for deletion';
  end if;

  update public.content_messages
  set deleted_at = now(),
      updated_at = now()
  where id = p_message_id;
end;
$$;

revoke all on function public.normalize_content_message(text) from public;
revoke all on function public.create_content_message(uuid, text) from public;
revoke all on function public.update_content_message(uuid, text) from public;
revoke all on function public.delete_content_message(uuid) from public;
grant execute on function public.create_content_message(uuid, text) to authenticated;
grant execute on function public.update_content_message(uuid, text) to authenticated;
grant execute on function public.delete_content_message(uuid) to authenticated;

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
  if tg_table_name = 'groups' then
    activity_group_id := coalesce(new.id, old.id);
    activity_actor_id := coalesce(auth.uid(), new.owner_id, old.owner_id);
    activity_entity_type := 'group';
    activity_entity_id := activity_group_id;
    if tg_op = 'INSERT' then
      activity_event_type := 'group_created';
      activity_metadata := jsonb_build_object('name', new.name);
    elsif tg_op = 'UPDATE' then
      activity_event_type := 'group_updated';
      activity_metadata := jsonb_build_object('name', new.name);
    end if;
  elsif tg_table_name = 'group_invitations' then
    activity_group_id := coalesce(new.group_id, old.group_id);
    activity_actor_id := coalesce(auth.uid(), new.invited_by, old.invited_by);
    activity_entity_type := 'invitation';
    activity_entity_id := coalesce(new.id, old.id);
    if tg_op = 'INSERT' then
      activity_event_type := 'invitation_sent';
    elsif old.cancelled_at is null and new.cancelled_at is not null then
      activity_event_type := 'invitation_cancelled';
    elsif old.accepted_at is null and new.accepted_at is not null then
      activity_event_type := 'invitation_accepted';
    end if;
  elsif tg_table_name = 'group_members' then
    if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'removed' then
      activity_group_id := new.group_id;
      activity_actor_id := auth.uid();
      activity_event_type := 'member_removed';
      activity_entity_type := 'profile';
      activity_entity_id := new.user_id;
      activity_metadata := jsonb_build_object('role', new.role);
    end if;
  elsif tg_table_name = 'contents' then
    activity_group_id := coalesce(new.group_id, old.group_id);
    activity_actor_id := coalesce(auth.uid(), new.created_by, old.created_by);
    activity_entity_type := 'content';
    activity_entity_id := coalesce(new.id, old.id);
    if tg_op = 'INSERT' then
      activity_event_type := 'content_created';
      activity_metadata := jsonb_build_object('title', new.title, 'type', new.type);
    elsif tg_op = 'DELETE' then
      activity_event_type := 'content_deleted';
      activity_metadata := jsonb_build_object('title', old.title, 'type', old.type);
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
  elsif tg_table_name = 'content_ratings' then
    select c.group_id into activity_group_id
    from public.contents c
    where c.id = coalesce(new.content_id, old.content_id);
    activity_actor_id := coalesce(new.user_id, old.user_id);
    activity_entity_type := 'content';
    activity_entity_id := coalesce(new.content_id, old.content_id);
    if tg_op = 'INSERT' then
      activity_event_type := 'rating_created';
      activity_metadata := jsonb_build_object('rating', new.rating);
    elsif tg_op = 'UPDATE' and new.rating is distinct from old.rating then
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

  return coalesce(new, old);
end;
$$;

revoke all on function public.log_group_activity() from public;

create trigger log_group_activity_insert_update
  after insert or update on public.groups
  for each row execute function public.log_group_activity();

create trigger log_invitation_activity
  after insert or update on public.group_invitations
  for each row execute function public.log_group_activity();

create trigger log_member_activity
  after update on public.group_members
  for each row execute function public.log_group_activity();

create trigger log_content_activity
  after insert or update or delete on public.contents
  for each row execute function public.log_group_activity();

create trigger log_rating_activity
  after insert or update on public.content_ratings
  for each row execute function public.log_group_activity();
