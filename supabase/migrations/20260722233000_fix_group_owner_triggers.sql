drop trigger if exists protect_groups_owner_id on public.groups;
drop trigger if exists protect_group_members_owner on public.group_members;
drop function if exists public.protect_group_owner();

create or replace function public.protect_groups_owner_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'group owner cannot be changed';
  end if;

  return new;
end;
$$;

create or replace function public.protect_group_members_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_owner uuid;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner'
       and exists (select 1 from public.groups where id = old.group_id) then
      raise exception 'group owner cannot be removed';
    end if;

    return old;
  end if;

  select owner_id
  into expected_owner
  from public.groups
  where id = new.group_id;

  if new.role = 'owner' and new.user_id <> expected_owner then
    raise exception 'only the group creator can be owner';
  end if;

  if tg_op = 'UPDATE'
     and old.role = 'owner'
     and (
       new.role <> 'owner'
       or new.status <> 'active'
       or new.user_id <> old.user_id
     ) then
    raise exception 'group owner cannot be removed or demoted';
  end if;

  return new;
end;
$$;

create trigger protect_groups_owner_id
  before update on public.groups
  for each row execute function public.protect_groups_owner_id();

create trigger protect_group_members_owner
  before insert or update or delete on public.group_members
  for each row execute function public.protect_group_members_owner();
