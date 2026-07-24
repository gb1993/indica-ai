alter table public.group_invitations
  add column resend_email_id text,
  add column email_status text not null default 'pending',
  add column email_status_updated_at timestamptz,
  add constraint group_invitations_resend_email_id_length
    check (resend_email_id is null or char_length(resend_email_id) between 1 and 255),
  add constraint group_invitations_email_status
    check (email_status in ('pending', 'sent', 'failed')),
  add constraint group_invitations_sent_has_provider_id
    check (email_status <> 'sent' or resend_email_id is not null);

create unique index group_invitations_resend_email_id_key
  on public.group_invitations (resend_email_id)
  where resend_email_id is not null;

create or replace function public.record_group_invitation_email_result(
  p_invitation_id uuid,
  p_status text,
  p_resend_email_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  invitation_group_id uuid;
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'invalid email status';
  end if;

  if p_status = 'sent'
    and (p_resend_email_id is null or char_length(p_resend_email_id) not between 1 and 255)
  then
    raise exception 'provider email id is required';
  end if;

  select group_id
  into invitation_group_id
  from public.group_invitations
  where id = p_invitation_id
  for update;

  if invitation_group_id is null
    or actor_id is null
    or not public.is_group_owner(invitation_group_id, actor_id)
  then
    raise exception 'not authorized';
  end if;

  update public.group_invitations
  set
    email_status = p_status,
    resend_email_id = case
      when p_status = 'sent' then p_resend_email_id
      else resend_email_id
    end,
    email_status_updated_at = now()
  where id = p_invitation_id;
end;
$$;

revoke all on function public.record_group_invitation_email_result(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.record_group_invitation_email_result(uuid, text, text)
  to authenticated;
