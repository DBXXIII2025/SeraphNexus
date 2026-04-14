alter table public.platform_settings
  add column if not exists trial_transaction_fee_bps integer not null default 1000,
  add column if not exists pro_transaction_fee_bps integer not null default 500,
  add column if not exists elite_transaction_fee_bps integer not null default 200;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'platform_settings_trial_fee_valid'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_trial_fee_valid check (trial_transaction_fee_bps between 0 and 10000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'platform_settings_pro_fee_valid'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_pro_fee_valid check (pro_transaction_fee_bps between 0 and 10000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'platform_settings_elite_fee_valid'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_elite_fee_valid check (elite_transaction_fee_bps between 0 and 10000);
  end if;
end $$;
