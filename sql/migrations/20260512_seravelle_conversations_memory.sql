create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text null,
  status text not null default 'active' check (status in ('active', 'archived', 'cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists assistant_conversations_business_user_updated_idx
  on public.assistant_conversations (business_id, user_id, updated_at desc);

create index if not exists assistant_conversations_business_user_status_idx
  on public.assistant_conversations (business_id, user_id, status, last_message_at desc);

alter table public.assistant_conversations enable row level security;

alter table public.assistant_messages
  add column if not exists assistant_conversation_id uuid references public.assistant_conversations(id) on delete set null;

create index if not exists assistant_messages_conversation_created_idx
  on public.assistant_messages (assistant_conversation_id, created_at desc);

alter table public.assistant_actions
  add column if not exists assistant_conversation_id uuid references public.assistant_conversations(id) on delete set null;

create index if not exists assistant_actions_conversation_created_idx
  on public.assistant_actions (assistant_conversation_id, created_at desc);

create table if not exists public.assistant_memory_summaries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assistant_conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  summary text not null,
  topics text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assistant_memory_summaries_conversation_uidx
  on public.assistant_memory_summaries (assistant_conversation_id);

create index if not exists assistant_memory_summaries_business_user_updated_idx
  on public.assistant_memory_summaries (business_id, user_id, updated_at desc);

alter table public.assistant_memory_summaries enable row level security;

insert into public.assistant_conversations (
  business_id,
  user_id,
  title,
  status,
  created_at,
  updated_at,
  last_message_at
)
select
  legacy.business_id,
  legacy.user_id,
  'Earlier Seravelle discussion',
  'active',
  legacy.first_created_at,
  legacy.last_created_at,
  legacy.last_created_at
from (
  select
    business_id,
    user_id,
    min(created_at) as first_created_at,
    max(created_at) as last_created_at
  from public.assistant_messages
  where assistant_conversation_id is null
  group by business_id, user_id
) legacy
where not exists (
  select 1
  from public.assistant_conversations existing
  where existing.business_id = legacy.business_id
    and existing.user_id = legacy.user_id
);

update public.assistant_messages
set assistant_conversation_id = mapped.id
from (
  select distinct on (business_id, user_id)
    id,
    business_id,
    user_id
  from public.assistant_conversations
  order by business_id, user_id, created_at asc
) mapped
where public.assistant_messages.business_id = mapped.business_id
  and public.assistant_messages.user_id = mapped.user_id
  and public.assistant_messages.assistant_conversation_id is null;

update public.assistant_actions
set assistant_conversation_id = mapped.id
from (
  select distinct on (business_id, user_id)
    id,
    business_id,
    user_id
  from public.assistant_conversations
  order by business_id, user_id, created_at asc
) mapped
where public.assistant_actions.business_id = mapped.business_id
  and public.assistant_actions.user_id = mapped.user_id
  and public.assistant_actions.assistant_conversation_id is null;

update public.assistant_conversations
set
  last_message_at = latest.last_message_at,
  updated_at = greatest(public.assistant_conversations.updated_at, latest.last_message_at)
from (
  select
    assistant_conversation_id,
    max(created_at) as last_message_at
  from public.assistant_messages
  where assistant_conversation_id is not null
  group by assistant_conversation_id
) latest
where public.assistant_conversations.id = latest.assistant_conversation_id;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_conversations'
      and policyname = 'assistant_conversations_select_access'
  ) then
    create policy assistant_conversations_select_access
      on public.assistant_conversations
      for select
      using (
        auth.uid() = user_id
        and public.can_access_business_messages(business_id, auth.uid())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_conversations'
      and policyname = 'assistant_conversations_insert_access'
  ) then
    create policy assistant_conversations_insert_access
      on public.assistant_conversations
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
      and tablename = 'assistant_conversations'
      and policyname = 'assistant_conversations_update_access'
  ) then
    create policy assistant_conversations_update_access
      on public.assistant_conversations
      for update
      using (
        auth.uid() = user_id
        and public.can_access_business_messages(business_id, auth.uid())
      )
      with check (
        auth.uid() = user_id
        and public.can_access_business_messages(business_id, auth.uid())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_memory_summaries'
      and policyname = 'assistant_memory_summaries_select_access'
  ) then
    create policy assistant_memory_summaries_select_access
      on public.assistant_memory_summaries
      for select
      using (
        auth.uid() = user_id
        and public.can_access_business_messages(business_id, auth.uid())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_memory_summaries'
      and policyname = 'assistant_memory_summaries_insert_access'
  ) then
    create policy assistant_memory_summaries_insert_access
      on public.assistant_memory_summaries
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
      and tablename = 'assistant_memory_summaries'
      and policyname = 'assistant_memory_summaries_update_access'
  ) then
    create policy assistant_memory_summaries_update_access
      on public.assistant_memory_summaries
      for update
      using (
        auth.uid() = user_id
        and public.can_access_business_messages(business_id, auth.uid())
      )
      with check (
        auth.uid() = user_id
        and public.can_access_business_messages(business_id, auth.uid())
      );
  end if;
end $$;
