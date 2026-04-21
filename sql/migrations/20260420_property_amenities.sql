alter table public.property
add column if not exists amenity_data jsonb not null default '{}'::jsonb;
