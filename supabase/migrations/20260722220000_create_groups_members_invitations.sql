create type public.group_role as enum ('owner', 'member');
create type public.membership_status as enum ('active', 'removed');

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint groups_name_length check (char_length(trim(name)) between 2 and 80),
  description text constraint groups_description_length check (description is null or char_length(description) <= 500),
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.group_role not null,
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (group_id, user_id),
  constraint group_members_removal_consistency check (
    (status = 'active' and removed_at is null)
    or (status = 'removed' and removed_at is not null)
  )
);

create unique index one_owner_per_group
  on public.group_members (group_id)
  where role = 'owner';

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  email text not null constraint group_invitations_email_normalized check (
    email = lower(trim(email)) and char_length(email) between 3 and 254 and position('@' in email) > 1
  ),
  token_hash text not null unique constraint group_invitations_token_hash_length check (char_length(token_hash) = 64),
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint group_invitations_max_expiration check (
    expires_at > created_at and expires_at <= created_at + interval '5 minutes'
  ),
  constraint group_invitations_single_outcome check (
    accepted_at is null or cancelled_at is null
  )
);

create unique index one_open_invitation_per_group_email
  on public.group_invitations (group_id, lower(email))
  where accepted_at is null and cancelled_at is null;

create index group_members_user_status_idx
  on public.group_members (user_id, status);

create index group_invitations_group_idx
  on public.group_invitations (group_id, created_at desc);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.status = 'active'
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.groups g
    join public.group_members gm
      on gm.group_id = g.id
     and gm.user_id = p_user_id
     and gm.role = 'owner'
     and gm.status = 'active'
    where g.id = p_group_id
      and g.owner_id = p_user_id
  );
$$;

