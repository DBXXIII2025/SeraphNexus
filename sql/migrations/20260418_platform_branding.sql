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
  trial_transaction_fee_bps integer not null default 1000,
  pro_transaction_fee_bps integer not null default 500,
  elite_transaction_fee_bps integer not null default 200
);

alter table public.platform_settings
  add column if not exists logo_url text;

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
  elite_price_active,
  trial_transaction_fee_bps,
  pro_transaction_fee_bps,
  elite_transaction_fee_bps
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
  true,
  1000,
  500,
  200
where not exists (
  select 1 from public.platform_settings
);

insert into storage.buckets (id, name, public)
values ('platform-brand-assets', 'platform-brand-assets', true)
on conflict (id) do update
set public = true;
