begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '96000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'profile-owner@example.test', '', now(), now(), '{}', '{"name":"Nome Original"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '96000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'profile-other@example.test', '', now(), now(), '{}', '{"name":"Outro Usuário"}', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$update public.profiles
    set name = 'Nome Atualizado'
    where id = '96000000-0000-0000-0000-000000000001'$$,
  'usuário atualiza o próprio nome'
);

reset role;
select is(
  (
    select name
    from public.profiles
    where id = '96000000-0000-0000-0000-000000000001'
  ),
  'Nome Atualizado',
  'novo nome é persistido'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);

update public.profiles
set name = 'Alteração Indevida'
where id = '96000000-0000-0000-0000-000000000002';

reset role;
select is(
  (
    select name
    from public.profiles
    where id = '96000000-0000-0000-0000-000000000002'
  ),
  'Outro Usuário',
  'usuário não altera o nome de outro perfil'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$update public.profiles
    set email = 'novo-email@example.test'
    where id = '96000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table profiles',
  'alteração do nome não concede acesso ao e-mail'
);

select * from finish();
rollback;
