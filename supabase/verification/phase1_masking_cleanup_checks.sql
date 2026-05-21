select
  'legacy_table_absence' as check_name,
  table_name,
  case when table_name is null then false else true end as still_exists
from (
  values
    ('order_photos'),
    ('reviews'),
    ('addresses'),
    ('order_items')
) expected(table_name)
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and tables.table_name = expected.table_name
);

select
  'legacy_table_absence_summary' as check_name,
  count(*) as remaining_legacy_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name in ('order_photos', 'reviews', 'addresses', 'order_items');

select
  'phase1_replacement_tables' as check_name,
  table_name,
  true as exists
from information_schema.tables
where table_schema = 'public'
  and table_name in ('homes', 'media', 'feedbacks', 'quotes', 'orders')
order by table_name;

select
  'products_reservations_reference_decision' as check_name,
  table_name,
  true as still_exists
from information_schema.tables
where table_schema = 'public'
  and table_name in ('products', 'reservations')
order by table_name;

select
  'latest_status_data' as check_name,
  o.id as order_id,
  o.status,
  c.phone,
  c.name,
  h.address_full,
  q.total_final
from public.orders o
left join public.customers c on c.id = o.customer_id
left join public.homes h on h.id = o.home_id
left join lateral (
  select total_final
  from public.quotes
  where quotes.order_id = o.id
  order by quoted_at desc
  limit 1
) q on true
order by o.created_at desc
limit 5;
