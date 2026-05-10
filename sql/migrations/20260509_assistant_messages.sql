create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_business_user_created_idx
  on public.assistant_messages (business_id, user_id, created_at desc);

create index if not exists assistant_messages_business_created_idx
  on public.assistant_messages (business_id, created_at desc);

alter table public.assistant_messages enable row level security;

create or replace function public.is_platform_admin_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = target_user_id
      and is_platform_admin = true
  );
$$;

create or replace function public.can_access_business_messages(
  target_business_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses
    where businesses.id = target_business_id
      and businesses.owner_id = target_user_id
  )
  or exists (
    select 1
    from public.business_staff_members
    where business_staff_members.business_id = target_business_id
      and business_staff_members.user_id = target_user_id
  )
  or public.is_platform_admin_user(target_user_id);
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_messages'
      and policyname = 'assistant_messages_select_access'
  ) then
    create policy assistant_messages_select_access
      on public.assistant_messages
      for select
      using (public.can_access_business_messages(business_id, auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_messages'
      and policyname = 'assistant_messages_insert_access'
  ) then
    create policy assistant_messages_insert_access
      on public.assistant_messages
      for insert
      with check (
        auth.uid() = user_id
        and public.can_access_business_messages(business_id, auth.uid())
      );
  end if;
end $$;
