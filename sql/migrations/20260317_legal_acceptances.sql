create extension if not exists pgcrypto;

alter table public.businesses
  add column if not exists refund_policy text,
  add column if not exists late_fee_disclosure text;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_key text not null,
  document_version text not null,
  accepted_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.legal_acceptances
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

create unique index if not exists legal_acceptances_user_business_document_idx
  on public.legal_acceptances (user_id, business_id, document_key);

create index if not exists legal_acceptances_business_id_idx
  on public.legal_acceptances (business_id);

create index if not exists legal_acceptances_user_id_idx
  on public.legal_acceptances (user_id);

alter table public.legal_acceptances enable row level security;

drop policy if exists "legal_acceptances_select_own" on public.legal_acceptances;
create policy "legal_acceptances_select_own"
on public.legal_acceptances
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "legal_acceptances_insert_own" on public.legal_acceptances;
create policy "legal_acceptances_insert_own"
on public.legal_acceptances
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "legal_acceptances_delete_own" on public.legal_acceptances;
create policy "legal_acceptances_delete_own"
on public.legal_acceptances
for delete
to authenticated
using (auth.uid() = user_id);
