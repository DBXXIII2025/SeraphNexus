create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text null,
  business_id uuid null references public.businesses(id) on delete cascade,
  plan text not null default 'trial',
  granted_by text null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz null,
  is_active boolean not null default true,
  invite_token text null unique,
  activated_at timestamptz null,
  usage_limits jsonb null
);

create index if not exists access_grants_user_id_idx
  on public.access_grants (user_id, is_active);

create index if not exists access_grants_email_idx
  on public.access_grants (email, is_active);

create index if not exists access_grants_business_id_idx
  on public.access_grants (business_id, is_active);

insert into public.access_grants (
  user_id,
  business_id,
  plan,
  granted_by,
  granted_at,
  is_active
)
select
  b.owner_id,
  b.id,
  'trial',
  'system:migrate-free-to-trial',
  now(),
  true
from public.businesses b
where coalesce(b.plan, 'free') in ('free', 'basic')
  and not exists (
    select 1
    from public.access_grants g
    where g.business_id = b.id
      and g.user_id = b.owner_id
      and g.plan = 'trial'
      and g.is_active = true
  );

update public.businesses
set plan = 'inactive'
where coalesce(plan, 'free') in ('free', 'basic');

alter table public.businesses
  alter column plan set default 'inactive';
