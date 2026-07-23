create type public.content_type as enum (
  'movie',
  'series',
  'anime',
  'documentary',
  'book'
);

create type public.content_status as enum (
  'pending',
  'approved',
  'completed'
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  type public.content_type not null,
  title text not null constraint contents_title_valid check (
    title = trim(title) and char_length(title) between 1 and 160
  ),
  description text not null constraint contents_description_valid check (
    description = trim(description)
    and char_length(description) between 1 and 4000
    and description !~ '[<>]'
  ),
  thumbnail_url text not null constraint contents_thumbnail_https check (
    thumbnail_url = trim(thumbnail_url)
    and thumbnail_url ~ '^https://[^[:space:]]+$'
  ),
  -- Non-book entries store only the normalized 11-character YouTube video ID.
  trailer_url text,
  status public.content_status not null default 'pending',
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contents_trailer_by_type check (
    (type = 'book' and trailer_url is null)
    or (
      type in ('movie', 'series', 'anime', 'documentary')
      and trailer_url ~ '^[A-Za-z0-9_-]{11}$'
    )
  ),
  constraint contents_completion_consistency check (
    (status <> 'completed' and completed_at is null and completed_by is null)
    or (status = 'completed' and completed_at is not null and completed_by is not null)
  )
);

create index contents_group_status_created_idx
  on public.contents (group_id, status, created_at desc);

create index contents_created_by_pending_idx
  on public.contents (created_by, group_id)
  where status = 'pending';

alter table public.contents enable row level security;

create policy "Active members can read contents"
  on public.contents for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "Active members can create contents"
  on public.contents for insert to authenticated
  with check (
    public.is_group_member(group_id, (select auth.uid()))
    and created_by = (select auth.uid())
    and status = 'pending'
    and completed_at is null
    and completed_by is null
  );

create policy "Creators can update their pending contents"
  on public.contents for update to authenticated
  using (
    public.is_group_member(group_id, (select auth.uid()))
    and created_by = (select auth.uid())
    and status = 'pending'
  )
  with check (
    public.is_group_member(group_id, (select auth.uid()))
    and created_by = (select auth.uid())
    and status = 'pending'
    and completed_at is null
    and completed_by is null
  );

create policy "Creators can delete their pending contents"
  on public.contents for delete to authenticated
  using (
    public.is_group_member(group_id, (select auth.uid()))
    and created_by = (select auth.uid())
    and status = 'pending'
  );

revoke all on public.contents from anon, authenticated;
grant select on public.contents to authenticated;
grant insert (group_id, created_by, type, title, description, thumbnail_url, trailer_url)
  on public.contents to authenticated;
grant update (type, title, description, thumbnail_url, trailer_url)
  on public.contents to authenticated;
grant delete on public.contents to authenticated;

create or replace function public.set_contents_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_contents_updated_at
  before update on public.contents
  for each row execute function public.set_contents_updated_at();
