CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON public.orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_phone_created_at
  ON public.customers(phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_order_id
  ON public.jobs(order_id);

CREATE INDEX IF NOT EXISTS idx_jobs_technician_scheduled_at
  ON public.jobs(technician_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at
  ON public.jobs(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_reservations_reserved_date_time_slot
  ON public.reservations(reserved_date, time_slot);

CREATE INDEX IF NOT EXISTS idx_diagnoses_result_created_at
  ON public.diagnoses(result, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_order_id_created_at
  ON public.events(order_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'type'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_type_created_at ON public.notifications(type, created_at DESC)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'template_code'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_template_code_created_at ON public.notifications(template_code, created_at DESC)';
  END IF;
END $$;

ANALYZE public.orders;
ANALYZE public.customers;
ANALYZE public.jobs;
ANALYZE public.reservations;
ANALYZE public.diagnoses;
ANALYZE public.notifications;
ANALYZE public.events;
