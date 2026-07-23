create or replace function public.snapshot_activity_actor_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
begin
  if new.actor_id is not null and not (new.metadata ? 'actor_name') then
    select p.name into actor_name
    from public.profiles p
    where p.id = new.actor_id;

    if actor_name is not null then
      new.metadata := new.metadata || jsonb_build_object('actor_name', actor_name);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.snapshot_activity_actor_name() from public;

create trigger snapshot_group_activity_actor_name
  before insert on public.group_activities
  for each row execute function public.snapshot_activity_actor_name();
