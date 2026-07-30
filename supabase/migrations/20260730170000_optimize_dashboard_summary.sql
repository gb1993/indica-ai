create or replace function public.get_dashboard_groups()
returns table (
  group_id uuid,
  name text,
  description text,
  role public.group_role,
  member_count bigint,
  pending_count bigint,
  completed_count bigint,
  last_activity_event_type text,
  last_activity_created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with my_groups as (
    select gm.group_id, gm.role, gm.joined_at
    from public.group_members gm
    where gm.user_id = auth.uid()
      and gm.status = 'active'
  ),
  member_counts as (
    select gm.group_id, count(*) as member_count
    from public.group_members gm
    join my_groups mine on mine.group_id = gm.group_id
    where gm.status = 'active'
    group by gm.group_id
  ),
  content_counts as (
    select
      c.group_id,
      count(*) filter (where c.status = 'pending') as pending_count,
      count(*) filter (where c.status = 'completed') as completed_count
    from public.contents c
    join my_groups mine on mine.group_id = c.group_id
    group by c.group_id
  ),
  latest_activities as (
    select distinct on (ga.group_id)
      ga.group_id,
      ga.event_type,
      ga.created_at
    from public.group_activities ga
    join my_groups mine on mine.group_id = ga.group_id
    order by ga.group_id, ga.created_at desc
  )
  select
    g.id,
    g.name,
    g.description,
    mine.role,
    coalesce(mc.member_count, 0),
    coalesce(cc.pending_count, 0),
    coalesce(cc.completed_count, 0),
    la.event_type,
    la.created_at
  from my_groups mine
  join public.groups g on g.id = mine.group_id
  left join member_counts mc on mc.group_id = g.id
  left join content_counts cc on cc.group_id = g.id
  left join latest_activities la on la.group_id = g.id
  order by mine.joined_at desc;
$$;

revoke all on function public.get_dashboard_groups() from public, anon, authenticated;
grant execute on function public.get_dashboard_groups() to authenticated;
