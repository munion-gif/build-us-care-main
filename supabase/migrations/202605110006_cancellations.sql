INSERT INTO public.app_configs (key, value) VALUES
  ('cancel_policy_full_refund_hours', '24'),
  ('cancel_policy_full_refund_days_before', '3'),
  ('cancel_policy_partial_refund_rate', '0.5'),
  ('cancel_policy_no_refund_status', 'in_progress,completed,done,canceled,cancelled,warranty')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE TABLE IF NOT EXISTS public.cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  reason text,
  refund_rate numeric(3,2) NOT NULL DEFAULT 0,
  refund_amount integer NOT NULL DEFAULT 0,
  cancel_type text NOT NULL CHECK (cancel_type IN ('auto', 'manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  toss_cancel_key text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid,
  note text
);

CREATE INDEX IF NOT EXISTS idx_cancellations_order_id ON public.cancellations(order_id);
CREATE INDEX IF NOT EXISTS idx_cancellations_status ON public.cancellations(status);
CREATE INDEX IF NOT EXISTS idx_cancellations_requested_at ON public.cancellations(requested_at DESC);

ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON public.cancellations;
CREATE POLICY "service role full access" ON public.cancellations
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_key text;

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancel_requested';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'canceled';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelled';

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

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_technician_date ON public.jobs(technician_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_order_id ON public.jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date_slot ON public.reservations(reserved_date, time_slot);
CREATE INDEX IF NOT EXISTS idx_events_order_id ON public.events(order_id);

ANALYZE public.orders;
ANALYZE public.jobs;
ANALYZE public.reservations;
