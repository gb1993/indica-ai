begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.com', '', now(), now(), '{}', '{"name":"Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'member@example.com', '', now(), now(), '{}', '{"name":"Member"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'outsider@example.com', '', now(), now(), '{}', '{"name":"Outsider"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'invitee@example.com', '', now(), now(), '{}', '{"name":"Invitee"}', now(), now());

create temporary table test_group (id uuid not null);

select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
insert into test_group
select public.create_group('Grupo seguro', 'Descrição segura');
grant select on test_group to authenticated;

select is(
  (select name from public.groups where id = (select id from test_group)),
  'Grupo seguro',
  'usuário autenticado cria grupo'
);
select ok(
  exists (
    select 1 from public.group_members
    where group_id = (select id from test_group)
      and user_id = '61000000-0000-0000-0000-000000000001'
      and role = 'owner'
      and status = 'active'
  ),
  'criador é registrado como único owner ativo'
);
select throws_ok(
  format(
    'update public.groups set owner_id = %L where id = %L',
    '61000000-0000-0000-0000-000000000002',
    (select id from test_group)
  ),
  'P0001',
  'group owner cannot be changed',
  'owner do grupo não pode ser trocado por update direto'
);

insert into public.group_members (group_id, user_id, role)
select id, '61000000-0000-0000-0000-000000000002', 'member'
from test_group;

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*)::integer from public.groups where id = (select id from test_group)),
  0,
  'não membro não enxerga o grupo por RLS'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
update public.groups set name = 'Alteração indevida' where id = (select id from test_group);
reset role;
select is(
  (select name from public.groups where id = (select id from test_group)),
  'Grupo seguro',
  'membro comum não altera configurações do grupo'
);

select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select throws_ok(
  format(
    'select public.create_group_invitation(%L, %L, %L)',
    (select id from test_group),
    'invitee@example.com',
    repeat('a', 64)
  ),
  'P0001',
  'not authorized',
  'somente owner cria convite'
);

select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select public.create_group_invitation(
  (select id from test_group),
  '  Invitee@Example.com ',
  repeat('a', 64)
);
select is(
  (
    select email from public.group_invitations
    where group_id = (select id from test_group)
      and token_hash = repeat('a', 64)
  ),
  'invitee@example.com',
  'e-mail do convite é normalizado'
);

select public.create_group_invitation(
  (select id from test_group),
  'invitee@example.com',
  repeat('b', 64)
);
select is(
  (
    select count(*)::integer from public.group_invitations
    where group_id = (select id from test_group)
      and email = 'invitee@example.com'
      and accepted_at is null
      and cancelled_at is null
  ),
  1,
  'reenvio mantém somente um convite aberto, inclusive sob a constraint de concorrência'
);
select ok(
  (
    select cancelled_at is not null from public.group_invitations
    where token_hash = repeat('a', 64)
  ),
  'reenvio invalida o token anterior'
);

select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000003', true);
select is(
  (
    select count(*)::integer
    from public.get_group_invitation(repeat('b', 64))
  ),
  0,
  'convite não revela dados para outro e-mail'
);
select throws_ok(
  format('select public.accept_group_invitation(%L)', repeat('b', 64)),
  'P0001',
  'invalid invitation',
  'usuário com outro e-mail não aceita convite'
);

select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000004', true);
select is(
  public.accept_group_invitation(repeat('b', 64)),
  (select id from test_group),
  'destinatário aceita convite válido'
);
select ok(
  exists (
    select 1 from public.group_members
    where group_id = (select id from test_group)
      and user_id = '61000000-0000-0000-0000-000000000004'
      and role = 'member'
      and status = 'active'
  ),
  'aceite cria associação ativa'
);
select throws_ok(
  format('select public.accept_group_invitation(%L)', repeat('b', 64)),
  'P0001',
  'invalid invitation',
  'token aceito não pode ser reutilizado, inclusive após disputa concorrente'
);

select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select throws_ok(
  format(
    'select public.remove_group_member(%L)',
    (
      select id from public.group_members
      where group_id = (select id from test_group)
        and role = 'owner'
    )
  ),
  'P0001',
  'group owner cannot be removed',
  'owner não pode ser removido'
);

select * from finish();
rollback;
