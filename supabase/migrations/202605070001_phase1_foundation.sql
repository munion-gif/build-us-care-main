-- Phase 1 foundation: enum expansion and new domain tables.
-- Safe to run before API changes. Existing MVP tables remain intact.

create extension if not exists "pgcrypto";

alter type order_status add value if not exists 'inquiry';
alter type order_status add value if not exists 'quoted';
alter type order_status add value if not exists 'scheduled';
alter type order_status add value if not exists 'in_progress';
alter type order_status add value if not exists 'done';
alter type order_status add value if not exists 'canceled';

alter type payment_status add value if not exists 'refunded';
alter type job_status add value if not exists 'checked_in';

do $$
begin
  create type housing_type as enum ('owner', 'jeonse', 'monthly_rent', 'unknown');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type building_type as enum ('apartment', 'villa', 'house', 'officetel', 'commercial', 'unknown');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type technician_type as enum ('direct', 'contractor');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type technician_grade as enum ('bronze', 'silver', 'gold', 'premium');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type media_type as enum ('inquiry', 'before', 'during', 'after', 'material', 'issue', 'report_video');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.homes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  address_full text not null,
  address_dong text not null,
  address_apt text,
  postal_code text,
  size_pyung integer,
  building_type building_type not null default 'unknown',
  year_built integer,
  floor text,
  moved_in_year integer,
  complex_id text,
  plan_image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  version integer not null,
  items jsonb not null default '[]'::jsonb,
  total_material integer not null default 0 check (total_material >= 0),
  total_labor integer not null default 0 check (total_labor >= 0),
  visit_fee integer not null default 0 check (visit_fee >= 0),
  discount integer not null default 0 check (discount >= 0),
  total_final integer not null default 0 check (total_final >= 0),
  quoted_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint quotes_order_version_uq unique (order_id, version)
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  type technician_type not null default 'contractor',
  grade technician_grade,
  skills jsonb not null default '[]'::jsonb,
  avg_nps numeric,
  pass_rate numeric,
  active_jobs_per_month integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  sku text primary key,
  name text not null,
  category text not null,
  wholesale_price integer not null default 0 check (wholesale_price >= 0),
  retail_price integer not null default 0 check (retail_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  avg_replacement_years integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  type media_type not null,
  url text not null,
  file_path text not null,
  angle text,
  tags jsonb not null default '[]'::jsonb,
  ai_detected jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint media_owner_check check (order_id is not null or job_id is not null)
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  passed boolean not null default false,
  checklist_results jsonb not null default '[]'::jsonb,
  issues_found text,
  inspected_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  nps integer not null check (nps between 0 and 10),
  score_time integer check (score_time between 1 and 5),
  score_quality integer check (score_quality between 1 and 5),
  score_response integer check (score_response between 1 and 5),
  score_clean integer check (score_clean between 1 and 5),
  score_price integer check (score_price between 1 and 5),
  free_text text,
  would_recommend boolean,
  would_repurchase boolean,
  submitted_at timestamptz not null default now()
);

create table if not exists public.warranty_cases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  status text not null default 'open',
  reason text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint warranty_cases_target_check check (order_id is not null or job_id is not null)
);

comment on table public.homes is
  'Phase 1 source of truth for visit addresses and home metadata.';
comment on table public.quotes is
  'Versioned server-side estimates. Payment must use the latest accepted quote.';
comment on table public.media is
  'Unified inquiry/job media metadata. Storage files live in buildus-order-photos.';
comment on table public.materials is
  'Physical material SKUs, costs, stock, and replacement-cycle data.';
