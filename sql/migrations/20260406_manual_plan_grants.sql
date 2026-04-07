create table if not exists public.plan_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid null references public.businesses(id) on delete cascade,
  granted_plan text not null check (granted_plan in ('trial', 'pro', 'elite')),
  grant_type text not null check (grant_type in ('temporary', 'permanent')),
  starts_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz null,
  is_active boolean not null default true,
  granted_by text not null,
  reason text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists plan_grants_user_id_idx
  on public.plan_grants (user_id, is_active);

create index if not exists plan_grants_business_id_idx
  on public.plan_grants (business_id, is_active);

create index if not exists plan_grants_starts_expires_idx
  on public.plan_grants (starts_at, expires_at);
