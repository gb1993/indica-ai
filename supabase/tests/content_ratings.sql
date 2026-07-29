begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

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

insert into public.contents (id, group_id, created_by, type, title)
values
  ('53000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'movie', 'Conteúdo disponível'),
  ('53000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'series', 'Outro conteúdo disponível');

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 4, 'Uma ótima indicação para o grupo.')$$,
  'avaliação fica disponível imediatamente após a indicação'
);
select ok(
  (
    select status = 'completed'
      and completed_at is not null
      and completed_by = '50000000-0000-0000-0000-000000000001'
      and exists (
        select 1
        from public.content_ratings
        where content_id = contents.id
          and user_id = '50000000-0000-0000-0000-000000000001'
          and rating = 4
      )
    from public.contents
    where id = '53000000-0000-0000-0000-000000000001'
  ),
  'a primeira avaliação conclui o conteúdo e grava a nota atomicamente'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 0)$$,
  'P0001',
  'invalid rating',
  'nota menor que um é rejeitada'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 6)$$,
  'P0001',
  'invalid rating',
  'nota maior que cinco é rejeitada'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 2.5)$$,
  'P0001',
  'invalid rating',
  'nota decimal é rejeitada'
);
select lives_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 4, 'Comentário atualizado.')$$,
  'membro pode atualizar a própria avaliação com comentário'
);
select is(
  (select count(*)::integer from public.content_ratings where content_id = '53000000-0000-0000-0000-000000000001' and user_id = auth.uid()),
  1,
  'a avaliação é única por membro e conteúdo'
);
select lives_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 5)$$,
  'membro pode alterar a própria avaliação'
);
select results_eq(
  $$select rating, comment, count(*) over ()::integer from public.content_ratings where content_id = '53000000-0000-0000-0000-000000000001' and user_id = '50000000-0000-0000-0000-000000000001'$$,
  $$values (5::smallint, null::text, 1::integer)$$,
  'alterar a avaliação atualiza a mesma linha, inclusive removendo o comentário'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 5, repeat('a', 501))$$,
  'P0001',
  'invalid rating comment',
  'comentário com mais de 500 caracteres é rejeitado'
);
select throws_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 5, '<b>texto</b>')$$,
  'P0001',
  'invalid rating comment',
  'HTML no comentário é rejeitado'
);
select lives_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 5, '  comentário   normalizado  ')$$,
  'espaços do comentário são normalizados'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.set_content_rating('53000000-0000-0000-0000-000000000001', 3)$$,
  'outro membro pode avaliar o conteúdo já concluído'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$update public.content_ratings set rating = 1 where content_id = '53000000-0000-0000-0000-000000000001' and user_id = '50000000-0000-0000-0000-000000000002'$$,
  '42501',
  'permission denied for table content_ratings',
  'membro não altera avaliação alheia'
);
reset role;

select * from finish();
rollback;
