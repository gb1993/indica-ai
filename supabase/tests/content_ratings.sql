begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rating1@example.com', '', now(), now(), '{}', '{"name":"Rating 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rating2@example.com', '', now(), now(), '{}', '{"name":"Rating 2"}', now(), now());

insert into public.groups (id, name, owner_id)
values ('51000000-0000-0000-0000-000000000001', 'Grupo de avaliações', '50000000-0000-0000-0000-000000000001');

insert into public.group_members (id, group_id, user_id, role)
values
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'owner'),
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'member');

insert into public.contents (id, group_id, created_by, type, title, status)
values
  ('53000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'movie', 'Conteúdo pendente', 'pending'),
  ('53000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'series', 'Conteúdo aprovado', 'approved'),
  ('53000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'documentary', 'Outro conteúdo aprovado', 'approved');

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.complete_content('53000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'content is unavailable for completion',
  'conteúdo pendente não pode ser concluído'
);
select lives_ok(
  $$select public.complete_content('53000000-0000-0000-0000-000000000002')$$,
  'membro ativo conclui conteúdo aprovado'
);
select ok(
  (
    select status = 'completed'
      and completed_at is not null
      and completed_by = '50000000-0000-0000-0000-000000000001'
    from public.contents
    where id = '53000000-0000-0000-0000-000000000002'
  ),
  'status, data e autor da conclusão são gravados atomicamente'
);
select throws_ok(
  $$select public.complete_content('53000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'content is unavailable for completion',
  'conteúdo não pode ser concluído duas vezes'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000003', 4)$$,
  'P0001',
  'content is unavailable for rating',
  'conteúdo não pode ser avaliado antes da conclusão'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000002', 0)$$,
  'P0001',
  'invalid rating',
  'nota menor que um é rejeitada'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000002', 6)$$,
  'P0001',
  'invalid rating',
  'nota maior que cinco é rejeitada'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000002', 2.5)$$,
  'P0001',
  'invalid rating',
  'nota decimal é rejeitada'
);
select lives_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000002', 4, 'Uma ótima indicação para o grupo.')$$,
  'membro ativo avalia conteúdo concluído com comentário'
);
select is(
  (select count(*)::integer from public.content_ratings where content_id = '53000000-0000-0000-0000-000000000002' and user_id = auth.uid()),
  1,
  'a avaliação é única por membro e conteúdo'
);
select lives_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000002', 5)$$,
  'membro pode alterar a própria avaliação'
);
select results_eq(
  $$select rating, comment, count(*) over ()::integer from public.content_ratings where content_id = '53000000-0000-0000-0000-000000000002' and user_id = '50000000-0000-0000-0000-000000000001'$$,
  $$values (5::smallint, null::text, 1::integer)$$,
  'alterar a avaliação atualiza a mesma linha, inclusive removendo o comentário'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000002', 5, repeat('a', 501))$$,
  'P0001',
  'invalid rating comment',
  'comentário com mais de 500 caracteres é rejeitado'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000002', 5, '<b>texto</b>')$$,
  'P0001',
  'invalid rating comment',
  'HTML no comentário é rejeitado'
);
select lives_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000002', 5, '  comentário   normalizado  ')$$,
  'espaços do comentário são normalizados'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select public.set_content_rating('53000000-0000-0000-0000-000000000002', 3);
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$update public.content_ratings set rating = 1 where content_id = '53000000-0000-0000-0000-000000000002' and user_id = '50000000-0000-0000-0000-000000000002'$$,
  '42501',
  'permission denied for table content_ratings',
  'membro não altera avaliação alheia'
);
reset role;

select * from finish();
rollback;
