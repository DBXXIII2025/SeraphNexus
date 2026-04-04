alter table if exists public.bookings
  add column if not exists hidden_reason text null,
  add column if not exists hidden_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists fulfilled_at timestamptz null;

alter table if exists public.orders
  add column if not exists hidden_reason text null,
  add column if not exists hidden_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists fulfilled_at timestamptz null;

alter table if exists public.rental_reservations
  add column if not exists hidden_reason text null,
  add column if not exists hidden_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists fulfilled_at timestamptz null;
