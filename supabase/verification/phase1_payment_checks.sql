-- Phase 1 payment confirm/webhook verification.
-- Update payment_key/order filter if you use another smoke test.

select
  p.id as payment_id,
  p.order_id,
  p.quote_id,
  p.payment_key,
  p.amount,
  p.status,
  p.provider_status,
  p.paid_at,
  p.approved_at,
  q.total_final as accepted_quote_total,
  q.accepted_at,
  o.status as order_status
from public.payments p
join public.quotes q on q.id = p.quote_id
join public.orders o on o.id = p.order_id
where p.payment_key in ('mock-step3-normal', 'mock-step3-duplicate')
order by p.created_at desc;

select
  event_type,
  idempotency_key,
  payment_id is not null as has_payment_id,
  payload->>'paymentKey' as payment_key,
  count(*) as event_count
from public.payment_events
where idempotency_key in ('confirm:mock-step3-normal', 'evt-step3-001')
   or payload->>'paymentKey' = 'mock-step3-normal'
group by event_type, idempotency_key, has_payment_id, payment_key
order by idempotency_key;
