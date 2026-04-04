alter table public.legal_acceptances enable row level security;

grant select, insert, update, delete on table public.legal_acceptances to authenticated;

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

drop policy if exists "legal_acceptances_update_own" on public.legal_acceptances;
create policy "legal_acceptances_update_own"
on public.legal_acceptances
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "legal_acceptances_delete_own" on public.legal_acceptances;
create policy "legal_acceptances_delete_own"
on public.legal_acceptances
for delete
to authenticated
using (auth.uid() = user_id);
