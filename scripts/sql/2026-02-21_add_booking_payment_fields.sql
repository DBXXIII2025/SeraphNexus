alter table public.bookings
add column if not exists payment_status text not null default 'pending';

alter table public.bookings
add column if not exists stripe_session_id text;

create index if not exists bookings_stripe_session_id_idx
on public.bookings (stripe_session_id);

create index if not exists bookings_payment_status_idx
on public.bookings (payment_status);
