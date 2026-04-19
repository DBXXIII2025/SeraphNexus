alter table public.platform_settings
  add column if not exists site_name text not null default 'Seraph Nexus',
  add column if not exists logo_url text,
  add column if not exists logo_storage_path text;

update public.platform_settings
set site_name = coalesce(nullif(site_name, ''), nullif(platform_name, ''), 'Seraph Nexus')
where site_name is null or site_name = '';

insert into storage.buckets (id, name, public)
values ('platform-brand-assets', 'platform-brand-assets', true)
on conflict (id) do update
set public = true;
