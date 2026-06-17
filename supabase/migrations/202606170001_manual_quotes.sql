-- Store administrator-created quotes that are not tied to a customer order.

create table if not exists public.manual_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  customer_name text not null,
  customer_phone text not null,
  address_text text not null,
  items jsonb not null default '[]'::jsonb,
  total_material integer not null default 0 check (total_material >= 0),
  total_labor integer not null default 0 check (total_labor >= 0),
  visit_fee integer not null default 0 check (visit_fee >= 0),
  discount integer not null default 0 check (discount >= 0),
  total_final integer not null default 0 check (total_final >= 0),
  converted_order_id uuid references public.orders(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_quotes_created_at_idx on public.manual_quotes(created_at desc);
create index if not exists manual_quotes_customer_phone_idx on public.manual_quotes(customer_phone);
create index if not exists manual_quotes_converted_order_id_idx on public.manual_quotes(converted_order_id);

drop trigger if exists manual_quotes_set_updated_at on public.manual_quotes;
create trigger manual_quotes_set_updated_at before update on public.manual_quotes
  for each row execute function set_updated_at();

alter table public.manual_quotes enable row level security;
alter table public.manual_quotes force row level security;

drop policy if exists service_role_full_access_manual_quotes on public.manual_quotes;
create policy service_role_full_access_manual_quotes
  on public.manual_quotes for all to service_role
  using (true)
  with check (true);
