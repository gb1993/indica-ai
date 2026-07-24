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
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@example.test', '', now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Ana"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bruno@example.test', '', now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Bruno"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'carla@example.test', '', now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Carla"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'diego@example.test', '', now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Diego"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'gbdev1993@gmail.com', '', now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Gabriel"}', now(), now(), '', '', '', '', '', '', '', '');

insert into public.groups (id, name, description, owner_id)
values
  ('82000000-0000-0000-0000-000000000001', 'Cinema de sexta', 'Filmes e séries para o fim de semana.', '81000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000002', 'Clube de histórias', 'Livros, animes e documentários.', '81000000-0000-0000-0000-000000000003'),
  ('82000000-0000-0000-0000-000000000003', 'Radar do GB', 'Filmes, séries, animes e livros para acompanhar com os amigos.', '81000000-0000-0000-0000-000000000005');

insert into public.group_members (id, group_id, user_id, role, status)
values
  ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('83000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000003', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000004', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000003', 'owner', 'active'),
  ('83000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000004', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000006', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000005', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000007', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000005', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000008', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000005', 'owner', 'active'),
  ('83000000-0000-0000-0000-000000000009', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000010', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', 'member', 'active'),
  ('83000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000003', 'member', 'active');

insert into public.contents (
  id, group_id, created_by, type, title, description, thumbnail_url,
  trailer_url, status, completed_at, completed_by
)
values
  ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'movie', 'Filme pendente', null, null, 'dQw4w9WgXcQ', 'pending', null, null),
  ('84000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'series', 'Série aprovada', 'Pronta para assistir.', null, null, 'approved', null, null),
  ('84000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000003', 'documentary', 'Documentário concluído', 'Já assistido pelo grupo.', null, null, 'completed', now() - interval '1 day', '81000000-0000-0000-0000-000000000001'),
  ('84000000-0000-0000-0000-000000000004', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000003', 'anime', 'Anime pendente', null, null, null, 'pending', null, null),
  ('84000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000004', 'book', 'Livro concluído', 'Uma leitura para conversar.', null, null, 'completed', now() - interval '2 days', '81000000-0000-0000-0000-000000000003'),
  ('84000000-0000-0000-0000-000000000006', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000005', 'movie', 'Duna: Parte Dois', 'Paul Atreides se une a Chani e aos Fremen enquanto busca vingança.', null, 'Way9Dexny3w', 'approved', null, null),
  ('84000000-0000-0000-0000-000000000007', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000005', 'series', 'Ruptura', 'Funcionários têm as memórias profissionais separadas das pessoais.', null, 'xEQP4VVuyrY', 'completed', now() - interval '3 days', '81000000-0000-0000-0000-000000000005'),
  ('84000000-0000-0000-0000-000000000008', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 'anime', 'Frieren e a Jornada para o Além', 'Uma elfa revisita os vínculos criados durante uma antiga aventura.', null, 'Iwr1aLEDpe4', 'pending', null, null),
  ('84000000-0000-0000-0000-000000000009', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000003', 'documentary', 'O Dilema das Redes', 'Um debate sobre o impacto das redes sociais na sociedade.', null, 'uaaC57tcci0', 'completed', now() - interval '8 days', '81000000-0000-0000-0000-000000000003'),
  ('84000000-0000-0000-0000-000000000010', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000005', 'book', 'Projeto Hail Mary', 'Uma missão espacial solitária para impedir uma catástrofe global.', null, null, 'pending', null, null),
  ('84000000-0000-0000-0000-000000000011', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', 'movie', 'Tudo em Todo o Lugar ao Mesmo Tempo', 'Uma aventura pelo multiverso sobre escolhas, família e possibilidades.', null, 'wxN1T1uxQ2g', 'completed', now() - interval '14 days', '81000000-0000-0000-0000-000000000005');

insert into public.content_votes (content_id, user_id, vote)
values
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', true),
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', false),
  ('84000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000003', true),
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000005', true),
  ('84000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000005', false),
  ('84000000-0000-0000-0000-000000000008', '81000000-0000-0000-0000-000000000001', true),
  ('84000000-0000-0000-0000-000000000008', '81000000-0000-0000-0000-000000000002', false),
  ('84000000-0000-0000-0000-000000000008', '81000000-0000-0000-0000-000000000005', true),
  ('84000000-0000-0000-0000-000000000010', '81000000-0000-0000-0000-000000000003', true),
  ('84000000-0000-0000-0000-000000000010', '81000000-0000-0000-0000-000000000005', true);

insert into public.content_ratings (content_id, user_id, rating, comment)
values
  ('84000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 5, 'Uma história marcante e muito bem conduzida.'),
  ('84000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', 4, 'Gostei bastante, especialmente da fotografia.'),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000003', 5, 'Leitura excelente para discutir em grupo.'),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000004', 3, null),
  ('84000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000005', 5, 'Excelente escolha para conversar depois da sessão.'),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000005', 4, 'Gostei da proposta e do ritmo da leitura.'),
  ('84000000-0000-0000-0000-000000000007', '81000000-0000-0000-0000-000000000005', 5, 'Uma das séries mais criativas dos últimos anos.'),
  ('84000000-0000-0000-0000-000000000007', '81000000-0000-0000-0000-000000000001', 4, 'Ótimo suspense e direção muito precisa.'),
  ('84000000-0000-0000-0000-000000000007', '81000000-0000-0000-0000-000000000002', 5, 'Quero rever antes da próxima temporada.'),
  ('84000000-0000-0000-0000-000000000009', '81000000-0000-0000-0000-000000000005', 4, 'Importante para iniciar uma boa discussão.'),
  ('84000000-0000-0000-0000-000000000009', '81000000-0000-0000-0000-000000000003', 5, 'Direto ao ponto e bastante provocador.'),
  ('84000000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-000000000005', 5, 'Caótico, divertido e emocionante.'),
  ('84000000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-000000000002', 4, null);

insert into public.content_messages (content_id, user_id, content)
values
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Vamos ver este na sexta?'),
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'Por mim, combinado.'),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000004', 'Gostei bastante do final.'),
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000005', 'Sexta funciona para mim. Posso organizar a sessão.'),
  ('84000000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000005', 'Que tal assistirmos no próximo fim de semana?'),
  ('84000000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000001', 'Fechado, ainda não consegui ver no cinema.'),
  ('84000000-0000-0000-0000-000000000007', '81000000-0000-0000-0000-000000000002', 'O último episódio rende muita conversa.'),
  ('84000000-0000-0000-0000-000000000007', '81000000-0000-0000-0000-000000000005', 'Concordo. A direção de arte também está incrível.'),
  ('84000000-0000-0000-0000-000000000008', '81000000-0000-0000-0000-000000000005', 'Ouvi ótimas recomendações deste anime.'),
  ('84000000-0000-0000-0000-000000000010', '81000000-0000-0000-0000-000000000003', 'Esse livro prende desde o começo.'),
  ('84000000-0000-0000-0000-000000000010', '81000000-0000-0000-0000-000000000005', 'Vou começar esta semana.');
