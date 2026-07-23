begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'author@example.com', '', now(), now(), '{}', '{"name":"Author"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'reader@example.com', '', now(), now(), '{}', '{"name":"Reader"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'stranger@example.com', '', now(), now(), '{}', '{"name":"Stranger"}', now(), now());

insert into public.groups (id, name, owner_id)
values ('72000000-0000-0000-0000-000000000001', 'Grupo de conteúdo', '71000000-0000-0000-0000-000000000001');

insert into public.group_members (id, group_id, user_id, role)
values
  ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'owner'),
  ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'member');

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$insert into public.contents (group_id, created_by, type, title)
    values ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', 'movie', 'Indevido')$$,
  '42501',
  'new row violates row-level security policy for table "contents"',
  'não membro não cadastra conteúdo'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
insert into public.contents (id, group_id, created_by, type, title)
values ('74000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'movie', 'Cadastro mínimo');
reset role;
select ok(
  exists (
    select 1 from public.contents
    where id = '74000000-0000-0000-0000-000000000001'
      and description is null
      and thumbnail_url is null
      and trailer_url is null
  ),
  'descrição, thumbnail e trailer são opcionais'
);

select throws_ok(
  $$insert into public.contents (group_id, created_by, type, title, thumbnail_url)
    values ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'movie', 'HTTP', 'http://example.com/image.jpg')$$,
  '23514',
  null,
  'thumbnail preenchida precisa usar HTTPS'
);
select throws_ok(
  $$insert into public.contents (group_id, created_by, type, title, trailer_url)
    values ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'book', 'Livro com trailer', 'dQw4w9WgXcQ')$$,
  '23514',
  null,
  'livro não aceita trailer'
);
select throws_ok(
  $$insert into public.contents (group_id, created_by, type, title, description)
    values ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'movie', 'HTML', '<script>')$$,
  '23514',
  null,
  'descrição rejeita HTML'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
update public.contents
set title = 'Alteração alheia'
where id = '74000000-0000-0000-0000-000000000001';
reset role;
select is(
  (select title from public.contents where id = '74000000-0000-0000-0000-000000000001'),
  'Cadastro mínimo',
  'outro membro não edita conteúdo alheio'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
update public.contents
set title = 'Título alterado'
where id = '74000000-0000-0000-0000-000000000001';
reset role;
select is(
  (select title from public.contents where id = '74000000-0000-0000-0000-000000000001'),
  'Título alterado',
  'autor edita o próprio conteúdo pendente'
);

update public.contents
set status = 'approved'
where id = '74000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
update public.contents
set title = 'Não deve mudar'
where id = '74000000-0000-0000-0000-000000000001';
reset role;
select is(
  (select title from public.contents where id = '74000000-0000-0000-0000-000000000001'),
  'Título alterado',
  'conteúdo aprovado fica bloqueado para edição'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_content_message(
    '74000000-0000-0000-0000-000000000001',
    E'  Mensagem   com\n espaços  '
  )$$,
  'membro publica mensagem'
);
select is(
  (
    select content from public.content_messages
    where content_id = '74000000-0000-0000-0000-000000000001'
    order by created_at desc
    limit 1
  ),
  'Mensagem com espaços',
  'mensagem é normalizada no banco'
);
select throws_ok(
  $$select public.create_content_message(
    '74000000-0000-0000-0000-000000000001',
    '<strong>HTML</strong>'
  )$$,
  'P0001',
  'invalid message',
  'mensagem rejeita HTML'
);

create temporary table test_message as
select id
from public.content_messages
where content_id = '74000000-0000-0000-0000-000000000001'
order by created_at desc
limit 1;

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
select throws_ok(
  format(
    'select public.update_content_message(%L, %L)',
    (select id from test_message),
    'Edição alheia'
  ),
  'P0001',
  'message is unavailable for editing',
  'outro membro não edita mensagem alheia'
);
select throws_ok(
  format(
    'select public.delete_content_message(%L)',
    (select id from test_message)
  ),
  'P0001',
  'message is unavailable for deletion',
  'outro membro não exclui mensagem alheia'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select lives_ok(
  format(
    'select public.update_content_message(%L, %L)',
    (select id from test_message),
    'Mensagem editada'
  ),
  'autor edita a própria mensagem'
);
select lives_ok(
  format(
    'select public.delete_content_message(%L)',
    (select id from test_message)
  ),
  'autor faz soft delete da própria mensagem'
);
select ok(
  (select deleted_at is not null from public.content_messages where id = (select id from test_message)),
  'soft delete preserva registro e marca deleted_at'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
select is(
  (
    select count(*)::integer from public.group_activities
    where group_id = '72000000-0000-0000-0000-000000000001'
  ),
  0,
  'atividades não vazam para não membros'
);
reset role;

select * from finish();
rollback;
