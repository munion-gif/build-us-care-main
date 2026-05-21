-- Phase 1 compatibility expansion for current MVP tables.
-- Existing app code can continue to use old columns while new APIs move to
-- home_id, quotes, media, feedbacks, technicians, and materials.

alter table public.customers
  add column if not exists address_full text,
  add column if not exists address_dong text,
  add column if not exists address_apt text,
  add column if not exists housing_type housing_type not null default 'unknown',
  add column if not exists acquisition_source text not null default 'unknown',
  add column if not exists first_contact_at timestamptz not null default now();

alter table public.orders
  add column if not exists home_id uuid references public.homes(id) on delete set null,
  add column if not exists skus jsonb not null default '[]'::jsonb,
  add column if not exists channel text not null default 'web',
  add column if not exists reason text,
  add column if not exists urgency text,
  add column if not exists self_diagnosis text,
  add column if not exists inquiry_photos jsonb not null default '[]'::jsonb;

alter table public.payments
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists method text not null default 'unknown',
  add column if not exists paid_at timestamptz,
  add column if not exists refund_amount integer not null default 0 check (refund_amount >= 0),
  add column if not exists provider_status text;

alter table public.jobs
  add column if not exists technician_id uuid references public.technicians(id) on delete set null,
  add column if not exists scheduled_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists actual_minutes integer,
  add column if not exists expected_minutes integer not null default 0,
  add column if not exists materials_used jsonb not null default '[]'::jsonb,
  add column if not exists extra_materials jsonb not null default '[]'::jsonb,
  add column if not exists issues text,
  add column if not exists completion_notes text;

update public.payments
set paid_at = coalesce(paid_at, approved_at)
where status = 'done' and paid_at is null;

update public.jobs
set scheduled_at = scheduled_date::timestamptz
where scheduled_at is null and scheduled_date is not null;

update public.jobs
set ended_at = coalesce(ended_at, completed_at)
where ended_at is null and completed_at is not null;
