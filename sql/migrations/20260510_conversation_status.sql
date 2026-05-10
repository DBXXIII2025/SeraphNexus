alter table public.conversations
  add column if not exists status text not null default 'open'
  check (status in ('open', 'resolved', 'archived'));

create index if not exists conversations_business_status_last_message_idx
  on public.conversations (business_id, status, last_message_at desc);

update public.conversations
set status = 'open'
where status is null;
