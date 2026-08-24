create type public.live_stream_status as enum ('starting', 'live', 'ended');

create table public.live_stream_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id),
  topic text not null unique,
  status public.live_stream_status not null default 'starting',
  started_at timestamptz,
  ended_at timestamptz,
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_stream_topic_matches_id check (
    topic = 'live:' || id::text
  ),
  constraint live_stream_timestamps_match_status check (
    (status = 'starting' and started_at is null and ended_at is null)
    or (status = 'live' and started_at is not null and ended_at is null)
    or (status = 'ended' and ended_at is not null)
  )
);

create unique index one_active_live_stream_per_group
  on public.live_stream_sessions (group_id)
  where status in ('starting', 'live');

create index live_stream_sessions_group_created_idx
  on public.live_stream_sessions (group_id, created_at desc);

create index live_stream_sessions_active_heartbeat_idx
  on public.live_stream_sessions (last_heartbeat_at)
  where status in ('starting', 'live');

alter table public.live_stream_sessions enable row level security;

create policy "Active members can read live stream sessions"
  on public.live_stream_sessions for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

revoke all on table public.live_stream_sessions from anon, authenticated;
grant select on table public.live_stream_sessions to authenticated;

create or replace function public.set_live_stream_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_live_stream_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.group_id <> old.group_id
     or new.host_user_id <> old.host_user_id
     or new.topic <> old.topic
     or new.created_at <> old.created_at then
    raise exception 'live stream identity cannot be changed';
  end if;

  if old.status = 'ended' and new.status <> 'ended' then
    raise exception 'ended live stream cannot be resumed';
  end if;

  if old.status = 'live' and new.status = 'starting' then
    raise exception 'live stream cannot return to starting';
  end if;

  return new;
end;
$$;

create trigger set_live_stream_updated_at
  before update on public.live_stream_sessions
  for each row execute function public.set_live_stream_updated_at();

create trigger protect_live_stream_session
  before update on public.live_stream_sessions
  for each row execute function public.protect_live_stream_session();

create or replace function public.start_live_stream(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  new_session_id uuid := gen_random_uuid();
begin
  if actor_id is null or not public.is_group_member(p_group_id, actor_id) then
    raise exception 'not authorized';
  end if;

  -- A dead browser cannot update the database during unload reliably. Expire
  -- only sessions whose host heartbeat has been absent for the agreed window.
  update public.live_stream_sessions
  set status = 'ended', ended_at = now()
  where group_id = p_group_id
    and status in ('starting', 'live')
    and last_heartbeat_at < now() - interval '90 seconds';

  begin
    insert into public.live_stream_sessions (
      id,
      group_id,
      host_user_id,
      topic,
      status,
      last_heartbeat_at
    ) values (
      new_session_id,
      p_group_id,
      actor_id,
      'live:' || new_session_id::text,
      'starting',
      now()
    );
  exception
    when unique_violation then
      raise exception 'live stream already active';
  end;

  return new_session_id;
end;
$$;

create or replace function public.activate_live_stream(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  update public.live_stream_sessions
  set status = 'live', started_at = now(), last_heartbeat_at = now()
  where id = p_session_id
    and host_user_id = actor_id
    and status = 'starting';

  if not found then
    raise exception 'live stream is unavailable for activation';
  end if;
end;
$$;

create or replace function public.heartbeat_live_stream(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  update public.live_stream_sessions
  set last_heartbeat_at = now()
  where id = p_session_id
    and host_user_id = actor_id
    and status in ('starting', 'live');

  if not found then
    raise exception 'live stream is unavailable for heartbeat';
  end if;
end;
$$;

create or replace function public.end_live_stream(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  session_host_id uuid;
  session_status public.live_stream_status;
begin
  select host_user_id, status
  into session_host_id, session_status
  from public.live_stream_sessions
  where id = p_session_id
  for update;

  if session_host_id is null or session_host_id <> actor_id then
    raise exception 'only the host can end the live stream';
  end if;

  if session_status = 'ended' then
    return;
  end if;

  update public.live_stream_sessions
  set status = 'ended', ended_at = now()
  where id = p_session_id;
end;
$$;

create or replace function public.live_stream_session_id_from_topic(p_topic text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_topic !~ '^live:[0-9a-fA-F-]{36}(:signal:[0-9a-fA-F-]{36})?$' then
    return null;
  end if;

  return split_part(p_topic, ':', 2)::uuid;
exception
  when invalid_text_representation then return null;
end;
$$;

create or replace function public.live_stream_sender_id_from_topic(p_topic text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_topic !~ '^live:[0-9a-fA-F-]{36}:signal:[0-9a-fA-F-]{36}$' then
    return null;
  end if;

  return split_part(p_topic, ':', 4)::uuid;
exception
  when invalid_text_representation then return null;
end;
$$;

create or replace function public.can_access_live_stream_topic(
  p_topic text,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.live_stream_sessions session
    join public.group_members member
      on member.group_id = session.group_id
     and member.user_id = p_user_id
     and member.status = 'active'
    where session.id = public.live_stream_session_id_from_topic(p_topic)
      and session.status in ('starting', 'live')
  );
$$;

create policy "Group members can receive live presence and signaling"
  on realtime.messages for select to authenticated
  using (
    public.can_access_live_stream_topic(
      (select realtime.topic()),
      (select auth.uid())
    )
    and realtime.messages.extension in ('broadcast', 'presence')
  );

create policy "Group members can publish their live presence and signaling"
  on realtime.messages for insert to authenticated
  with check (
    public.can_access_live_stream_topic(
      (select realtime.topic()),
      (select auth.uid())
    )
    and (
      (
        realtime.messages.extension = 'presence'
        and public.live_stream_sender_id_from_topic((select realtime.topic())) is null
      )
      or (
        realtime.messages.extension = 'broadcast'
        and public.live_stream_sender_id_from_topic((select realtime.topic())) = (select auth.uid())
      )
    )
  );

revoke all on function public.set_live_stream_updated_at() from public, anon, authenticated;
revoke all on function public.protect_live_stream_session() from public, anon, authenticated;
revoke all on function public.start_live_stream(uuid) from public, anon, authenticated;
revoke all on function public.activate_live_stream(uuid) from public, anon, authenticated;
revoke all on function public.heartbeat_live_stream(uuid) from public, anon, authenticated;
revoke all on function public.end_live_stream(uuid) from public, anon, authenticated;
revoke all on function public.live_stream_session_id_from_topic(text) from public, anon, authenticated;
revoke all on function public.live_stream_sender_id_from_topic(text) from public, anon, authenticated;
revoke all on function public.can_access_live_stream_topic(text, uuid) from public, anon, authenticated;

grant execute on function public.start_live_stream(uuid) to authenticated;
grant execute on function public.activate_live_stream(uuid) to authenticated;
grant execute on function public.heartbeat_live_stream(uuid) to authenticated;
grant execute on function public.end_live_stream(uuid) to authenticated;
grant execute on function public.live_stream_session_id_from_topic(text) to authenticated;
grant execute on function public.live_stream_sender_id_from_topic(text) to authenticated;
grant execute on function public.can_access_live_stream_topic(text, uuid) to authenticated;
