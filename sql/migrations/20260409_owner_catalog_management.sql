alter table if exists public.services
  add column if not exists description text null,
  add column if not exists category text null,
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.products
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists services_business_active_idx
  on public.services (business_id, is_active);

create index if not exists products_business_active_idx
  on public.products (business_id, is_active);
