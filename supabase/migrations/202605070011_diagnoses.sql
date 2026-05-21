create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  service_code text,
  photos jsonb not null default '[]',
  result text check (result in ('replace_recommended','hold','no_replacement_needed','site_check_required')),
  result_message text,
  reason text,
  suggested_service_code text,
  suggested_product_code text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.diagnoses enable row level security;
alter table public.diagnoses force row level security;

drop policy if exists "service role full access" on public.diagnoses;
create policy "service role full access" on public.diagnoses
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
