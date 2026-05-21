CREATE TABLE IF NOT EXISTS public.slot_configs (
  date date PRIMARY KEY,
  morning_cap int NOT NULL DEFAULT 3 CHECK (morning_cap >= 0),
  afternoon_cap int NOT NULL DEFAULT 3 CHECK (afternoon_cap >= 0),
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON public.slot_configs;
CREATE POLICY "service role full access" ON public.slot_configs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_slot_configs_date ON public.slot_configs(date);

DROP INDEX IF EXISTS public.reservations_confirmed_slot_uq;
CREATE INDEX IF NOT EXISTS idx_reservations_date_slot_status
  ON public.reservations(reserved_date, time_slot, status);
