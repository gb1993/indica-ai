create temporary table removed_content_ids (
  id uuid primary key
) on commit drop;

insert into removed_content_ids (id)
select id
from public.contents
where type::text in ('anime', 'book');

delete from public.contents
where id in (select id from removed_content_ids);

-- Content deletion creates an activity entry. Remove both historical and newly
-- generated activity records for the content types being retired.
delete from public.group_activities
where entity_type = 'content'
  and entity_id in (select id from removed_content_ids);

drop function if exists public.get_group_top_rated_contents(uuid);
drop function if exists public.get_group_most_discussed_contents(uuid);

alter table public.contents
  drop constraint contents_trailer_by_type;

alter type public.content_type rename to content_type_legacy;

create type public.content_type as enum (
  'movie',
  'series',
  'documentary'
);

alter table public.contents
  alter column type type public.content_type
  using type::text::public.content_type;

drop type public.content_type_legacy;

alter table public.contents
  add column tmdb_id integer,
  add column tmdb_media_type text,
  add constraint contents_trailer_format check (
    trailer_url is null
    or trailer_url ~ '^[A-Za-z0-9_-]{11}$'
  ),
  add constraint contents_tmdb_identity check (
    (
      tmdb_id is null
      and tmdb_media_type is null
    )
    or (
      tmdb_id is not null
      and tmdb_media_type is not null
      and
      tmdb_id > 0
      and tmdb_media_type in ('movie', 'tv')
      and (
        (type = 'series' and tmdb_media_type = 'tv')
        or (type = 'movie' and tmdb_media_type = 'movie')
        or type = 'documentary'
      )
    )
  );

create unique index contents_group_tmdb_identity_key
  on public.contents (group_id, tmdb_media_type, tmdb_id)
  where tmdb_id is not null;

grant insert (tmdb_id, tmdb_media_type)
  on table public.contents
  to authenticated;

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
revoke all on function public.get_group_most_discussed_contents(uuid)
  from public, anon, authenticated;
grant execute on function public.get_group_top_rated_contents(uuid)
  to authenticated;
grant execute on function public.get_group_most_discussed_contents(uuid)
  to authenticated;
