alter table public.payments
  add column if not exists provider_order_id text,
  add column if not exists product_amount integer not null default 0 check (product_amount >= 0),
  add column if not exists service_fee_amount integer not null default 0 check (service_fee_amount >= 0),
  add column if not exists total_amount integer not null default 0 check (total_amount >= 0),
  add column if not exists online_payment_amount integer not null default 0 check (online_payment_amount >= 0),
  add column if not exists onsite_payment_amount integer not null default 0 check (onsite_payment_amount >= 0),
  add column if not exists onsite_payment_status text not null default 'PENDING' check (onsite_payment_status in ('PENDING', 'DONE')),
  add column if not exists quote_status text,
  add column if not exists receipt_url text;

create unique index if not exists payments_provider_order_id_uq
  on public.payments(provider_order_id)
  where provider_order_id is not null;

alter table public.orders
  add column if not exists online_payment_amount integer not null default 0 check (online_payment_amount >= 0),
  add column if not exists onsite_payment_amount integer not null default 0 check (onsite_payment_amount >= 0),
  add column if not exists onsite_payment_status text not null default 'PENDING' check (onsite_payment_status in ('PENDING', 'DONE'));

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
        'pending_product_payment'::public.order_status,
        'paid'::public.order_status,
        'product_paid'::public.order_status,
        'scheduled'::public.order_status,
        'preparing'::public.order_status,
        'in_progress'::public.order_status,
        'in_service'::public.order_status,
        'installation_completed'::public.order_status,
        'completed'::public.order_status,
        'done'::public.order_status,
        'canceled'::public.order_status,
        'cancelled'::public.order_status,
        'cancel_requested'::public.order_status,
        'issue'::public.order_status,
        'warranty'::public.order_status,
        'refunded'::public.order_status
      ]
    )
  )
  not valid;

alter table public.orders
  validate constraint orders_status_check;
