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
  -- OTP requests create auth.users before authentication succeeds. Only create
  -- the application profile after Supabase has issued the first session.
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
  -- profiles is the source of truth for user-editable fields. A subsequent
  -- login must never restore stale Auth metadata over those customizations.
  set email = excluded.email;

  return new;
end;
$$;

create trigger on_auth_user_profile_sync
  after insert or update of email, last_sign_in_at
  on auth.users
  for each row execute function public.handle_auth_user_profile();

revoke all on function public.handle_auth_user_profile()
  from public, anon, authenticated;
