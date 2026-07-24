begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '66000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'email-owner@example.com', '', now(), '{}', '{"name":"Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '66000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'email-member@example.com', '', now(), '{}', '{"name":"Member"}', now(), now());

insert into public.profiles (id, name, email)
values
  ('66000000-0000-0000-0000-000000000001', 'Owner', 'email-owner@example.com'),
  ('66000000-0000-0000-0000-000000000002', 'Member', 'email-member@example.com');

create temporary table email_test_group (id uuid not null);
create temporary table email_test_invitation (id uuid not null, label text not null);
grant select on email_test_invitation to authenticated, anon;

select set_config('request.jwt.claim.sub', '66000000-0000-0000-0000-000000000001', true);
insert into email_test_group
select public.create_group('Grupo de e-mail', null);

insert into email_test_invitation
select public.create_group_invitation(
  (select id from email_test_group),
  'convidado@example.com',
  repeat('c', 64)
), 'first';

select is(
  (
    select email_status
    from public.group_invitations
    where id = (select id from email_test_invitation where label = 'first')
  ),
  'pending',
  'convite começa com envio pendente'
);

select lives_ok(
  format(
    'select public.record_group_invitation_email_result(%L, %L, %L)',
    (select id from email_test_invitation where label = 'first'),
    'sent',
    'resend-email-1'
  ),
  'owner registra envio aceito pelo Resend'
);

select results_eq(
  $$
    select email_status, resend_email_id, email_status_updated_at is not null
    from public.group_invitations
    where id = (select id from email_test_invitation where label = 'first')
  $$,
  $$ values ('sent'::text, 'resend-email-1'::text, true) $$,
  'status, id do provedor e data são persistidos'
);

select throws_ok(
  format(
    'select public.record_group_invitation_email_result(%L, %L, null)',
    (select id from email_test_invitation where label = 'first'),
    'sent'
  ),
  'P0001',
  'provider email id is required',
  'status enviado exige id do provedor'
);

select throws_ok(
  format(
    'select public.record_group_invitation_email_result(%L, %L, null)',
    (select id from email_test_invitation where label = 'first'),
    'delivered'
  ),
  'P0001',
  'invalid email status',
  'status fora do fluxo sem webhook é rejeitado'
);

select set_config('request.jwt.claim.sub', '66000000-0000-0000-0000-000000000002', true);
select throws_ok(
  format(
    'select public.record_group_invitation_email_result(%L, %L, null)',
    (select id from email_test_invitation where label = 'first'),
    'failed'
  ),
  'P0001',
  'not authorized',
  'não proprietário não registra o resultado'
);

set local role authenticated;
select throws_ok(
  format(
    'update public.group_invitations set email_status = %L where id = %L',
    'failed',
    (select id from email_test_invitation where label = 'first')
  ),
  '42501',
  null,
  'cliente autenticado não altera status diretamente'
);
reset role;

select set_config('request.jwt.claim.sub', '66000000-0000-0000-0000-000000000001', true);
select public.record_group_invitation_email_result(
  (select id from email_test_invitation where label = 'first'),
  'failed',
  null
);
select is(
  (
    select email_status
    from public.group_invitations
    where id = (select id from email_test_invitation where label = 'first')
  ),
  'failed',
  'owner registra falha explícita da API'
);

insert into email_test_invitation
select public.create_group_invitation(
  (select id from email_test_group),
  'outro-convidado@example.com',
  repeat('d', 64)
), 'second';

select throws_ok(
  format(
    'select public.record_group_invitation_email_result(%L, %L, %L)',
    (select id from email_test_invitation where label = 'second'),
    'sent',
    'resend-email-1'
  ),
  '23505',
  null,
  'id do Resend não pode ser associado a dois convites'
);

set local role anon;
select throws_ok(
  format(
    'select public.record_group_invitation_email_result(%L, %L, null)',
    (select id from email_test_invitation where label = 'first'),
    'failed'
  ),
  '42501',
  null,
  'usuário anônimo não executa a função'
);
reset role;

select * from finish();
rollback;
