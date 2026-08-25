create table public.live_stream_usage_reports (
  billing_day date not null,
  live_session_id uuid not null references public.live_stream_sessions(id) on delete cascade,
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  last_total_bytes bigint not null default 0 check (last_total_bytes >= 0),
  accounted_bytes bigint not null default 0 check (accounted_bytes >= 0),
  last_reported_at timestamptz not null default now(),
  primary key (billing_day, live_session_id, viewer_user_id)
);

create table public.live_stream_usage_daily (
  billing_day date primary key,
  observed_bytes bigint not null default 0 check (observed_bytes >= 0),
  updated_at timestamptz not null default now()
);

alter table public.live_stream_usage_reports enable row level security;
alter table public.live_stream_usage_daily enable row level security;

revoke all on table public.live_stream_usage_reports from public, anon, authenticated;
revoke all on table public.live_stream_usage_daily from public, anon, authenticated;

create or replace function public.report_live_stream_viewer_usage(
  p_session_id uuid,
  p_total_bytes bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_day date := (now() at time zone 'utc')::date;
  previous_total bigint;
  previous_reported_at timestamptz;
  raw_delta bigint;
  accepted_delta bigint;
  maximum_delta bigint;
begin
  if actor_id is null or p_total_bytes < 0 or p_total_bytes > 10000000000000 then
    raise exception 'invalid live stream usage report';
  end if;

  if not exists (
    select 1
    from public.live_stream_sessions session
    join public.group_members member
      on member.group_id = session.group_id
     and member.user_id = actor_id
     and member.status = 'active'
    where session.id = p_session_id
      and session.status = 'live'
      and session.host_user_id <> actor_id
  ) then
    raise exception 'viewer cannot report usage for this live stream';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      current_day::text || ':' || p_session_id::text || ':' || actor_id::text,
      0
    )
  );

  select last_total_bytes, last_reported_at
  into previous_total, previous_reported_at
  from public.live_stream_usage_reports
  where billing_day = current_day
    and live_session_id = p_session_id
    and viewer_user_id = actor_id
  for update;

  if previous_reported_at is null then
    raw_delta := p_total_bytes;
    maximum_delta := 100000000;
    insert into public.live_stream_usage_reports (
      billing_day,
      live_session_id,
      viewer_user_id,
      last_total_bytes,
      accounted_bytes,
      last_reported_at
    ) values (
      current_day,
      p_session_id,
      actor_id,
      p_total_bytes,
      0,
      now()
    );
  else
    raw_delta := case
      when p_total_bytes >= previous_total then p_total_bytes - previous_total
      else p_total_bytes
    end;
    maximum_delta := 10000000 + greatest(
      1,
      extract(epoch from now() - previous_reported_at)::bigint
    ) * 5000000;

    update public.live_stream_usage_reports
    set last_total_bytes = p_total_bytes,
        last_reported_at = now()
    where billing_day = current_day
      and live_session_id = p_session_id
      and viewer_user_id = actor_id;
  end if;

  accepted_delta := least(raw_delta, maximum_delta);

  update public.live_stream_usage_reports
  set accounted_bytes = accounted_bytes + accepted_delta
  where billing_day = current_day
    and live_session_id = p_session_id
    and viewer_user_id = actor_id;

  insert into public.live_stream_usage_daily (
    billing_day,
    observed_bytes,
    updated_at
  ) values (
    current_day,
    accepted_delta,
    now()
  )
  on conflict (billing_day) do update
  set observed_bytes = public.live_stream_usage_daily.observed_bytes + excluded.observed_bytes,
      updated_at = now();

  return accepted_delta;
end;
$$;

create or replace function public.get_live_stream_observed_usage(
  p_since timestamptz
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(observed_bytes), 0)::bigint
  from public.live_stream_usage_daily
  where billing_day >= greatest(
    date_trunc('month', now() at time zone 'utc')::date,
    (p_since at time zone 'utc')::date
  );
$$;

revoke all on function public.report_live_stream_viewer_usage(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.get_live_stream_observed_usage(timestamptz)
  from public, anon, authenticated;
grant execute on function public.report_live_stream_viewer_usage(uuid, bigint)
  to authenticated;
grant execute on function public.get_live_stream_observed_usage(timestamptz)
  to authenticated;
