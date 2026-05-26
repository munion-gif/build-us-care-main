alter type public.order_status add value if not exists 'pending_product_payment';
alter type public.order_status add value if not exists 'product_paid';
alter type public.order_status add value if not exists 'installation_completed';
alter type public.order_status add value if not exists 'refunded';
alter type public.order_status add value if not exists 'issue';
alter type public.order_status add value if not exists 'warranty';

alter type public.payment_status add value if not exists 'aborted';
alter type public.payment_status add value if not exists 'canceled';
