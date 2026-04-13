alter table public.businesses
  add column if not exists language text not null default 'en',
  add column if not exists pickup_enabled boolean not null default true,
  add column if not exists delivery_enabled boolean not null default true,
  add column if not exists onsite_enabled boolean not null default true,
  add column if not exists remote_enabled boolean not null default true;

alter table public.businesses
  drop constraint if exists businesses_language_check,
  add constraint businesses_language_check check (language in ('en', 'es'));

alter table public.businesses
  drop constraint if exists businesses_food_mode_check,
  add constraint businesses_food_mode_check check (
    business_type not in ('food', 'restaurant')
    or pickup_enabled
    or delivery_enabled
  );

alter table public.businesses
  drop constraint if exists businesses_service_mode_check,
  add constraint businesses_service_mode_check check (
    business_type <> 'service'
    or onsite_enabled
    or remote_enabled
  );
