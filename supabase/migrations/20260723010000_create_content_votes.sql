create table public.content_votes (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, user_id)
);

create index content_votes_content_vote_idx
  on public.content_votes (content_id, vote);

alter table public.content_votes enable row level security;

create policy "Active members can read content votes"
  on public.content_votes for select to authenticated
  using (
    exists (
      select 1
      from public.contents c
      where c.id = content_id
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

create policy "Active members can create their vote on pending contents"
  on public.content_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and c.status = 'pending'
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

create policy "Active members can update their vote on pending contents"
  on public.content_votes for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and c.status = 'pending'
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.contents c
      where c.id = content_id
        and c.status = 'pending'
        and public.is_group_member(c.group_id, (select auth.uid()))
    )
  );

revoke all on public.content_votes from anon, authenticated;
grant select on public.content_votes to authenticated;

create or replace function public.set_content_votes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_content_votes_updated_at
  before update on public.content_votes
  for each row execute function public.set_content_votes_updated_at();

create or replace function public.set_content_vote(
  p_content_id uuid,
  p_vote boolean
)
returns public.content_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  content_group_id uuid;
  current_status public.content_status;
  active_member_count integer;
  favorable_vote_count integer;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;
  if p_vote is null then
    raise exception 'invalid vote';
  end if;

  select c.group_id, c.status
  into content_group_id, current_status
  from public.contents c
  where c.id = p_content_id
  for update;

  if content_group_id is null
     or current_status <> 'pending'
     or not public.is_group_member(content_group_id, actor_id) then
    raise exception 'content is unavailable for voting';
  end if;

  insert into public.content_votes (content_id, user_id, vote)
  values (p_content_id, actor_id, p_vote)
  on conflict (content_id, user_id) do update
    set vote = excluded.vote,
        updated_at = now();

  select count(*)::integer
  into active_member_count
  from public.group_members gm
  where gm.group_id = content_group_id
    and gm.status = 'active';

  select count(*)::integer
  into favorable_vote_count
  from public.content_votes cv
  join public.group_members gm
    on gm.group_id = content_group_id
   and gm.user_id = cv.user_id
   and gm.status = 'active'
  where cv.content_id = p_content_id
    and cv.vote = true;

  if favorable_vote_count > active_member_count / 2 then
    update public.contents
    set status = 'approved'
    where id = p_content_id
      and status = 'pending';
    current_status := 'approved';
  end if;

  return current_status;
end;
$$;

create or replace function public.get_content_vote_summary(p_content_id uuid)
returns table (
  favorable_votes integer,
  contrary_votes integer,
  active_members integer,
  current_user_vote boolean,
  favorable_votes_needed integer,
  content_status public.content_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  content_group_id uuid;
  current_status public.content_status;
begin
  select c.group_id, c.status
  into content_group_id, current_status
  from public.contents c
  where c.id = p_content_id;

  if actor_id is null
     or content_group_id is null
     or not public.is_group_member(content_group_id, actor_id) then
    raise exception 'content not found';
  end if;

  return query
  select
    count(*) filter (where cv.vote = true)::integer,
    count(*) filter (where cv.vote = false)::integer,
    (
      select count(*)::integer
      from public.group_members gm
      where gm.group_id = content_group_id
        and gm.status = 'active'
    ),
    (array_agg(cv.vote) filter (where cv.user_id = actor_id))[1],
    case
      when current_status <> 'pending' then 0
      else greatest(
        (
          select count(*)::integer / 2 + 1
          from public.group_members gm
          where gm.group_id = content_group_id
            and gm.status = 'active'
        ) - count(*) filter (where cv.vote = true)::integer,
        0
      )
    end,
    current_status
  from public.content_votes cv
  where cv.content_id = p_content_id;
end;
$$;

create or replace function public.remove_group_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  membership_group_id uuid;
  membership_user_id uuid;
  membership_role public.group_role;
  active_member_count integer;
  favorable_vote_count integer;
  pending_content record;
begin
  select group_id, user_id, role
  into membership_group_id, membership_user_id, membership_role
  from public.group_members
  where id = p_membership_id and status = 'active'
  for update;

  if membership_group_id is null or not public.is_group_owner(membership_group_id, actor_id) then
    raise exception 'not authorized';
  end if;
  if membership_role = 'owner' then
    raise exception 'group owner cannot be removed';
  end if;

  update public.group_members
  set status = 'removed', removed_at = now()
  where id = p_membership_id;

  delete from public.content_votes cv
  using public.contents c
  where cv.content_id = c.id
    and cv.user_id = membership_user_id
    and c.group_id = membership_group_id
    and c.status = 'pending';

  select count(*)::integer
  into active_member_count
  from public.group_members gm
  where gm.group_id = membership_group_id
    and gm.status = 'active';

  for pending_content in
    select c.id
    from public.contents c
    where c.group_id = membership_group_id
      and c.status = 'pending'
    order by c.id
    for update
  loop
    select count(*)::integer
    into favorable_vote_count
    from public.content_votes cv
    join public.group_members gm
      on gm.group_id = membership_group_id
     and gm.user_id = cv.user_id
     and gm.status = 'active'
    where cv.content_id = pending_content.id
      and cv.vote = true;

    if favorable_vote_count > active_member_count / 2 then
      update public.contents
      set status = 'approved'
      where id = pending_content.id
        and status = 'pending';
    end if;
  end loop;
end;
$$;

revoke all on function public.set_content_vote(uuid, boolean) from public;
revoke all on function public.get_content_vote_summary(uuid) from public;
grant execute on function public.set_content_vote(uuid, boolean) to authenticated;
grant execute on function public.get_content_vote_summary(uuid) to authenticated;
