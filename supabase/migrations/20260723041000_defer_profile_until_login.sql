drop trigger if exists on_auth_user_profile_sync on auth.users;

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  profile_avatar text;
begin
  -- signInWithOtp creates a pending auth.users row before the code is checked.
  -- last_sign_in_at is filled only when verification succeeds and a session is
  -- issued, so pending requests must not become application profiles.
  if new.last_sign_in_at is null then
    return new;
  end if;

  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'usuario'), '@', 1)
  );
  profile_avatar := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );

  insert into public.profiles (id, name, email, avatar_url)
  values (new.id, profile_name, coalesce(new.email, ''), profile_avatar)
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      avatar_url = excluded.avatar_url;

  return new;
end;
$$;

create trigger on_auth_user_profile_sync
  after insert or update of email, raw_user_meta_data, last_sign_in_at
  on auth.users
  for each row execute function public.handle_auth_user_profile();

revoke all on function public.handle_auth_user_profile()
  from public, anon, authenticated;

-- Reconcile requests made before this migration that never completed a login.
-- Such profiles cannot own application data because they never received a
-- session, but deleting by this predicate keeps the operation narrowly scoped.
delete from public.profiles p
using auth.users u
where p.id = u.id
  and u.last_sign_in_at is null;
