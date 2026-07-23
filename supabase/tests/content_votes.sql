begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'vote1@example.com', '', now(), '{}', '{"name":"Vote 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'vote2@example.com', '', now(), '{}', '{"name":"Vote 2"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'vote3@example.com', '', now(), '{}', '{"name":"Vote 3"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'vote4@example.com', '', now(), '{}', '{"name":"Vote 4"}', now(), now());

insert into public.groups (id, name, owner_id)
values ('20000000-0000-0000-0000-000000000001', 'Grupo de votação', '10000000-0000-0000-0000-000000000001');

insert into public.group_members (id, group_id, user_id, role)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'member'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'member'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'member');

insert into public.contents (id, group_id, created_by, type, title)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'book', 'Conteúdo principal'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'book', 'Recalcular maioria'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'book', 'Remover voto pendente');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is(
  public.set_content_vote('40000000-0000-0000-0000-000000000001', true),
  'pending'::public.content_status,
  'um voto em quatro membros não aprova'
);

select public.set_content_vote('40000000-0000-0000-0000-000000000001', false);
select is(
  (select count(*)::integer from public.content_votes where content_id = '40000000-0000-0000-0000-000000000001' and user_id = auth.uid()),
  1,
  'alterar o voto não cria duplicidade'
);
select is(
  (select vote from public.content_votes where content_id = '40000000-0000-0000-0000-000000000001' and user_id = auth.uid()),
  false,
  'o membro altera o próprio voto'
);

select public.set_content_vote('40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select public.set_content_vote('40000000-0000-0000-0000-000000000001', true);
select is(
  (select status from public.contents where id = '40000000-0000-0000-0000-000000000001'),
  'pending'::public.content_status,
  'exatamente cinquenta por cento não aprova'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$update public.content_votes set vote = false where content_id = '40000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000002'$$,
  '42501',
  'permission denied for table content_votes',
  'um membro não altera o voto de outro'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is(
  public.set_content_vote('40000000-0000-0000-0000-000000000001', true),
  'approved'::public.content_status,
  'três votos em quatro membros aprovam'
);
select throws_ok(
  $$select public.set_content_vote('40000000-0000-0000-0000-000000000001', false)$$,
  'P0001',
  'content is unavailable for voting',
  'votação fica bloqueada após aprovação'
);
select is(
  (select count(*)::integer from public.content_votes where content_id = '40000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000001'),
  1,
  'permanece um voto por membro'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select public.set_content_vote('40000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select public.set_content_vote('40000000-0000-0000-0000-000000000002', true);
select is(
  (select status from public.contents where id = '40000000-0000-0000-0000-000000000002'),
  'pending'::public.content_status,
  'o segundo conteúdo também permanece pendente com cinquenta por cento'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select public.set_content_vote('40000000-0000-0000-0000-000000000003', false);
select is(
  (select count(*)::integer from public.content_votes where content_id = '40000000-0000-0000-0000-000000000003'),
  1,
  'o voto do futuro membro removido existe antes da remoção'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select public.remove_group_member('30000000-0000-0000-0000-000000000004');
select is(
  (select status from public.contents where id = '40000000-0000-0000-0000-000000000002'),
  'approved'::public.content_status,
  'a remoção recalcula e aprova quando dois votos passam a ser maioria de três'
);
select is(
  (select count(*)::integer from public.content_votes where content_id = '40000000-0000-0000-0000-000000000003'),
  0,
  'o voto do membro removido é excluído de conteúdo pendente'
);
select is(
  (select status from public.contents where id = '40000000-0000-0000-0000-000000000001'),
  'approved'::public.content_status,
  'conteúdo aprovado não volta para pendente'
);

select * from finish();
rollback;
