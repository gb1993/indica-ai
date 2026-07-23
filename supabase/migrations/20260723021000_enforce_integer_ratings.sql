drop function public.set_content_rating(uuid, smallint);

create or replace function public.set_content_rating(
  p_content_id uuid,
  p_rating numeric
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

  select c.group_id, c.status
  into content_group_id, current_status
  from public.contents c
  where c.id = p_content_id
  for update;

  if content_group_id is null
     or current_status <> 'completed'
     or not public.is_group_member(content_group_id, actor_id) then
    raise exception 'content is unavailable for rating';
  end if;

  insert into public.content_ratings (content_id, user_id, rating)
  values (p_content_id, actor_id, p_rating::smallint)
  on conflict (content_id, user_id) do update
    set rating = excluded.rating,
        updated_at = now();
end;
$$;

revoke all on function public.set_content_rating(uuid, numeric) from public;
grant execute on function public.set_content_rating(uuid, numeric) to authenticated;
