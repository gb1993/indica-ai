create or replace function public.get_group_top_rated_contents(p_group_id uuid)
returns table (
  content_id uuid,
  title text,
  type public.content_type,
  average_rating numeric,
  rating_count bigint
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
  select
    c.id,
    c.title,
    c.type,
    round(avg(cr.rating)::numeric, 1),
    count(cr.id)
  from public.contents c
  join public.content_ratings cr on cr.content_id = c.id
  join public.group_members gm
    on gm.group_id = c.group_id
   and gm.user_id = cr.user_id
   and gm.status = 'active'
  where c.group_id = p_group_id
    and c.status = 'completed'
  group by c.id, c.title, c.type
  order by avg(cr.rating) desc, count(cr.id) desc, c.title asc
  limit 5;
end;
$$;

create or replace function public.get_group_most_active_members(p_group_id uuid)
returns table (
  member_id uuid,
  name text,
  content_count bigint,
  vote_count bigint,
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
  vote_totals as (
    select cv.user_id, count(*) as total
    from public.content_votes cv
    join public.contents c on c.id = cv.content_id
    where c.group_id = p_group_id
    group by cv.user_id
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
    coalesce(vt.total, 0),
    coalesce(rt.total, 0),
    coalesce(mt.total, 0),
    coalesce(ct.total, 0)
      + coalesce(vt.total, 0)
      + coalesce(rt.total, 0)
      + coalesce(mt.total, 0) as score
  from active_members am
  left join content_totals ct on ct.user_id = am.user_id
  left join vote_totals vt on vt.user_id = am.user_id
  left join rating_totals rt on rt.user_id = am.user_id
  left join message_totals mt on mt.user_id = am.user_id
  order by score desc, am.name asc
  limit 5;
end;
$$;

create or replace function public.get_group_most_discussed_contents(p_group_id uuid)
returns table (
  content_id uuid,
  title text,
  type public.content_type,
  message_count bigint
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
  select
    c.id,
    c.title,
    c.type,
    count(cm.id)
  from public.contents c
  join public.content_messages cm
    on cm.content_id = c.id
   and cm.deleted_at is null
  join public.group_members gm
    on gm.group_id = c.group_id
   and gm.user_id = cm.user_id
   and gm.status = 'active'
  where c.group_id = p_group_id
  group by c.id, c.title, c.type
  order by count(cm.id) desc, c.title asc
  limit 3;
end;
$$;

revoke all on function public.get_group_top_rated_contents(uuid)
  from public, anon, authenticated;
revoke all on function public.get_group_most_active_members(uuid)
  from public, anon, authenticated;
revoke all on function public.get_group_most_discussed_contents(uuid)
  from public, anon, authenticated;

grant execute on function public.get_group_top_rated_contents(uuid)
  to authenticated;
grant execute on function public.get_group_most_active_members(uuid)
  to authenticated;
grant execute on function public.get_group_most_discussed_contents(uuid)
  to authenticated;
