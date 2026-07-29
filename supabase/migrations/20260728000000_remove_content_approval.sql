-- Approval is no longer part of the content lifecycle. Preserve existing
-- approved recommendations as immediately available recommendations.
update public.contents
set status = 'pending'
where status = 'approved';

drop function if exists public.set_content_vote(uuid, boolean);
drop function if exists public.get_content_vote_summary(uuid);
drop function if exists public.complete_content(uuid);
drop table if exists public.content_votes;
drop function if exists public.set_content_votes_updated_at();

delete from public.group_activities
where event_type = 'content_approved';

alter table public.group_activities
  drop constraint group_activities_event_type_check;

alter table public.group_activities
  add constraint group_activities_event_type_check check (
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
      'content_completed',
      'rating_created',
      'rating_updated'
    )
  );

create or replace function public.remove_group_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  membership_group_id uuid;
  membership_role public.group_role;
begin
  select group_id, role
  into membership_group_id, membership_role
  from public.group_members
  where id = p_membership_id
    and status = 'active'
  for update;

  if membership_group_id is null
     or not public.is_group_owner(membership_group_id, actor_id) then
    raise exception 'not authorized';
  end if;
  if membership_role = 'owner' then
    raise exception 'group owner cannot be removed';
  end if;

  update public.group_members
  set status = 'removed',
      removed_at = now()
  where id = p_membership_id;
end;
$$;

create or replace function public.set_content_rating(
  p_content_id uuid,
  p_rating numeric,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  content_group_id uuid;
  current_status public.content_status;
  normalized_comment text := nullif(
    trim(regexp_replace(coalesce(p_comment, ''), '\s+', ' ', 'g')),
    ''
  );
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;
  if p_rating is null
     or p_rating <> trunc(p_rating)
     or p_rating < 1
     or p_rating > 5 then
    raise exception 'invalid rating';
  end if;
  if char_length(normalized_comment) > 500
     or normalized_comment ~ '[<>]' then
    raise exception 'invalid rating comment';
  end if;

  select c.group_id, c.status
  into content_group_id, current_status
  from public.contents c
  where c.id = p_content_id
  for update;

  if content_group_id is null
     or current_status not in ('pending', 'completed')
     or not public.is_group_member(content_group_id, actor_id) then
    raise exception 'content is unavailable for rating';
  end if;

  if current_status = 'pending' then
    update public.contents
    set status = 'completed',
        completed_at = now(),
        completed_by = actor_id
    where id = p_content_id;
  end if;

  insert into public.content_ratings (content_id, user_id, rating, comment)
  values (p_content_id, actor_id, p_rating::smallint, normalized_comment)
  on conflict (content_id, user_id) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        updated_at = now();
end;
$$;

revoke all on function public.set_content_rating(uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.set_content_rating(uuid, numeric, text)
  to authenticated;

drop function public.get_group_most_active_members(uuid);

create function public.get_group_most_active_members(p_group_id uuid)
returns table (
  member_id uuid,
  name text,
  content_count bigint,
  rating_count bigint,
  message_count bigint,
  activity_score bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null
     or not public.is_group_member(p_group_id, actor_id) then
    raise exception 'not authorized';
  end if;

  return query
  with active_members as (
    select gm.user_id, p.name
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id
      and gm.status = 'active'
  ),
  content_totals as (
    select c.created_by as user_id, count(*) as total
    from public.contents c
    where c.group_id = p_group_id
    group by c.created_by
  ),
  rating_totals as (
    select cr.user_id, count(*) as total
    from public.content_ratings cr
    join public.contents c on c.id = cr.content_id
    where c.group_id = p_group_id
    group by cr.user_id
  ),
  message_totals as (
    select cm.user_id, count(*) as total
    from public.content_messages cm
    join public.contents c on c.id = cm.content_id
    where c.group_id = p_group_id
      and cm.deleted_at is null
    group by cm.user_id
  )
  select
    am.user_id,
    am.name,
    coalesce(ct.total, 0),
    coalesce(rt.total, 0),
    coalesce(mt.total, 0),
    coalesce(ct.total, 0)
      + coalesce(rt.total, 0)
      + coalesce(mt.total, 0) as score
  from active_members am
  left join content_totals ct on ct.user_id = am.user_id
  left join rating_totals rt on rt.user_id = am.user_id
  left join message_totals mt on mt.user_id = am.user_id
  order by score desc, am.name asc
  limit 5;
end;
$$;

revoke all on function public.get_group_most_active_members(uuid)
  from public, anon, authenticated;
grant execute on function public.get_group_most_active_members(uuid)
  to authenticated;

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
  elsif old.status = 'pending' and new.status = 'completed' then
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
