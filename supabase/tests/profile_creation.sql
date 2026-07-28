begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'pending@example.com',
  '',
  now(),
  '{}',
  '{"name":"Pending"}',
  now(),
  now()
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '91000000-0000-0000-0000-000000000001'
  ),
  0,
  'solicitar código não cria perfil'
);

update auth.users
set email_confirmed_at = now()
where id = '91000000-0000-0000-0000-000000000001';

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '91000000-0000-0000-0000-000000000001'
  ),
  0,
  'confirmação implícita do e-mail sem sessão não cria perfil'
);

update auth.users
set last_sign_in_at = now()
where id = '91000000-0000-0000-0000-000000000001';

select ok(
  exists (
    select 1
    from public.profiles
    where id = '91000000-0000-0000-0000-000000000001'
      and name = 'Pending'
      and email = 'pending@example.com'
  ),
  'primeiro login confirmado cria perfil'
);

update public.profiles
set
  name = 'Nome personalizado',
  avatar_url = 'https://storage.example/avatar.webp'
where id = '91000000-0000-0000-0000-000000000001';

update auth.users
set
  raw_user_meta_data = '{"name":"Metadado antigo","avatar_url":"https://auth.example/avatar.webp"}',
  last_sign_in_at = now() + interval '1 minute'
where id = '91000000-0000-0000-0000-000000000001';

select results_eq(
  $$select name, avatar_url
    from public.profiles
    where id = '91000000-0000-0000-0000-000000000001'$$,
  $$values (
    'Nome personalizado'::text,
    'https://storage.example/avatar.webp'::text
  )$$,
  'novo login preserva nome e avatar personalizados'
);

update auth.users
set email = 'email-atualizado@example.com'
where id = '91000000-0000-0000-0000-000000000001';

select is(
  (
    select email
    from public.profiles
    where id = '91000000-0000-0000-0000-000000000001'
  ),
  'email-atualizado@example.com',
  'e-mail continua sincronizado pelo Auth'
);

select * from finish();
rollback;
