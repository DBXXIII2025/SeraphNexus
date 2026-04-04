alter table public.conversations
  alter column client_user_id drop not null,
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists source text,
  add column if not exists guest_token text;

create index if not exists conversations_business_idx
  on public.conversations (business_id);

create index if not exists conversations_client_user_idx
  on public.conversations (client_user_id);

create index if not exists conversations_business_client_email_idx
  on public.conversations (business_id, client_email);

create unique index if not exists conversations_guest_token_uidx
  on public.conversations (guest_token)
  where guest_token is not null;
