create extension if not exists "pgcrypto";

create type order_status as enum (
  'draft',
  'submitted',
  'reservation_pending',
  'reservation_confirmed',
  'payment_pending',
  'paid',
  'preparing',
  'in_service',
  'completed',
  'cancelled'
);

create type reservation_status as enum (
  'pending',
  'confirmed',
  'unavailable',
  'cancelled'
);

create type reservation_time_slot as enum (
  'morning',
  'afternoon',
  'all_day'
);

create type payment_status as enum (
  'ready',
  'pending',
  'done',
  'failed',
  'cancelled'
);

create type job_status as enum (
  'received',
  'material_ready',
  'assigned',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null,
  grade text,
  material_cost integer,
  install_cost integer,
  estimated_minutes integer,
  as_months integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  price_delta integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table service_items (
  service_type_code text primary key,
  display_name text not null,
  base_price integer not null,
  estimated_minutes integer not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references customers(id),
  status order_status not null default 'submitted',
  service_type_code text,
  visit_fee integer not null default 0,
  subtotal_amount integer not null default 0,
  total_amount integer not null default 0,
  special_requests text,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  road_address text not null,
  detail_address text not null default '',
  postal_code text not null default '',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  created_at timestamptz not null default now(),
  constraint addresses_owner_check check (order_id is not null or customer_id is not null)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  item_name text not null,
  option_summary text,
  qty integer not null check (qty > 0),
  unit_price integer not null check (unit_price >= 0),
  line_total integer not null check (line_total >= 0),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  file_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  reserved_date date not null,
  time_slot reservation_time_slot not null,
  status reservation_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index reservations_confirmed_slot_uq
  on reservations(reserved_date, time_slot)
  where status = 'confirmed';

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null default 'toss',
  payment_key text,
  order_name text not null,
  amount integer not null check (amount >= 0),
  status payment_status not null default 'ready',
  requested_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index payment_events_idempotency_key_uq
  on payment_events(idempotency_key)
  where idempotency_key is not null;

create table jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  assigned_technician_name text,
  status job_status not null default 'received',
  scheduled_date date,
  report_video_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table job_status_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  from_status job_status,
  to_status job_status not null,
  memo text,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  channel text not null,
  template_code text not null,
  recipient text not null,
  send_status text not null default 'pending',
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_target_check check (order_id is not null or job_id is not null)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();
create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();
create trigger reservations_set_updated_at before update on reservations
  for each row execute function set_updated_at();
create trigger payments_set_updated_at before update on payments
  for each row execute function set_updated_at();
create trigger jobs_set_updated_at before update on jobs
  for each row execute function set_updated_at();

create index orders_customer_id_idx on orders(customer_id);
create index orders_status_idx on orders(status);
create index order_items_order_id_idx on order_items(order_id);
create index reservations_order_id_idx on reservations(order_id);
create index payments_order_id_idx on payments(order_id);
create index jobs_status_idx on jobs(status);
create index notifications_order_id_idx on notifications(order_id);
