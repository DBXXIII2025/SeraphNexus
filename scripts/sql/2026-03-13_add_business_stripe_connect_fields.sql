alter table public.businesses
add column if not exists stripe_account_id text;

alter table public.businesses
add column if not exists stripe_onboarding_complete boolean not null default false;

alter table public.businesses
add column if not exists stripe_charges_enabled boolean not null default false;

alter table public.businesses
add column if not exists stripe_payouts_enabled boolean not null default false;

create index if not exists businesses_stripe_account_id_idx
on public.businesses (stripe_account_id);
