begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select results_eq(
  $$
    select enumlabel
    from pg_enum
    where enumtypid = 'public.content_type'::regtype
    order by enumsortorder
  $$,
  $$ values ('movie'::name), ('series'::name), ('documentary'::name) $$,
  'somente tipos audiovisuais suportados permanecem no enum'
);

select has_column('public', 'contents', 'tmdb_id', 'conteúdo armazena o id do TMDB');
select has_column('public', 'contents', 'tmdb_media_type', 'conteúdo armazena o namespace do TMDB');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '67000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'tmdb-owner@example.com',
  '',
  now(),
  '{}',
  '{"name":"Owner"}',
  now(),
  now()
);

insert into public.profiles (id, name, email)
values (
  '67000000-0000-0000-0000-000000000001',
  'Owner',
  'tmdb-owner@example.com'
);

select set_config('request.jwt.claim.sub', '67000000-0000-0000-0000-000000000001', true);

create temporary table tmdb_test_group (id uuid not null);
grant select on tmdb_test_group to authenticated;
insert into tmdb_test_group
select public.create_group('Grupo TMDB', null);

insert into public.contents (
  group_id, created_by, type, title, tmdb_id, tmdb_media_type
)
values (
  (select id from tmdb_test_group),
  '67000000-0000-0000-0000-000000000001',
  'movie',
  'Filme TMDB',
  100,
  'movie'
);

select ok(
  exists (
    select 1
    from public.contents
    where group_id = (select id from tmdb_test_group)
      and tmdb_id = 100
      and tmdb_media_type = 'movie'
  ),
  'identidade TMDB válida é persistida'
);

select throws_ok(
  format(
    'insert into public.contents (group_id, created_by, type, title, tmdb_id, tmdb_media_type) values (%L, %L, %L, %L, %L, %L)',
    (select id from tmdb_test_group),
    '67000000-0000-0000-0000-000000000001',
    'movie',
    'Duplicado',
    100,
    'movie'
  ),
  '23505',
  null,
  'mesmo conteúdo TMDB não é duplicado no grupo'
);

select throws_ok(
  format(
    'insert into public.contents (group_id, created_by, type, title, tmdb_id, tmdb_media_type) values (%L, %L, %L, %L, %L, %L)',
    (select id from tmdb_test_group),
    '67000000-0000-0000-0000-000000000001',
    'series',
    'Série inválida',
    101,
    'movie'
  ),
  '23514',
  null,
  'série exige namespace tv'
);

select lives_ok(
  format(
    'insert into public.contents (group_id, created_by, type, title, tmdb_id, tmdb_media_type) values (%L, %L, %L, %L, %L, %L)',
    (select id from tmdb_test_group),
    '67000000-0000-0000-0000-000000000001',
    'documentary',
    'Série documental',
    103,
    'tv'
  ),
  'documentário pode pertencer ao namespace de séries do TMDB'
);

select throws_ok(
  format(
    'insert into public.contents (group_id, created_by, type, title, tmdb_id) values (%L, %L, %L, %L, %L)',
    (select id from tmdb_test_group),
    '67000000-0000-0000-0000-000000000001',
    'movie',
    'Identidade parcial',
    102
  ),
  '23514',
  null,
  'identidade TMDB parcial é rejeitada'
);

select lives_ok(
  format(
    'insert into public.contents (group_id, created_by, type, title) values (%L, %L, %L, %L)',
    (select id from tmdb_test_group),
    '67000000-0000-0000-0000-000000000001',
    'documentary',
    'Conteúdo manual'
  ),
  'conteúdo manual continua permitido'
);

set local role authenticated;
select throws_ok(
  format(
    'update public.contents set tmdb_id = %L where group_id = %L and title = %L',
    999,
    (select id from tmdb_test_group),
    'Conteúdo manual'
  ),
  '42501',
  null,
  'cliente não altera a identidade TMDB depois do cadastro'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.contents
    where type::text in ('anime', 'book')
  ),
  0,
  'não existem conteúdos de anime ou livro'
);

select * from finish();
rollback;
