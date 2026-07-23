alter table public.contents
  alter column description drop not null,
  alter column thumbnail_url drop not null;

alter table public.contents
  drop constraint contents_description_valid,
  drop constraint contents_thumbnail_https,
  drop constraint contents_trailer_by_type;

alter table public.contents
  add constraint contents_description_valid check (
    description is null
    or (
      description = trim(description)
      and char_length(description) between 1 and 4000
      and description !~ '[<>]'
    )
  ),
  add constraint contents_thumbnail_https check (
    thumbnail_url is null
    or (
      thumbnail_url = trim(thumbnail_url)
      and thumbnail_url ~ '^https://[^[:space:]]+$'
    )
  ),
  add constraint contents_trailer_by_type check (
    (type = 'book' and trailer_url is null)
    or (
      type in ('movie', 'series', 'anime', 'documentary')
      and (
        trailer_url is null
        or trailer_url ~ '^[A-Za-z0-9_-]{11}$'
      )
    )
  );
