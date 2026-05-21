-- Phase 1 /api/quote refactor verification.
-- Update the phone/order filter if you use a different smoke-test customer.

with latest_order as (
  select o.id
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where c.phone = '01055556666'
  order by o.created_at desc
  limit 1
)
select
  q.id,
  q.order_id,
  q.version,
  q.total_material,
  q.total_labor,
  q.visit_fee,
  q.discount,
  q.total_final,
  q.accepted_at,
  jsonb_array_length(q.items) as item_count
from public.quotes q
join latest_order lo on lo.id = q.order_id
order by q.version;

with latest_order as (
  select o.id
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where c.phone = '01055556666'
  order by o.created_at desc
  limit 1
)
select
  count(*) as quote_count,
  min(version) as first_version,
  max(version) as latest_version,
  count(*) filter (where accepted_at is not null) as accepted_count
from public.quotes q
join latest_order lo on lo.id = q.order_id;
