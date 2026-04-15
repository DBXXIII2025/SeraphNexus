alter table public.platform_settings
  add column if not exists pro_plan_name text not null default 'Pro',
  add column if not exists pro_plan_subtitle text not null default 'Enable payments, full messaging, basic analytics, and standard owner controls.',
  add column if not exists pro_plan_features text[] not null default array[
    '5% platform fee',
    'Stripe payments, full messaging, and standard customization',
    'Up to 2 businesses with unlimited services and products'
  ],
  add column if not exists pro_plan_badge text,
  add column if not exists pro_plan_cta text not null default 'Choose Pro',
  add column if not exists elite_plan_name text not null default 'Elite',
  add column if not exists elite_plan_subtitle text not null default 'Best economics and the full premium operating stack for scaling businesses.',
  add column if not exists elite_plan_features text[] not null default array[
    '2% platform fee',
    'Automation, advanced analytics, and advanced messaging',
    'Priority explore boost with unlimited businesses'
  ],
  add column if not exists elite_plan_badge text,
  add column if not exists elite_plan_cta text not null default 'Choose Elite';

alter table public.businesses
  add column if not exists page_accent_color text not null default '#2563eb',
  add column if not exists page_text_color text not null default '#111827',
  add column if not exists page_heading_font_size integer not null default 36,
  add column if not exists page_body_font_size integer not null default 16;

create table if not exists public.business_page_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  image_url text not null,
  storage_path text,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists business_page_images_business_sort_idx
  on public.business_page_images(business_id, sort_order, created_at);

insert into storage.buckets (id, name, public)
values ('business-page-images', 'business-page-images', true)
on conflict (id) do update set public = true;