create or replace function public.shares_active_group(p_user_id uuid, p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = p_user_id
      and theirs.user_id = p_other_user_id
      and mine.status = 'active'
      and theirs.status = 'active'
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public;
revoke all on function public.is_group_owner(uuid, uuid) from public;
revoke all on function public.shares_active_group(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;
grant execute on function public.shares_active_group(uuid, uuid) to authenticated;

create policy "Active members can read groups"
  on public.groups for select to authenticated
  using (public.is_group_member(id, (select auth.uid())));

create policy "Owners can update groups"
  on public.groups for update to authenticated
  using (public.is_group_owner(id, (select auth.uid())))
  with check (public.is_group_owner(id, (select auth.uid())));

create policy "Owners can delete groups"
  on public.groups for delete to authenticated
  using (public.is_group_owner(id, (select auth.uid())));

create policy "Active members can read memberships"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

create policy "Owners can read invitations"
  on public.group_invitations for select to authenticated
  using (public.is_group_owner(group_id, (select auth.uid())));

create policy "Users can read profiles from shared groups"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.shares_active_group((select auth.uid()), id)
  );

revoke all on public.groups from anon, authenticated;
revoke all on public.group_members from anon, authenticated;
revoke all on public.group_invitations from anon, authenticated;
grant select on public.groups, public.group_members, public.group_invitations to authenticated;
grant update (name, description) on public.groups to authenticated;
grant delete on public.groups to authenticated;

create or replace function public.set_groups_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_groups_updated_at
  before update on public.groups
  for each row execute function public.set_groups_updated_at();

create or replace function public.protect_group_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_owner uuid;
begin
  if tg_table_name = 'groups' and tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
    raise exception 'group owner cannot be changed';
  end if;

  if tg_table_name = 'group_members' then
    if tg_op = 'DELETE' then
      if old.role = 'owner' and exists (select 1 from public.groups where id = old.group_id) then
        raise exception 'group owner cannot be removed';
      end if;
      return old;
    end if;

    select owner_id into expected_owner from public.groups where id = new.group_id;

    if new.role = 'owner' and new.user_id <> expected_owner then
      raise exception 'only the group creator can be owner';
    end if;

    if tg_op = 'UPDATE' and old.role = 'owner'
       and (new.role <> 'owner' or new.status <> 'active' or new.user_id <> old.user_id) then
      raise exception 'group owner cannot be removed or demoted';
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_groups_owner_id
  before update on public.groups
  for each row execute function public.protect_group_owner();

create trigger protect_group_members_owner
  before insert or update or delete on public.group_members
  for each row execute function public.protect_group_owner();

create or replace function public.create_group(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  new_group_id uuid;
  clean_name text := trim(p_name);
  clean_description text := nullif(trim(p_description), '');
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if char_length(clean_name) not between 2 and 80 then raise exception 'invalid group name'; end if;
  if clean_description is not null and char_length(clean_description) > 500 then raise exception 'invalid description'; end if;

  insert into public.groups (name, description, owner_id)
  values (clean_name, clean_description, actor_id)
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_group_id, actor_id, 'owner');

  return new_group_id;
end;
$$;

create or replace function public.create_group_invitation(
  p_group_id uuid,
  p_email text,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text := lower(trim(p_email));
  invitation_id uuid;
begin
  if actor_id is null or not public.is_group_owner(p_group_id, actor_id) then
    raise exception 'not authorized';
  end if;
  if char_length(normalized_email) not between 3 and 254 or position('@' in normalized_email) <= 1 then
    raise exception 'invalid email';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid token hash'; end if;

  if exists (
    select 1 from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id and gm.status = 'active' and lower(p.email) = normalized_email
  ) then
    raise exception 'user is already an active member';
  end if;

  update public.group_invitations
  set cancelled_at = now()
  where group_id = p_group_id
    and email = normalized_email
    and accepted_at is null
    and cancelled_at is null;

  insert into public.group_invitations (
    group_id, email, token_hash, invited_by, expires_at
  ) values (
    p_group_id, normalized_email, p_token_hash, actor_id, now() + interval '5 minutes'
  ) returning id into invitation_id;

  return invitation_id;
end;
$$;

create or replace function public.cancel_group_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  invitation_group_id uuid;
begin
  select group_id into invitation_group_id
  from public.group_invitations
  where id = p_invitation_id and accepted_at is null and cancelled_at is null
  for update;

  if invitation_group_id is null or not public.is_group_owner(invitation_group_id, actor_id) then
    raise exception 'not authorized';
  end if;

  update public.group_invitations set cancelled_at = now() where id = p_invitation_id;
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
  membership_role public.group_role;
begin
  select group_id, role into membership_group_id, membership_role
  from public.group_members
  where id = p_membership_id and status = 'active'
  for update;

  if membership_group_id is null or not public.is_group_owner(membership_group_id, actor_id) then
    raise exception 'not authorized';
  end if;
  if membership_role = 'owner' then raise exception 'group owner cannot be removed'; end if;

  update public.group_members
  set status = 'removed', removed_at = now()
  where id = p_membership_id;
end;
$$;

create or replace function public.get_group_invitation(p_token_hash text)
returns table (
  invitation_id uuid,
  group_id uuid,
  group_name text,
  invited_email text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.group_id, g.name, i.email, i.expires_at
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  join auth.users u on u.id = auth.uid()
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.cancelled_at is null
    and i.expires_at > now()
    and lower(i.email) = lower(u.email)
  limit 1;
$$;

create or replace function public.accept_group_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  invitation_record public.group_invitations%rowtype;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  select lower(email) into actor_email from auth.users where id = actor_id;

  select * into invitation_record
  from public.group_invitations
  where token_hash = p_token_hash
  for update;

  if invitation_record.id is null
     or invitation_record.accepted_at is not null
     or invitation_record.cancelled_at is not null
     or invitation_record.expires_at <= now()
     or lower(invitation_record.email) <> actor_email then
    raise exception 'invalid invitation';
  end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (invitation_record.group_id, actor_id, 'member', 'active')
  on conflict (group_id, user_id) do update
  set role = 'member', status = 'active', joined_at = now(), removed_at = null
  where public.group_members.role <> 'owner';

  update public.group_invitations
  set accepted_at = now()
  where id = invitation_record.id;

  return invitation_record.group_id;
end;
$$;

revoke all on function public.create_group(text, text) from public;
revoke all on function public.create_group_invitation(uuid, text, text) from public;
revoke all on function public.cancel_group_invitation(uuid) from public;
revoke all on function public.remove_group_member(uuid) from public;
revoke all on function public.get_group_invitation(text) from public;
revoke all on function public.accept_group_invitation(text) from public;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.create_group_invitation(uuid, text, text) to authenticated;
grant execute on function public.cancel_group_invitation(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid) to authenticated;
grant execute on function public.get_group_invitation(text) to authenticated;
grant execute on function public.accept_group_invitation(text) to authenticated;
