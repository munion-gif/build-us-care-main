-- Standardize quote total_final as the customer-facing VAT-included final amount.
-- Existing rows are updated only when total_final still equals the pre-VAT subtotal.

with quote_subtotals as (
  select
    id,
    greatest(
      0,
      coalesce(total_material, 0) + coalesce(total_labor, 0) + coalesce(visit_fee, 0) - coalesce(discount, 0)
    )::integer as subtotal_amount
  from public.quotes
)
update public.quotes q
set total_final = round(s.subtotal_amount * 1.1)::integer
from quote_subtotals s
where q.id = s.id
  and coalesce(q.total_final, 0) = s.subtotal_amount;

with manual_quote_subtotals as (
  select
    id,
    greatest(
      0,
      coalesce(total_material, 0) + coalesce(total_labor, 0) + coalesce(visit_fee, 0) - coalesce(discount, 0)
    )::integer as subtotal_amount
  from public.manual_quotes
)
update public.manual_quotes mq
set total_final = round(s.subtotal_amount * 1.1)::integer
from manual_quote_subtotals s
where mq.id = s.id
  and coalesce(mq.total_final, 0) = s.subtotal_amount;

with latest_quotes as (
  select distinct on (order_id)
    order_id,
    total_final,
    greatest(
      0,
      coalesce(total_material, 0) + coalesce(total_labor, 0) + coalesce(visit_fee, 0) - coalesce(discount, 0)
    )::integer as subtotal_amount
  from public.quotes
  where order_id is not null
  order by order_id, coalesce(accepted_at, created_at) desc, version desc
)
update public.orders o
set
  subtotal_amount = q.subtotal_amount,
  total_amount = q.total_final
from latest_quotes q
where o.id = q.order_id
  and coalesce(o.total_amount, 0) <> q.total_final;

update public.payments p
set total_amount = q.total_final
from public.quotes q
where p.quote_id = q.id
  and coalesce(p.total_amount, 0) <> q.total_final;
