create table public.content_ratings (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null constraint content_ratings_value_check check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, user_id)
);

create index content_ratings_content_idx
  on public.content_ratings (content_id);

alter table public.content_ratings enable row level security;

create policy "Active members can read content ratings"
  on public.content_ratings for select to authenticated
  using (
    exists (
      select 1
      from public.contents c
      where c.id = content_id
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

create policy "Active members can rate completed contents"
  on public.content_ratings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and c.status = 'completed'
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

create policy "Active members can update their content rating"
  on public.content_ratings for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and c.status = 'completed'
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and c.status = 'completed'
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

revoke all on public.content_ratings from anon, authenticated;
grant select on public.content_ratings to authenticated;

create or replace function public.set_content_ratings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_content_ratings_updated_at
  before update on public.content_ratings
  for each row execute function public.set_content_ratings_updated_at();

create or replace function public.complete_content(p_content_id uuid)
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

  select c.group_id, c.status
  into content_group_id, current_status
  from public.contents c
  where c.id = p_content_id
  for update;

  if content_group_id is null
     or current_status <> 'approved'
     or not public.is_group_member(content_group_id, actor_id) then
    raise exception 'content is unavailable for completion';
  end if;

  update public.contents
  set status = 'completed',
      completed_at = now(),
      completed_by = actor_id
  where id = p_content_id
    and status = 'approved';
end;
$$;

create or replace function public.set_content_rating(
  p_content_id uuid,
  p_rating smallint
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
  if p_rating is null or p_rating < 1 or p_rating > 5 then
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
  values (p_content_id, actor_id, p_rating)
  on conflict (content_id, user_id) do update
    set rating = excluded.rating,
        updated_at = now();
end;
$$;

create or replace function public.get_content_rating_summary(p_content_id uuid)
returns table (
  average_rating numeric,
  rating_count integer,
  current_user_rating smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  content_group_id uuid;
begin
  select c.group_id
  into content_group_id
  from public.contents c
  where c.id = p_content_id;

  if actor_id is null
     or content_group_id is null
     or not public.is_group_member(content_group_id, actor_id) then
    raise exception 'content not found';
  end if;

  return query
  select
    round(avg(cr.rating)::numeric, 1),
    count(cr.id)::integer,
    (array_agg(cr.rating) filter (where cr.user_id = actor_id))[1]
  from public.content_ratings cr
  where cr.content_id = p_content_id;
end;
$$;

revoke all on function public.complete_content(uuid) from public;
revoke all on function public.set_content_rating(uuid, smallint) from public;
revoke all on function public.get_content_rating_summary(uuid) from public;
grant execute on function public.complete_content(uuid) to authenticated;
grant execute on function public.set_content_rating(uuid, smallint) to authenticated;
grant execute on function public.get_content_rating_summary(uuid) to authenticated;
