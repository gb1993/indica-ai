begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'metrics-owner@example.test', '', now(), now(), '{}', '{"name":"Proprietário"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'metrics-member@example.test', '', now(), now(), '{}', '{"name":"Membro"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'metrics-stranger@example.test', '', now(), now(), '{}', '{"name":"Visitante"}', now(), now());

insert into public.groups (id, name, owner_id)
values (
  '92000000-0000-0000-0000-000000000001',
  'Grupo de métricas',
  '91000000-0000-0000-0000-000000000001'
);

insert into public.group_members (id, group_id, user_id, role)
values
  ('93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'owner'),
  ('93000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'member');

insert into public.contents (
  id, group_id, created_by, type, title, status, completed_at, completed_by
)
values
  ('94000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'movie', 'Conteúdo A', 'completed', now(), '91000000-0000-0000-0000-000000000001'),
  ('94000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'series', 'Conteúdo B', 'completed', now(), '91000000-0000-0000-0000-000000000002');

insert into public.content_ratings (content_id, user_id, rating)
values
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 5),
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 4),
  ('94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 5),
  ('94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 5);

insert into public.content_messages (content_id, user_id, content)
values
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Mensagem do proprietário'),
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'Primeira mensagem do membro'),
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'Segunda mensagem do membro'),
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'Terceira mensagem do membro'),
  ('94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 'Mensagem em outro conteúdo');

select ok(
  not has_function_privilege('anon', 'public.get_group_top_rated_contents(uuid)', 'EXECUTE'),
  'anônimo não executa ranking de avaliações'
);
select ok(
  not has_function_privilege('anon', 'public.get_group_most_active_members(uuid)', 'EXECUTE'),
  'anônimo não executa ranking de membros'
);
select ok(
  not has_function_privilege('anon', 'public.get_group_most_discussed_contents(uuid)', 'EXECUTE'),
  'anônimo não executa ranking de discussões'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.get_group_top_rated_contents('92000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'not authorized',
  'não membro não acessa avaliações'
);
select throws_ok(
  $$select public.get_group_most_active_members('92000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'not authorized',
  'não membro não acessa atividade'
);
select throws_ok(
  $$select public.get_group_most_discussed_contents('92000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'not authorized',
  'não membro não acessa discussões'
);

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select is(
  (
    select count(*)::integer
    from public.get_group_top_rated_contents('92000000-0000-0000-0000-000000000001')
  ),
  2,
  'membro ativo recebe conteúdos avaliados'
);
select is(
  (
    select title
    from public.get_group_top_rated_contents('92000000-0000-0000-0000-000000000001')
    limit 1
  ),
  'Conteúdo B',
  'maior média ocupa a primeira posição'
);
select is(
  (
    select name
    from public.get_group_most_active_members('92000000-0000-0000-0000-000000000001')
    limit 1
  ),
  'Membro',
  'membro com mais contribuições ocupa a primeira posição'
);
select is(
  (
    select title
    from public.get_group_most_discussed_contents('92000000-0000-0000-0000-000000000001')
    limit 1
  ),
  'Conteúdo A',
  'conteúdo com mais mensagens ocupa a primeira posição'
);
reset role;

update public.group_members
set status = 'removed', removed_at = now()
where id = '93000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.get_group_top_rated_contents('92000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'not authorized',
  'membro removido não acessa o dashboard'
);

select * from finish();
rollback;
