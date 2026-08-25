-- Public buckets serve files through their public URLs without requiring a
-- public SELECT policy on storage.objects. Restrict metadata/listing access to
-- the owner so avatar upserts keep working without exposing the bucket index.
drop policy if exists "Avatar images are publicly readable"
  on storage.objects;

drop policy if exists "Users can read their own avatar metadata"
  on storage.objects;

create policy "Users can read their own avatar metadata"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Trigger functions are invoked by PostgreSQL and must not be callable through
-- the Data API. Revoke every API role explicitly because projects can carry
-- role-specific grants in addition to PostgreSQL's default PUBLIC grant.
revoke all on function public.log_content_activity()
  from public, anon, authenticated;

-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- Make future functions private until a migration grants the intended API role.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
