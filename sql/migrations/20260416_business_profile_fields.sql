alter table public.businesses
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists country text,
  add column if not exists social_facebook text,
  add column if not exists social_instagram text,
  add column if not exists social_twitter text,
  add column if not exists hours_json jsonb,
  add column if not exists service_area text;

create index if not exists businesses_public_contact_idx
  on public.businesses (is_published, slug)
  where is_published = true;
