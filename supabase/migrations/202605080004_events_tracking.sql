create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  session_id text,
  occurred_at timestamptz not null default now(),
  properties jsonb default '{}'::jsonb
);

create index if not exists idx_events_event_type on public.events(event_type);
create index if not exists idx_events_customer_id on public.events(customer_id);
create index if not exists idx_events_order_id on public.events(order_id);
create index if not exists idx_events_occurred_at on public.events(occurred_at desc);
create index if not exists idx_events_session_id on public.events(session_id);

alter table public.events enable row level security;
alter table public.events force row level security;

drop policy if exists "service role full access" on public.events;
create policy "service role full access" on public.events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

alter table public.customers
  add column if not exists utm_campaign text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists referrer_url text;
