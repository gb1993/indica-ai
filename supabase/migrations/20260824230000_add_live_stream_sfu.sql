alter table public.live_stream_sessions
  add column sfu_session_id text,
  add column sfu_tracks jsonb;

alter table public.live_stream_sessions
  add constraint live_stream_sfu_fields_match check (
    (sfu_session_id is null and sfu_tracks is null)
    or (
      length(sfu_session_id) between 1 and 200
      and jsonb_typeof(sfu_tracks) = 'array'
      and jsonb_array_length(sfu_tracks) between 1 and 8
    )
  );

create or replace function public.activate_live_stream_sfu(
  p_session_id uuid,
  p_sfu_session_id text,
  p_sfu_tracks jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if length(p_sfu_session_id) not between 1 and 200
     or jsonb_typeof(p_sfu_tracks) <> 'array'
     or jsonb_array_length(p_sfu_tracks) not between 1 and 8
     or exists (
       select 1
       from jsonb_array_elements(p_sfu_tracks) track
       where track->>'location' <> 'remote'
          or track->>'sessionId' <> p_sfu_session_id
          or coalesce(length(track->>'trackName'), 0) not between 1 and 200
     ) then
    raise exception 'invalid SFU tracks';
  end if;

  update public.live_stream_sessions
  set status = 'live',
      started_at = now(),
      last_heartbeat_at = now(),
      sfu_session_id = p_sfu_session_id,
      sfu_tracks = p_sfu_tracks
  where id = p_session_id
    and host_user_id = actor_id
    and status = 'starting';

  if not found then
    raise exception 'live stream is unavailable for SFU activation';
  end if;
end;
$$;

revoke execute on function public.activate_live_stream(uuid) from authenticated;
revoke all on function public.activate_live_stream_sfu(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.activate_live_stream_sfu(uuid, text, jsonb)
  to authenticated;

drop policy "Group members can receive live presence and signaling"
  on realtime.messages;
drop policy "Group members can publish their live presence and signaling"
  on realtime.messages;

create policy "Group members can receive live channel events"
  on realtime.messages for select to authenticated
  using (
    public.can_access_live_stream_topic(
      (select realtime.topic()),
      (select auth.uid())
    )
    and public.live_stream_sender_id_from_topic((select realtime.topic())) is null
  );

create policy "Group members can publish live presence"
  on realtime.messages for insert to authenticated
  with check (
    public.can_access_live_stream_topic(
      (select realtime.topic()),
      (select auth.uid())
    )
    and realtime.messages.extension = 'presence'
    and public.live_stream_sender_id_from_topic((select realtime.topic())) is null
  );
