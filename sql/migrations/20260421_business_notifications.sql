create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null,
  title text not null,
  body text not null,
  href text null,
  content_hash text not null,
  recipient_count integer not null default 0,
  email_recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.business_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null,
  business_id uuid null references public.businesses(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  href text null,
  is_read boolean not null default false,
  read_at timestamptz null,
  broadcast_id uuid null references public.notification_broadcasts(id) on delete set null,
  event_key text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists business_notifications_event_key_unique
on public.business_notifications (event_key)
where event_key is not null;

create index if not exists business_notifications_recipient_created_idx
on public.business_notifications (recipient_user_id, created_at desc);

create index if not exists business_notifications_unread_idx
on public.business_notifications (recipient_user_id, is_read, created_at desc);

create index if not exists notification_broadcasts_sender_created_idx
on public.notification_broadcasts (sender_user_id, created_at desc);
