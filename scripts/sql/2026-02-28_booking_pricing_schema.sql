create extension if not exists btree_gist;

alter table public.bookings
add column if not exists date date,
add column if not exists start_time time,
add column if not exists end_time time,
add column if not exists customer_email text,
add column if not exists customer_name text,
add column if not exists phone text,
add column if not exists payment_intent_id text,
add column if not exists amount numeric,
add column if not exists platform_fee numeric,
add column if not exists client_address text,
add column if not exists reminder_sent boolean default false,
add column if not exists property_id uuid,
add column if not exists demand_score numeric,
add column if not exists price_adjustment numeric;

-- Backfill from legacy columns when present
update public.bookings
set
  date = coalesce(date, (start_date::date)),
  start_time = coalesce(start_time, (start_date::time)),
  end_time = coalesce(end_time, (end_date::time))
where (start_date is not null or end_date is not null)
  and (date is null or start_time is null or end_time is null);

alter table public.bookings
drop column if exists start_date,
drop column if exists end_date,
drop column if exists guest_name;

create index if not exists bookings_business_date_idx
on public.bookings (business_id, date);

alter table public.bookings
add constraint if not exists bookings_no_overlap
exclude using gist (
  business_id with =,
  tsrange(date + start_time, date + end_time, '[)') with &&
)
where (status <> 'cancelled'
  and date is not null
  and start_time is not null
  and end_time is not null);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  base_price numeric not null default 100,
  peak_multiplier numeric not null default 1.25,
  low_demand_discount numeric not null default 0.15,
  created_at timestamptz not null default now()
);

create index if not exists pricing_rules_business_idx
on public.pricing_rules (business_id, created_at desc);

create table if not exists public.slot_pricing (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  demand_score numeric not null,
  price numeric not null,
  price_adjustment numeric not null,
  booking_count_30d integer not null default 0,
  recent_booking_count_7d integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, date, start_time, end_time)
);

create index if not exists slot_pricing_business_date_idx
on public.slot_pricing (business_id, date);

create or replace function public.set_slot_pricing_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_slot_pricing_updated_at on public.slot_pricing;
create trigger trg_slot_pricing_updated_at
before update on public.slot_pricing
for each row
execute function public.set_slot_pricing_updated_at();
