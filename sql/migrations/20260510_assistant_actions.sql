create table if not exists public.assistant_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'executed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_actions_business_user_created_idx
  on public.assistant_actions (business_id, user_id, created_at desc);

create index if not exists assistant_actions_business_status_created_idx
  on public.assistant_actions (business_id, status, created_at desc);

alter table public.assistant_actions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_actions'
      and policyname = 'assistant_actions_select_access'
  ) then
    create policy assistant_actions_select_access
      on public.assistant_actions
      for select
      using (public.can_access_business_messages(business_id, auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_actions'
      and policyname = 'assistant_actions_insert_access'
  ) then
    create policy assistant_actions_insert_access
      on public.assistant_actions
      for insert
      with check (
        auth.uid() = user_id
        and public.can_access_business_messages(business_id, auth.uid())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_actions'
      and policyname = 'assistant_actions_update_access'
  ) then
    create policy assistant_actions_update_access
      on public.assistant_actions
      for update
      using (public.can_access_business_messages(business_id, auth.uid()))
      with check (public.can_access_business_messages(business_id, auth.uid()));
  end if;
end $$;
