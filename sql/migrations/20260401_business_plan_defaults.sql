-- Canonicalize legacy and null business plans for billing enforcement.
update public.businesses
set plan = 'free'
where plan is null or plan = 'basic';

update public.businesses
set plan = 'pro'
where plan = 'growth';

alter table public.businesses
alter column plan set default 'free';
