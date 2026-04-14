create table if not exists public.business_staff_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null,
  email text not null,
  role text not null default 'staff',
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint business_staff_members_role_valid check (role in ('staff', 'manager', 'admin')),
  constraint business_staff_members_status_valid check (status in ('active', 'inactive')),
  constraint business_staff_members_email_not_blank check (length(trim(email)) > 0),
  unique (business_id, email)
);

create index if not exists business_staff_members_business_id_idx
  on public.business_staff_members(business_id);

alter table public.business_staff_members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'business_staff_members'
      and policyname = 'business_staff_members_owner_read'
  ) then
    create policy business_staff_members_owner_read
      on public.business_staff_members
      for select
      using (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'business_staff_members'
      and policyname = 'business_staff_members_owner_write'
  ) then
    create policy business_staff_members_owner_write
      on public.business_staff_members
      for all
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;
end $$;
