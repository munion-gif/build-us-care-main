do $$
declare
  table_name text;
  protected_tables text[] := array[
    'customers',
    'addresses',
    'orders',
    'order_items',
    'order_photos',
    'reservations',
    'payments',
    'payment_events',
    'jobs',
    'job_status_logs',
    'notifications',
    'reviews'
  ];
begin
  foreach table_name in array protected_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'service_role_full_access_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      'service_role_full_access_' || table_name,
      table_name
    );
  end loop;
end $$;

create unique index if not exists payments_payment_key_uq
  on public.payments(payment_key)
  where payment_key is not null;

comment on policy service_role_full_access_customers on public.customers is
  'Backend-only service role policy. No anon/authenticated policy is created, so direct public API access is denied.';
comment on policy service_role_full_access_orders on public.orders is
  'Backend-only service role policy. Guest access must go through Next.js access_token APIs.';
comment on policy service_role_full_access_payments on public.payments is
  'Backend-only service role policy. Payment data must not be queried directly from browser clients.';
comment on policy service_role_full_access_jobs on public.jobs is
  'Backend-only service role policy. Admin operations must go through protected Next.js routes.';
