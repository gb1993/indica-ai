alter table public.content_ratings
  add column comment text;

alter table public.content_ratings
  add constraint content_ratings_comment_length_check
    check (comment is null or char_length(comment) <= 500),
  add constraint content_ratings_comment_plain_text_check
    check (comment is null or comment !~ '[<>]');

drop function public.set_content_rating(uuid, numeric);

create or replace function public.set_content_rating(
  p_content_id uuid,
  p_rating numeric,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  content_group_id uuid;
  current_status public.content_status;
  normalized_comment text := nullif(
    trim(regexp_replace(coalesce(p_comment, ''), '\s+', ' ', 'g')),
    ''
  );
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;
  if p_rating is null
     or p_rating <> trunc(p_rating)
     or p_rating < 1
     or p_rating > 5 then
    raise exception 'invalid rating';
  end if;
  if char_length(normalized_comment) > 500
     or normalized_comment ~ '[<>]' then
    raise exception 'invalid rating comment';
  end if;

  select c.group_id, c.status
  into content_group_id, current_status
  from public.contents c
  where c.id = p_content_id
  for update;

  if content_group_id is null
     or current_status <> 'completed'
     or not public.is_group_member(content_group_id, actor_id) then
    raise exception 'content is unavailable for rating';
  end if;

  insert into public.content_ratings (content_id, user_id, rating, comment)
  values (p_content_id, actor_id, p_rating::smallint, normalized_comment)
  on conflict (content_id, user_id) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        updated_at = now();
end;
$$;

revoke all on function public.set_content_rating(uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.set_content_rating(uuid, numeric, text)
  to authenticated;
