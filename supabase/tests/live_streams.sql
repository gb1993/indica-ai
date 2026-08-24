begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'live-owner@example.test', '', now(), '{}', '{"name":"Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'live-host@example.test', '', now(), '{}', '{"name":"Host"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'live-member@example.test', '', now(), '{}', '{"name":"Member"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'live-outsider@example.test', '', now(), '{}', '{"name":"Outsider"}', now(), now());

insert into public.profiles (id, name, email)
values
  ('a1000000-0000-4000-8000-000000000001', 'Owner', 'live-owner@example.test'),
  ('a1000000-0000-4000-8000-000000000002', 'Host', 'live-host@example.test'),
  ('a1000000-0000-4000-8000-000000000003', 'Member', 'live-member@example.test'),
  ('a1000000-0000-4000-8000-000000000004', 'Outsider', 'live-outsider@example.test');

insert into public.groups (id, name, owner_id)
values ('a2000000-0000-4000-8000-000000000001', 'Grupo ao vivo', 'a1000000-0000-4000-8000-000000000001');

insert into public.group_members (group_id, user_id, role)
values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'owner'),
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'member'),
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'member');

create temporary table test_live_session (id uuid not null);
grant select on test_live_session to authenticated;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
insert into test_live_session
values (public.start_live_stream('a2000000-0000-4000-8000-000000000001'));

select ok(
  exists (
    select 1 from public.live_stream_sessions
    where id = (select id from test_live_session)
      and host_user_id = 'a1000000-0000-4000-8000-000000000002'
  ),
  'qualquer membro ativo pode iniciar uma transmissão'
);
select is(
  (select status::text from public.live_stream_sessions where id = (select id from test_live_session)),
  'starting',
  'sessão começa em starting'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.live_stream_sessions),
  0,
  'usuário externo não lê sessões do grupo'
);
reset role;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.start_live_stream('a2000000-0000-4000-8000-000000000001')$$,
  'P0001', 'not authorized',
  'usuário externo não inicia transmissão'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.start_live_stream('a2000000-0000-4000-8000-000000000001')$$,
  'P0001', 'live stream already active',
  'índice e RPC impedem duas transmissões simultâneas'
);
select throws_ok(
  format('select public.end_live_stream(%L)', (select id from test_live_session)),
  'P0001', 'only the host can end the live stream',
  'outro membro não encerra a transmissão'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok(
  format('select public.activate_live_stream(%L)', (select id from test_live_session)),
  'host ativa a transmissão'
);
select is(
  (select status::text from public.live_stream_sessions where id = (select id from test_live_session)),
  'live',
  'ativação registra status live'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select throws_ok(
  format('select public.heartbeat_live_stream(%L)', (select id from test_live_session)),
  'P0001', 'live stream is unavailable for heartbeat',
  'somente host atualiza heartbeat'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok(
  format('select public.heartbeat_live_stream(%L)', (select id from test_live_session)),
  'host atualiza heartbeat'
);
select lives_ok(
  format('select public.end_live_stream(%L)', (select id from test_live_session)),
  'host encerra transmissão'
);
select is(
  (select status::text from public.live_stream_sessions where id = (select id from test_live_session)),
  'ended',
  'encerramento registra status ended'
);
select throws_ok(
  format(
    'update public.live_stream_sessions set status = %L, ended_at = null where id = %L',
    'live', (select id from test_live_session)
  ),
  'P0001', 'ended live stream cannot be resumed',
  'sessão encerrada não volta para live'
);
select lives_ok(
  format('select public.end_live_stream(%L)', (select id from test_live_session)),
  'encerramento pelo host é idempotente'
);

truncate test_live_session;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
insert into test_live_session
values (public.start_live_stream('a2000000-0000-4000-8000-000000000001'));
select ok(
  exists (select 1 from public.live_stream_sessions where id = (select id from test_live_session)),
  'novo host inicia após encerramento'
);

update public.live_stream_sessions
set last_heartbeat_at = now() - interval '2 minutes'
where id = (select id from test_live_session);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.start_live_stream('a2000000-0000-4000-8000-000000000001')$$,
  'nova tentativa expira sessão órfã automaticamente'
);
select is(
  (select status::text from public.live_stream_sessions where id = (select id from test_live_session)),
  'ended',
  'sessão órfã fica encerrada'
);

select is(
  public.live_stream_session_id_from_topic('live:a3000000-0000-4000-8000-000000000001'),
  'a3000000-0000-4000-8000-000000000001'::uuid,
  'parser extrai sessão do tópico de Presence'
);
select is(
  public.live_stream_sender_id_from_topic(
    'live:a3000000-0000-4000-8000-000000000001:signal:a1000000-0000-4000-8000-000000000002'
  ),
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'parser vincula tópico de signaling ao remetente'
);
select is(
  public.live_stream_session_id_from_topic('live:invalid'),
  null::uuid,
  'parser rejeita tópico inválido'
);

select ok(
  public.can_access_live_stream_topic(
    (select topic from public.live_stream_sessions where status = 'starting' order by created_at desc limit 1),
    'a1000000-0000-4000-8000-000000000003'
  ),
  'membro pode acessar tópico ativo'
);
select isnt(
  public.can_access_live_stream_topic(
    (select topic from public.live_stream_sessions where status = 'starting' order by created_at desc limit 1),
    'a1000000-0000-4000-8000-000000000004'
  ),
  true,
  'usuário externo não pode acessar tópico ativo'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'realtime' and tablename = 'messages'
      and policyname = 'Group members can receive live presence and signaling'
  ),
  'existe política de leitura para Presence e Broadcast'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'realtime' and tablename = 'messages'
      and policyname = 'Group members can publish their live presence and signaling'
  ),
  'existe política de escrita para Presence e Broadcast'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$insert into public.live_stream_sessions (
      id, group_id, host_user_id, topic
    ) values (
      'a4000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000002',
      'live:a4000000-0000-4000-8000-000000000001'
    )$$,
  '42501', null,
  'cliente não insere sessão diretamente sem RPC'
);
reset role;

select * from finish();
rollback;
