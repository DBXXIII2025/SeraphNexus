create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  discount_type text not null,
  discount_value numeric not null,
  applies_to text not null default 'all',
  minimum_order_amount_cents integer null,
  usage_limit integer null,
  usage_count integer not null default 0,
  starts_at timestamptz null,
  expires_at timestamptz null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint discount_codes_discount_type_check check (discount_type in ('percent', 'fixed')),
  constraint discount_codes_applies_to_check check (applies_to in ('all', 'service', 'rental', 'food', 'product')),
  constraint discount_codes_discount_value_check check (discount_value > 0),
  constraint discount_codes_minimum_amount_check check (
    minimum_order_amount_cents is null or minimum_order_amount_cents >= 0
  ),
  constraint discount_codes_usage_limit_check check (
    usage_limit is null or usage_limit > 0
  ),
  constraint discount_codes_usage_count_check check (usage_count >= 0)
);

create index if not exists discount_codes_business_id_idx
on public.discount_codes (business_id);

create index if not exists discount_codes_code_idx
on public.discount_codes (code);

create index if not exists discount_codes_active_idx
on public.discount_codes (active);

create unique index if not exists discount_codes_business_code_unique_idx
on public.discount_codes (business_id, lower(code));
