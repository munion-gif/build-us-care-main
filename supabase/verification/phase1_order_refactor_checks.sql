-- Phase 1 /api/orders refactor verification.
-- Update the phone value if you use a different smoke-test customer.

select
  c.id as customer_id,
  c.phone,
  c.acquisition_source,
  c.address_full as customer_address_full,
  h.id as home_id,
  h.address_full as home_address_full,
  h.size_pyung,
  h.building_type,
  h.year_built,
  o.id as order_id,
  o.order_number,
  o.status,
  o.home_id as order_home_id,
  o.channel,
  o.reason,
  o.urgency,
  o.skus,
  o.self_diagnosis,
  o.access_token is not null as has_access_token
from public.customers c
join public.homes h on h.customer_id = c.id
join public.orders o on o.customer_id = c.id and o.home_id = h.id
where c.phone = '01055556666'
order by o.created_at desc
limit 5;

select
  c.phone,
  count(distinct c.id) as customer_count,
  count(distinct h.id) as home_count,
  count(distinct o.id) as order_count
from public.customers c
left join public.homes h on h.customer_id = c.id
left join public.orders o on o.customer_id = c.id and o.home_id = h.id
where c.phone = '01055556666'
group by c.phone;
