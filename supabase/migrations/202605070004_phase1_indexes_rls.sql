-- Phase 1 indexes, triggers, and RLS policies.

create index if not exists homes_customer_id_idx on public.homes(customer_id);
create index if not exists homes_address_dong_idx on public.homes(address_dong);
create index if not exists orders_home_id_idx on public.orders(home_id);
create index if not exists orders_channel_idx on public.orders(channel);
create index if not exists quotes_order_id_idx on public.quotes(order_id);
create index if not exists quotes_accepted_at_idx on public.quotes(accepted_at) where accepted_at is not null;
create index if not exists payments_quote_id_idx on public.payments(quote_id);
create index if not exists jobs_technician_id_idx on public.jobs(technician_id);
create index if not exists jobs_scheduled_at_idx on public.jobs(scheduled_at);
create index if not exists media_order_id_idx on public.media(order_id);
create index if not exists media_job_id_idx on public.media(job_id);
create index if not exists inspections_job_id_idx on public.inspections(job_id);
create index if not exists feedbacks_order_id_idx on public.feedbacks(order_id);
create index if not exists technicians_is_active_idx on public.technicians(is_active);
create index if not exists materials_category_idx on public.materials(category);
create index if not exists warranty_cases_order_id_idx on public.warranty_cases(order_id);
create index if not exists warranty_cases_job_id_idx on public.warranty_cases(job_id);

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at before update on public.materials
  for each row execute function set_updated_at();

do $$
declare
  table_name text;
  protected_tables text[] := array[
    'homes',
    'quotes',
    'technicians',
    'materials',
    'media',
    'inspections',
    'feedbacks',
    'warranty_cases'
  ];
begin
  foreach table_name in array protected_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'service_role_full_access_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      'service_role_full_access_' || table_name,
      table_name
    );
  end loop;
end $$;
