begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '97000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'group-delete-owner@example.test',
  '',
  now(),
  now(),
  '{}',
  '{"name":"Group Delete Owner"}',
  now(),
  now()
);

insert into public.groups (id, name, owner_id)
values
  ('97100000-0000-0000-0000-000000000001', 'Grupo para excluir', '97000000-0000-0000-0000-000000000001'),
  ('97100000-0000-0000-0000-000000000002', 'Grupo preservado', '97000000-0000-0000-0000-000000000001');

insert into public.group_members (id, group_id, user_id, role)
values
  ('97200000-0000-0000-0000-000000000001', '97100000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', 'owner'),
  ('97200000-0000-0000-0000-000000000002', '97100000-0000-0000-0000-000000000002', '97000000-0000-0000-0000-000000000001', 'owner');

insert into public.contents (
  id, group_id, created_by, type, title, description, thumbnail_url, trailer_url
)
values
  ('97300000-0000-0000-0000-000000000001', '97100000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', 'movie', 'Conteúdo em cascata', null, null, null),
  ('97300000-0000-0000-0000-000000000002', '97100000-0000-0000-0000-000000000002', '97000000-0000-0000-0000-000000000001', 'series', 'Conteúdo direto', null, null, null);

insert into public.content_votes (content_id, user_id, vote)
values ('97300000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', true);

insert into public.content_ratings (content_id, user_id, rating)
values ('97300000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', 5);

insert into public.content_messages (content_id, user_id, content)
values ('97300000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', 'Mensagem que deve ser removida');

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$delete from public.groups
    where id = '97100000-0000-0000-0000-000000000001'$$,
  'owner exclui grupo que possui conteúdo'
);

reset role;

select is(
  (select count(*)::integer from public.groups where id = '97100000-0000-0000-0000-000000000001'),
  0,
  'grupo é excluído'
);

select is(
  (select count(*)::integer from public.group_members where group_id = '97100000-0000-0000-0000-000000000001'),
  0,
  'membros do grupo são excluídos em cascata'
);

select is(
  (select count(*)::integer from public.contents where group_id = '97100000-0000-0000-0000-000000000001'),
  0,
  'conteúdos são excluídos em cascata'
);

select is(
  (
    select
      (select count(*) from public.content_votes where content_id = '97300000-0000-0000-0000-000000000001')
      + (select count(*) from public.content_ratings where content_id = '97300000-0000-0000-0000-000000000001')
      + (select count(*) from public.content_messages where content_id = '97300000-0000-0000-0000-000000000001')
  )::integer,
  0,
  'votos, avaliações e mensagens são excluídos em cascata'
);

select is(
  (select count(*)::integer from public.group_activities where group_id = '97100000-0000-0000-0000-000000000001'),
  0,
  'histórico de atividades do grupo é excluído'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$delete from public.contents
    where id = '97300000-0000-0000-0000-000000000002'$$,
  'exclusão direta de conteúdo continua funcionando'
);

reset role;

select ok(
  exists (
    select 1
    from public.group_activities
    where group_id = '97100000-0000-0000-0000-000000000002'
      and entity_id = '97300000-0000-0000-0000-000000000002'
      and event_type = 'content_deleted'
  ),
  'exclusão direta continua registrando atividade'
);

select * from finish();
rollback;
