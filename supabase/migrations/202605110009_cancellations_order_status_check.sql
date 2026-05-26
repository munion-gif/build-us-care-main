ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'draft','submitted','inquiry','payment_pending','paid',
      'scheduled','reservation_confirmed','preparing',
      'in_progress','in_service',
      'completed','done',
      'canceled','cancelled','cancel_requested',
      'issue','warranty'
    )
  );
