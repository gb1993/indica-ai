begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '95000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'avatar-owner@example.test', '', now(), now(), '{}', '{"name":"Avatar Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '95000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'avatar-other@example.test', '', now(), now(), '{}', '{"name":"Avatar Other"}', now(), now());

insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'avatars',
  '95000000-0000-0000-0000-000000000002/avatar.webp',
  '95000000-0000-0000-0000-000000000002',
  '{"mimetype":"image/webp","size":1024}'::jsonb
);

select ok(
  (
    select public
      and file_size_limit = 1048576
      and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
    from storage.buckets
    where id = 'avatars'
  ),
  'bucket público limita avatares a 1 MB e formatos de imagem seguros'
);

set local role anon;
select throws_ok(
  $$insert into storage.objects (bucket_id, name, metadata)
    values (
      'avatars',
      'anonymous/avatar.webp',
      '{"mimetype":"image/webp","size":1024}'::jsonb
    )$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'usuário anônimo não consegue enviar avatar'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  0::bigint,
  'usuário anônimo não consegue listar metadados dos avatares'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'avatars',
      '95000000-0000-0000-0000-000000000001/avatar.webp',
      '95000000-0000-0000-0000-000000000001',
      '{"mimetype":"image/webp","size":1024}'::jsonb
    )$$,
  'usuário envia avatar no próprio diretório'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'avatars'
      and name = '95000000-0000-0000-0000-000000000001/avatar.webp'
  ),
  1::bigint,
  'usuário consegue ler os metadados do próprio avatar'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'avatars'
      and name = '95000000-0000-0000-0000-000000000002/avatar.webp'
  ),
  0::bigint,
  'usuário não consegue ler os metadados do avatar de outra pessoa'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'avatars',
      '95000000-0000-0000-0000-000000000002/avatar.webp',
      '95000000-0000-0000-0000-000000000001',
      '{"mimetype":"image/webp","size":1024}'::jsonb
    )$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'usuário não envia avatar no diretório de outra pessoa'
);

select lives_ok(
  $$update storage.objects
    set metadata = '{"mimetype":"image/webp","size":2048}'::jsonb
    where bucket_id = 'avatars'
      and name = '95000000-0000-0000-0000-000000000001/avatar.webp'$$,
  'usuário substitui o próprio avatar'
);

select is(
  (
    select avatar_url
    from public.profiles
    where id = '95000000-0000-0000-0000-000000000001'
  ),
  null,
  'perfil começa sem avatar'
);

update public.profiles
set avatar_url = 'https://example.test/storage/avatar.webp'
where id = '95000000-0000-0000-0000-000000000001';

select is(
  (
    select avatar_url
    from public.profiles
    where id = '95000000-0000-0000-0000-000000000001'
  ),
  'https://example.test/storage/avatar.webp',
  'usuário atualiza a URL do próprio avatar'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete their own avatar'
      and cmd = 'DELETE'
      and roles @> array['authenticated']::name[]
  ),
  'política permite remoção do próprio avatar pela Storage API'
);

select ok(
  not has_function_privilege('anon', 'public.log_content_activity()', 'EXECUTE'),
  'função de trigger não pode ser executada por usuário anônimo'
);

select ok(
  not has_function_privilege('authenticated', 'public.log_content_activity()', 'EXECUTE'),
  'função de trigger não pode ser executada diretamente por usuário autenticado'
);

select * from finish();
rollback;
