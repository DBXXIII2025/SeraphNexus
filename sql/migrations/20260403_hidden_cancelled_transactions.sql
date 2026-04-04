alter table if exists public.bookings
  add column if not exists hidden_from_ui boolean not null default false,
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_by text null;

alter table if exists public.orders
  add column if not exists hidden_from_ui boolean not null default false,
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_by text null;

alter table if exists public.rental_reservations
  add column if not exists hidden_from_ui boolean not null default false,
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_by text null;

create index if not exists bookings_visible_idx
  on public.bookings (business_id, hidden_from_ui, status, date);

create index if not exists orders_visible_idx
  on public.orders (business_id, hidden_from_ui, status, created_at);

create index if not exists rental_reservations_visible_idx
  on public.rental_reservations (business_id, property_id, hidden_from_ui, status, check_in_date);
