create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  platform_name text not null default 'Seraph Nexus',
  marketing_headline text not null default 'Operate bookings, orders, rentals, and client follow-up in one place.',
  marketing_subheadline text not null default 'Launch-ready business tools with Stripe Connect payouts, admin operations, and polished customer flows.',
  support_email text not null default 'support@seraphnexus.com',
  support_phone text not null default '(800) 555-0100',
  pricing_note text not null default 'Choose the fee tier that matches your growth stage: Free 10%, Pro 5%, Elite 2%.',
  pro_monthly_price_cents integer not null default 1900,
  elite_monthly_price_cents integer not null default 4900,
  pro_price_active boolean not null default true,
  elite_price_active boolean not null default true,
  pro_stripe_price_id text null,
  elite_stripe_price_id text null,
  pro_stripe_product_id text null,
  elite_stripe_product_id text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint platform_settings_pro_price_positive check (pro_monthly_price_cents >= 0),
  constraint platform_settings_elite_price_positive check (elite_monthly_price_cents >= 0)
);

alter table public.platform_settings
  add column if not exists platform_name text not null default 'Seraph Nexus',
  add column if not exists marketing_headline text not null default 'Operate bookings, orders, rentals, and client follow-up in one place.',
  add column if not exists marketing_subheadline text not null default 'Launch-ready business tools with Stripe Connect payouts, admin operations, and polished customer flows.',
  add column if not exists support_email text not null default 'support@seraphnexus.com',
  add column if not exists support_phone text not null default '(800) 555-0100',
  add column if not exists pricing_note text not null default 'Choose the fee tier that matches your growth stage: Free 10%, Pro 5%, Elite 2%.',
  add column if not exists pro_monthly_price_cents integer not null default 1900,
  add column if not exists elite_monthly_price_cents integer not null default 4900,
  add column if not exists pro_price_active boolean not null default true,
  add column if not exists elite_price_active boolean not null default true,
  add column if not exists pro_stripe_price_id text null,
  add column if not exists elite_stripe_price_id text null,
  add column if not exists pro_stripe_product_id text null,
  add column if not exists elite_stripe_product_id text null,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

insert into public.platform_settings (
  platform_name,
  marketing_headline,
  marketing_subheadline,
  support_email,
  support_phone,
  pricing_note,
  pro_monthly_price_cents,
  elite_monthly_price_cents,
  pro_price_active,
  elite_price_active
)
select
  'Seraph Nexus',
  'Operate bookings, orders, rentals, and client follow-up in one place.',
  'Launch-ready business tools with Stripe Connect payouts, admin operations, and polished customer flows.',
  'support@seraphnexus.com',
  '(800) 555-0100',
  'Choose the fee tier that matches your growth stage: Free 10%, Pro 5%, Elite 2%.',
  1900,
  4900,
  true,
  true
where not exists (
  select 1 from public.platform_settings
);
