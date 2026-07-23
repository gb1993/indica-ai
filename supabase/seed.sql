-- DEVELOPMENT DATA ONLY.
-- This file is executed by `supabase db reset` against the local stack.
-- `supabase db push` never runs seeds; do not execute this file remotely.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"name":"Ana"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bruno@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"name":"Bruno"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'carla@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"name":"Carla"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'diego@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"name":"Diego"}', now(), now());

insert into public.groups (id, name, description, owner_id)
values
  ('82000000-0000-0000-0000-000000000001', 'Cinema de sexta', 'Filmes e séries para o fim de semana.', '81000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000002', 'Clube de histórias', 'Livros, animes e documentários.', '81000000-0000-0000-0000-000000000003');

insert into public.group_members (id, group_id, user_id, role, status)
values
  ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('83000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000003', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000004', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000003', 'owner', 'active'),
  ('83000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000004', 'member', 'active');

insert into public.contents (
  id, group_id, created_by, type, title, description, thumbnail_url,
  trailer_url, status, completed_at, completed_by
)
values
  ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'movie', 'Filme pendente', null, null, 'dQw4w9WgXcQ', 'pending', null, null),
  ('84000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'series', 'Série aprovada', 'Pronta para assistir.', null, null, 'approved', null, null),
  ('84000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000003', 'documentary', 'Documentário concluído', 'Já assistido pelo grupo.', null, null, 'completed', now() - interval '1 day', '81000000-0000-0000-0000-000000000001'),
  ('84000000-0000-0000-0000-000000000004', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000003', 'anime', 'Anime pendente', null, null, null, 'pending', null, null),
  ('84000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000004', 'book', 'Livro concluído', 'Uma leitura para conversar.', null, null, 'completed', now() - interval '2 days', '81000000-0000-0000-0000-000000000003');

insert into public.content_votes (content_id, user_id, vote)
values
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', true),
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', false),
  ('84000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000003', true);

insert into public.content_ratings (content_id, user_id, rating)
values
  ('84000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 5),
  ('84000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', 4),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000003', 5),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000004', 3);

insert into public.content_messages (content_id, user_id, content)
values
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Vamos ver este na sexta?'),
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'Por mim, combinado.'),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000004', 'Gostei bastante do final.');
