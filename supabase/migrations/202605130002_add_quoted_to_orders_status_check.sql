begin;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status = any (
      array[
        'draft'::public.order_status,
        'submitted'::public.order_status,
        'reservation_pending'::public.order_status,
        'reservation_confirmed'::public.order_status,
        'inquiry'::public.order_status,
        'quoted'::public.order_status,
        'payment_pending'::public.order_status,
        'paid'::public.order_status,
        'scheduled'::public.order_status,
        'preparing'::public.order_status,
        'in_progress'::public.order_status,
        'in_service'::public.order_status,
        'completed'::public.order_status,
        'done'::public.order_status,
        'canceled'::public.order_status,
        'cancelled'::public.order_status,
        'cancel_requested'::public.order_status,
        'issue'::public.order_status,
        'warranty'::public.order_status
      ]
    )
  )
  not valid;

alter table public.orders
  validate constraint orders_status_check;

commit;
